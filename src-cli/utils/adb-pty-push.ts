import { spawn } from 'node:child_process';
import path from 'node:path';
import { execa } from 'execa';
import type { PushBytesProgressEvent } from '../../types/protocol.js';
import {
  AdbProgressParser,
  toPushBytesEvent,
} from './adb-progress-parse.js';
import { resolveTool } from './tool-paths.js';

/** Wide enough that LinePrinter will not elide remote paths. */
const PTY_COLUMNS = 512;

/**
 * Single-quotes a string for the device shell that `adb shell` re-parses.
 */
function quoteAdbShell(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Ensures the remote parent directory exists before `adb push`. */
async function mkdirRemoteParent(
  serial: string,
  remotePath: string,
): Promise<void> {
  const remoteDir = path.posix.dirname(remotePath);
  if (remoteDir.length === 0 || remoteDir === '.') return;
  await execa(
    resolveTool('adb'),
    ['-s', serial, 'shell', `mkdir -p ${quoteAdbShell(remoteDir)}`],
    { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', reject: false },
  );
}

/**
 * argv for macOS `script` so adb's stderr is a real TTY (LinePrinter
 * otherwise buffers INFO ticks until the summary). `stty` sets the slave
 * winsize so paths stay un-elided.
 */
function darwinScriptArgv(adbArgs: readonly string[]): Array<string> {
  return [
    'script',
    '-q',
    '/dev/null',
    'sh',
    '-c',
    `stty columns ${String(PTY_COLUMNS)} rows 24; exec "$@"`,
    'sh',
    ...adbArgs,
  ];
}

/**
 * Pushes one local file with native `adb push` inside a PTY and maps
 * LinePrinter ticks onto `push_bytes` for the transfer bar.
 */
export async function adbPushFileWithPtyProgress(options: {
  readonly serial: string;
  readonly localPath: string;
  readonly remotePath: string;
  readonly relativePath: string;
  readonly fileSizeBytes: number;
  readonly completedFiles: number;
  readonly totalFiles: number;
  readonly onEvent: (event: PushBytesProgressEvent) => void;
}): Promise<void> {
  await mkdirRemoteParent(options.serial, options.remotePath);

  const adbArgs = [
    resolveTool('adb'),
    '-s',
    options.serial,
    'push',
    '-Z',
    options.localPath,
    options.remotePath,
  ];
  const argv =
    process.platform === 'darwin' ? darwinScriptArgv(adbArgs) : [...adbArgs];
  const command = argv[0];
  if (command === undefined) {
    throw new Error('adb push command was empty');
  }

  const parser = new AdbProgressParser();
  let lastErrorLine = '';

  const emitRecords = (
    records: ReturnType<AdbProgressParser['push']>,
  ): void => {
    for (const record of records) {
      const event = toPushBytesEvent(record, {
        file: options.relativePath,
        fileSizeBytes: options.fileSizeBytes,
        completedFiles: options.completedFiles,
        totalFiles: options.totalFiles,
      });
      if (event) options.onEvent(event);
    }
  };

  const onChunk = (chunk: Buffer | string): void => {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    for (const line of text.split(/\r|\n/)) {
      const trimmed = line.replace(/\u001B\[[0-9;]*[A-Za-z]/g, '').trim();
      if (trimmed.startsWith('adb:')) lastErrorLine = trimmed;
    }
    emitRecords(parser.push(text));
  };

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, argv.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLUMNS: String(PTY_COLUMNS),
        LINES: '24',
      },
    });

    child.stdout?.on('data', onChunk);
    child.stderr?.on('data', onChunk);

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      emitRecords(parser.flush());
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          lastErrorLine.length > 0
            ? lastErrorLine
            : `adb push exited with code ${String(code ?? -1)}`,
        ),
      );
    });
  });
}
