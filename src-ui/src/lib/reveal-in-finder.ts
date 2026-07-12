import { Command } from '@tauri-apps/plugin-shell';

/** Open a local path in Finder (macOS `open`). */
export async function revealInFinder(path: string): Promise<void> {
  await Command.create('open', [path]).execute();
}
