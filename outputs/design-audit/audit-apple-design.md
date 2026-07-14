# Photo Bridge — Apple Design Audit (apple-design skill)

Scope: `src-ui` (Tauri desktop app, macOS). Lens: Apple's fluid-interface principles, materials & depth, typography, feedback, wayfinding, and the eight design principles (purpose, agency, responsibility, familiarity, flexibility, simplicity, craft, delight).

## 1. Response & feedback

- **No press-down feedback anywhere.** Buttons highlight on hover and act on click, but nothing responds on pointer-*down* (`components/ui/button.tsx`). Apple: "respond on pointer-down, not on release" — the moment feedback waits for release, directness dies. Fix: `:active` scale/tint on the shared Button.
- **Feedback kinds are otherwise well covered**: loading toasts with progress (`app-sidebar.tsx` update flow), success/error toasts, inline destructive alerts (`transfer-media.tsx` interrupted-transfer alert). Good status/completion/warning/error coverage.

## 2. Materials & depth

- **Fake material on the title bar.** `PageHeader` applies `backdrop-blur-lg` but its background is fully opaque `bg-sidebar` (`components/header.tsx:18`) — the blur is dead code and the chrome reads as a flat strip. Either make it a real material (`bg-sidebar/75 backdrop-blur-lg` with content scrolling underneath) or remove the blur. On macOS, translucent chrome is the native expectation for a Tauri app trying to feel at home.
- **No `prefers-reduced-transparency` / `prefers-contrast` handling.** If translucency is adopted, pair it with the frosted/solid fallback.
- **Scroll edges:** content scrolls hard against the fixed header with no scroll-edge treatment (`app-page-chrome.tsx:60`). A subtle top fade/border-on-scroll where content meets chrome would separate layers the Apple way (edge effect only when content actually overlaps).

## 3. Motion & interruption

- **Steady-state looping animation**: the `animate-ping` connection dot loops forever (`connection-status.tsx:50`). Apple explicitly warns against slow perpetual oscillations — they're both an attention leak and a vestibular trigger. Animate the *transition* to connected, then rest.
- **Theme switching is an abrupt brightness jump.** `theme-provider` swaps the `.dark` class instantly; Apple recommends easing large dark↔light changes. A ~200ms color-only transition on root color tokens (guarded so it only applies during a theme swap, not on every hover) softens the flash.
- **No `prefers-reduced-motion` support** (zero hits in `src-ui`). Reduced motion should swap zoom/slide entrances for cross-fades and stop the ping/spin decorations.
- **Resize grip isn't touch/pen capable** (`activity-feed.tsx` uses `mousemove`/`mouseup` on `document`). Pointer Events + `setPointerCapture` is the 1:1 direct-manipulation baseline.

## 4. Typography & legibility

- **Ad-hoc micro type scale.** `text-[11px]`, `text-[10px]`, `text-[0.8rem]` appear alongside `text-xs`/`text-sm` (`transfer-media.tsx:227,269,285`, `button.tsx:27`, `app-sidebar.tsx:273`). 10px on a desktop display is below comfortable legibility, and five near-identical sizes is hierarchy by accident. Consolidate: `text-xs` (12px) as the floor; build hierarchy with weight and color, not 1px size deltas.
- **Low-contrast small text**: `text-muted-foreground/80` at 10–11px ("Advanced" section labels, sub-descriptions in `transfer-media.tsx:269,285`) stacks two contrast reductions on the smallest type. Keep muted color OR small size, not both at once.
- **Headline treatment is right**: `text-2xl font-semibold tracking-tight` on page titles — correct negative-tracking-as-it-grows instinct. Inter Variable with system-ui fallback is fine for a cross-platform app; consider `-apple-system` first on macOS builds for optical-size tables.

## 5. Wayfinding, grouping & mapping

- **Status disguised as navigation.** The "Connected / Not connected" row is a disabled `SidebarMenuButton` inside the Device *menu* (`app-sidebar.tsx:324-349`) — a status lamp wearing a button costume. Proximity implies function: everything else in that list navigates. Move it to the sidebar footer or a status strip, styled as a read-only chip.
- **Whole-app lockout while a job runs.** Every nav item disables during any operation (`app-sidebar.tsx` `disabled={isRunning}`). The tooltip explains why (good), but "never trap the user" applies: users can't even open Settings or watch another page. Consider allowing navigation while the job panel persists (the Pixel context already lives above routes, so state survives navigation) — or at minimum leave Settings reachable.
- **Labels are direct and specific** ("Convert Media", "Split Folder", "Fix Dates", "Manage Device") — good familiarity/predictability. The BETA badge on Fix Dates sets expectations honestly.

## 6. Agency, forgiveness & responsibility

- **Destructive confirm done right**: insufficient-space push requires an explicit "Push anyway" through an AlertDialog with concrete numbers (`transfer-media.tsx:157-180`). This is the correct, sparing use of confirmation.
- **Dev-only, but**: `purgeLocalCache` shells out to `rm -rf "$dir"/*` with zero confirmation and a success toast (`manage-device.tsx:136-143`). Even behind `import.meta.env.DEV`, an unconfirmed recursive delete bound to a small button adjacent to "Cache" invites a slip. Add a confirm, or make it undoable (move to trash).
- **Web build shows a raw placeholder**: non-Tauri visitors land on a component that renders the literal text "IndexPage" (`routes/index.tsx:14`). Craft signal: replace with a minimal landing/redirect notice.

## 7. Craft details

- Focus-visible rings are consistently defined on Base-UI-backed controls — good keyboard support. The custom `ThemeToggle` buttons, however, are raw `<button>`s with no focus-visible style and no `aria-pressed`/radio semantics for the current theme; the segmented control is invisible to assistive tech (`theme-toggle.tsx:89-105`).
- The segmented-control highlight measures DOM rects on theme change only — a window resize (or font load) leaves the highlight misaligned until the next toggle.
- Empty states are consistent and instructive (dropzones explain drag-and-drop *and* offer a button — two paths, good agency).
- Update flow (`check → download w/ progress → install/restart`) with a single morphing toast is genuinely well-crafted feedback.

## Priority (Apple lens)

1. Press feedback on pointer-down (response is the foundation).
2. Reduced-motion + perpetual-ping fixes (safety/comfort).
3. Header material honesty (translucent or flat — not fake blur).
4. Type-scale consolidation & contrast floor.
5. Connection status out of the nav menu.
6. Navigation lockout softening.
