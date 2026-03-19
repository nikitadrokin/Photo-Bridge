/**
 * Shell-safe string formatting utilities.
 *
 * These helpers let you write readable, multi-line template literals in
 * TypeScript and produce correctly escaped, single-line shell commands
 * safe to pass through Tauri's `exec-sh` (`sh -c "…"`).
 */

/**
 * Wraps a string in POSIX single quotes.
 *
 * Single-quoting is the safest shell quoting form — everything inside is
 * treated literally. The only character that needs special handling is `'`
 * itself, which uses the standard `'\''` idiom (end quote, escaped quote,
 * resume quote).
 *
 * @example
 * shSingleQuote("hello world")   // => 'hello world'
 * shSingleQuote("it's")          // => 'it'\''s'
 */
export function shSingleQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * Converts a multi-line template literal into a single portable `printf`
 * invocation.
 *
 * - Strips the leading blank line (from the opening backtick)
 * - Strips the trailing blank line (from the closing backtick)
 * - Removes common leading indentation (dedent)
 * - Preserves blank lines
 * - Quotes each line safely for POSIX shells
 *
 * The result is a single-line `printf '%s\n' ...` command you can embed in
 * shell scripts on macOS and Android (`/system/bin/sh`).
 *
 * @example
 * const banner = shLines`
 *   Welcome to the device shell.
 *
 *     ls    - list files
 *     exit  - close
 * `;
 * // => printf '%s\n' 'Welcome to the device shell.' '' '  ls    - list files' '  exit  - close'
 */
export function shLines(
  strings: TemplateStringsArray,
  ...values: Array<unknown>
): string {
  // Interpolate the tagged template into a plain string
  const raw = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? String(values[i]) : ''),
    '',
  );

  // Split into lines
  let lines = raw.split('\n');

  // Strip the leading blank line (artifact of `\n` right after opening backtick)
  if (lines.length > 0 && lines[0].trim() === '') {
    lines = lines.slice(1);
  }

  // Strip the trailing blank line (artifact of `\n` right before closing backtick)
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines = lines.slice(0, -1);
  }

  // Dedent: find the minimum indentation of non-empty lines
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^(\s*)/)?.[1].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;

  if (minIndent > 0) {
    lines = lines.map((l) => l.slice(minIndent));
  }

  // Build a portable printf command. Use one %s per line so content is passed
  // as data, not interpreted as a format string.
  const safeLines = (lines.length > 0 ? lines : [''])
    .map(shSingleQuote)
    .join(' ');

  return `printf '%s\\n' ${safeLines}`;
}

/**
 * Joins an array of shell snippets with `; `.
 *
 * Use this when each part is already a complete shell fragment and should run
 * sequentially in the same shell.
 *
 * @example
 * shJoin(['cd /tmp', 'pwd', 'exec /bin/sh'])
 * // => "cd /tmp; pwd; exec /bin/sh"
 */
export function shJoin(parts: Array<string>): string {
  return parts.join('; ');
}
