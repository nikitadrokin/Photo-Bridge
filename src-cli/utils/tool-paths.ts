import { accessSync, constants } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/**
 * Resolves the CLI tools Photo Bridge shells out to, preferring a copy
 * installed by the desktop app over whatever is on the user's PATH.
 *
 * The Tauri app installs tools into its app-data directory and publishes a
 * stable `bin/<id>` entrypoint (a symlink to the real executable). When that
 * exists we use it; otherwise we fall back to the bare command name so the
 * tool is resolved from PATH (Homebrew, manual install, …).
 */

/** Must match the `identifier` in `src-tauri/tauri.conf.json`. */
const APP_IDENTIFIER = 'me.nkdr.photo-bridge';

/** Tools that may have an app-managed copy, keyed by binary name. */
type ManagedTool = 'ffmpeg' | 'ffprobe' | 'exiftool' | 'adb';

/**
 * Tauri's `app_data_dir()` for this app, by platform. Returns `null` when it
 * can't be determined (then we fall back to PATH).
 */
function appDataDir(): string | null {
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', APP_IDENTIFIER);
    case 'win32': {
      const appData = process.env.APPDATA;
      return appData ? join(appData, APP_IDENTIFIER) : null;
    }
    default: {
      // Linux / other: $XDG_DATA_HOME/<id> or ~/.local/share/<id>.
      const xdg = process.env.XDG_DATA_HOME;
      return xdg
        ? join(xdg, APP_IDENTIFIER)
        : join(home, '.local', 'share', APP_IDENTIFIER);
    }
  }
}

/** True when `path` exists and is executable by the current process. */
function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Cache resolutions for the life of the process; paths don't change mid-run. */
const cache = new Map<ManagedTool, string>();

/**
 * Resolve the path/command to invoke for a managed tool. Prefers the
 * app-installed copy; otherwise returns the bare name for PATH resolution.
 */
export function resolveTool(tool: ManagedTool): string {
  const cached = cache.get(tool);
  if (cached) {
    return cached;
  }

  const base = appDataDir();
  const managed = base ? join(base, 'bin', tool) : null;

  // prefer managed app-installed copy over the system global tool
  const resolved = managed && isExecutable(managed) ? managed : tool;

  cache.set(tool, resolved);
  return resolved;
}
