import { Command } from 'commander';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';
import { formatAvailLabel, parseDfAvailable } from '../utils/df-parse.js';

export const shell = new Command()
  .name('shell')
  .description(
    'Launch an interactive ADB shell session, or run a one-shot remote command',
  )
  .option('--jsonl', 'enable JSON output for UI integration')
  .argument(
    '[remote...]',
    'remote shell command (omit for an interactive session); use `--` before flags (e.g. `pb shell -- df -h .`)',
  )
  .action(async (remote: Array<string>, opts: { jsonl?: boolean }) => {
    if (opts.jsonl) {
      logger.setMode('json');
    }

    if (remote.length === 0) {
      if (opts.jsonl) {
        logger.error(
          'Interactive shell is not available with --jsonl (run without --jsonl in a terminal)',
        );
        process.exit(1);
        return;
      }
      try {
        await execa('adb', ['shell'], { stdio: 'inherit' });
      } catch {
        // adb will have printed the error already due to stdio: inherit
      }
      return;
    }

    const result = await execa('adb', ['shell', ...remote], {
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    });

    if (opts.jsonl) {
      if (result.exitCode !== 0) {
        const errText =
          result.stderr.trim().length > 0
            ? result.stderr.trim()
            : `adb shell exited with code ${String(result.exitCode)}`;
        logger.error(errText);
        process.exit(result.exitCode === null ? 1 : result.exitCode);
        return;
      }

      const raw = (result.stdout ?? '').trim();
      const parsedAvail = parseDfAvailable(raw);
      const base = parsedAvail ?? '';

      logger.emitJSON({
        v: 1,
        kind: 'shell_storage',
        availHuman: formatAvailLabel(base),
        exitCode: result.exitCode ?? 0,
      });
      process.exit(0);
      return;
    }

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exit(result.exitCode === null ? 1 : result.exitCode);
  });
