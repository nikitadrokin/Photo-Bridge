import { Command } from 'commander';
import { execa } from 'execa';
import { createCliOutput } from '../utils/logger.js';
import { parseDfAvailable, formatAvailLabel } from '../utils/df-parse.js';

export const shell = new Command()
  .name('shell')
  .description(
    'Launch an interactive ADB shell session, or run a one-shot remote command',
  )
  .argument(
    '[remote...]',
    'remote shell command (omit for an interactive session); use `--` before flags (e.g. `pb shell -- df -h .`)',
  )
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (remote: Array<string>, opts: { jsonl?: boolean }) => {
    const output = createCliOutput(Boolean(opts.jsonl));

    if (remote.length === 0) {
      if (opts.jsonl) {
        output.error(
          'Interactive shell is not available with --jsonl (run without --jsonl in a terminal)',
          'no_interactive_jsonl',
        );
        process.exit(1);
      }
      try {
        await execa('adb', ['shell'], { stdio: 'inherit' });
      } catch {
        // adb prints errors via stdio: inherit
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
        output.error(errText, 'adb_shell_error');
        process.exit(result.exitCode ?? 1);
      }

      const raw = (result.stdout ?? '').trim();
      const avail = parseDfAvailable(raw) ?? '';
      output.event({
        v: 1,
        kind: 'shell_storage',
        availHuman: formatAvailLabel(avail),
        exitCode: result.exitCode ?? 0,
      });
      return;
    }

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode ?? 1);
  });
