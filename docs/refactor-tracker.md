# Photo Bridge Refactor Tracker

This file preserves refactor context across chats and summaries. Keep it current when a task changes scope, lands, or reveals a new risk.

## Current Situation

The working tree contains a mix of staged and unstaged refactor work. The staged changes are not yet a clean commit boundary even though `bun run typecheck` currently passes. The current goal is to preserve the best parts of the production code in `opensrc/repos/github.com/nikitadrokin/photo-bridge` while continuing the newer direction: scalable command output, UI-friendly JSONL events, clearer CLI/UI separation, and less ad hoc command logic.

## Production Reference

The production reference under `opensrc/repos/github.com/nikitadrokin/photo-bridge` is useful for behavior that should not be lost:

- `src-cli/utils/sibling-directory.ts` has reusable copy-to-sibling helpers.
- `src-cli/commands/fix-dates/*` preserves a cleaner command split for inspect/apply/batch behavior.
- `fix-dates` production behavior includes Google Takeout sidecar support, optional overwrite mode, filesystem timestamp syncing, and duplicate media filtering.
- The old logger was less scalable, but some command behavior around recoverability and metadata priority is worth carrying forward.

## Refactor Direction

- Prefer one command output abstraction, currently `createCliOutput`, instead of global logger mode.
- Keep stdout parseable in `--jsonl` mode. Human-mode formatting should not leak into UI/sidecar output.
- Treat `types/protocol.ts` as the contract between CLI and UI. New emitted events should be modeled there before UI code depends on them.
- Extract shared path/copy/media helpers when multiple commands need them; avoid embedding reusable filesystem behavior inside command files.
- Keep commits separated by behavior boundary: protocol/logger, `fix-dates`, transfer commands, copy/video processing, then UI wiring.

## Known Risks

- `fix-dates.ts` currently has staged and unstaged changes. It should be reconciled before committing.
- The unstaged `fix-dates` copy-to-sibling logic duplicates production's reusable sibling-directory helper.
- Current `fix-dates` WIP appears to omit production Google Takeout sidecar behavior.
- `push-to-pixel.ts` and `pull-from-pixel.ts` emit progress events but use loose ADB sync typing and need runtime review around POSIX remote paths and sync lifecycle.
- `types/protocol.ts` currently narrows `Command` to `convert | copy`; that is too small for the new command surface.
- `src-cli/processors/video.ts` calls `hasValidCreateDate(outputPath)` but does not use the boolean result, so a failed date verification can still return success.

## Recommended Commit Boundaries

1. Stabilize logger/protocol.
2. Restore/extract reusable sibling-directory helpers.
3. Reconcile and refactor `fix-dates` while preserving production behavior.
4. Review and commit Pixel transfer commands (`push`, `pull`, `shell`).
5. Review and commit `copy` and video processing changes.
6. Wire or adjust UI behavior after the CLI event contract is stable.

## Progress Log

- 2026-05-28: Initial audit found staged changes directionally useful but not ready to commit. `bun run typecheck` passed before any tracker edits.
- 2026-05-28: Start first task: stabilize protocol/logger contract for currently emitted CLI events.
- 2026-05-28: Added shared `COMMANDS` list to `types/protocol.ts`, expanded command coverage for JSONL events, updated session parser validation to use the shared set, updated UI activity verb formatting for the expanded command union, removed transfer-command event casts, and verified `bun run typecheck` passes.
- 2026-05-28: Committed protocol/tracker boundary as `cadcafb`. Expanded `src-cli/utils/sibling-directory.ts` with reusable copy-root mapping helpers and committed it as `810e008`. `fix-dates.ts` is currently edited to use this helper but remains mixed with earlier staged work and is not committed yet.

## Next Tasks

- Restore/extract reusable sibling-directory helpers, preferably by carrying forward the production helper shape instead of duplicating path-copy logic inside `fix-dates.ts`.
- Reconcile `fix-dates.ts` staged and unstaged changes while preserving production Google Takeout behavior.
- Review Pixel transfer commands for ADB path handling and runtime behavior.
