import { shJoin } from '@/lib/shell-formatters';

export type TerminalType = 'ghostty' | 'terminal';

export interface TerminalCommand {
  command: string;
  args?: Array<string>;
}

export interface NativeTerminal {
  type: TerminalType;
  appPath: string;
  name: string;
  buildLaunchCommand: (shellScript: string) => TerminalCommand;
}

const GHOSTTY_APP_PATH = '/Applications/Ghostty.app';
const GHOSTTY_EXECUTABLE_PATH = `${GHOSTTY_APP_PATH}/Contents/MacOS/ghostty`;
const TERMINAL_APP_PATH = '/System/Applications/Utilities/Terminal.app';
const LOGIN_SHELL_COMMAND = 'exec "${SHELL:-/bin/zsh}" -l';

const TERMINAL_APPLESCRIPT_LINES = [
  'on run argv',
  'set shellCommand to item 1 of argv',
  'tell application "Terminal"',
  'activate',
  'do script shellCommand',
  'end tell',
  'end run',
] as const;

export function buildOsascriptCommand(
  scriptLines: ReadonlyArray<string>,
  argv: Array<string> = [],
): TerminalCommand {
  return {
    command: 'osascript',
    args: [...scriptLines.flatMap((line) => ['-e', line]), ...argv],
  };
}

export function buildLoginShellScript(shellScript: string): string {
  return shJoin([shellScript, LOGIN_SHELL_COMMAND]);
}

export function buildGhosttyLaunchCommand(
  shellScript: string,
): TerminalCommand {
  return {
    command: GHOSTTY_EXECUTABLE_PATH,
    args: ['-e', '/bin/zsh', '-lc', buildLoginShellScript(shellScript)],
  };
}

export function buildTerminalAppLaunchCommand(
  shellScript: string,
): TerminalCommand {
  return buildOsascriptCommand(TERMINAL_APPLESCRIPT_LINES, [shellScript]);
}

export const NATIVE_TERMINALS: Array<NativeTerminal> = [
  {
    type: 'ghostty',
    appPath: GHOSTTY_APP_PATH,
    name: 'Ghostty',
    buildLaunchCommand: buildGhosttyLaunchCommand,
  },
  {
    type: 'terminal',
    appPath: TERMINAL_APP_PATH,
    name: 'Terminal',
    buildLaunchCommand: buildTerminalAppLaunchCommand,
  },
];
