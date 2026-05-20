# Layout Mode Picker Design

## Context

The layout refactor already supports `leftright`, `snowflake`, and `compact` through `layoutMode` and `setLayoutMode` in `src/state/store.ts`. The canvas controls still expose only one rearrange button in `src/components/controls/rearrange-button.tsx`, so users cannot choose which layout algorithm to apply.

There is also an uncommitted width-sizing fix in progress for long dictionary field types. This picker design should not alter that sizing work.

## Goal

Expose layout selection directly from the existing rearrange control and make `compact` the default layout mode.

## Behavior

- The default layout mode is `compact`.
- The current magic-wand rearrange button becomes an expandable layout control.
- Initial state shows only the magic-wand button in the React Flow controls row.
- Clicking the magic-wand button expands three inline choices beside it:
  - `LR` for `leftright`;
  - `Snowflake` or a snowflake icon for `snowflake`;
  - `Compact` or a grid icon for `compact`.
- Clicking one choice:
  - sets `layoutMode` to that mode;
  - immediately calls `onLayout(fitView)` to rearrange using that mode;
  - collapses the inline choices.
- Clicking the magic-wand button again while expanded collapses the choices without changing layout.
- The active/default mode is visually indicated, with `compact` active on first load.

## UI Design

Use the current React Flow `<Controls>` area. Keep the interaction lightweight and local to `RearrangeButton`.

Recommended button sequence when expanded:

```text
[magic wand] [LR] [Snowflake] [Compact]
```

Implementation can use lucide icons where they are clearer:

- magic wand: existing `WandSparkles`;
- snowflake: `Snowflake`;
- compact: `Grid2X2` or another existing grid icon;
- left-right: short text `LR`, because it is more concise than a generic arrow icon.

Each option should have `aria-label` and `title` text:

- `Apply left-right layout`
- `Apply snowflake layout`
- `Apply compact layout`

The labels may be compact visually, but the accessible names must be explicit.

## State And Data Flow

`DEFAULT_LAYOUT_MODE` changes from `leftright` to `compact` in `src/lib/layout/layout.types.ts`.

`RearrangeButton` reads:

- `layoutMode`
- `setLayoutMode`
- `onLayout`

The component owns only the transient expanded/collapsed UI state. The selected persistent mode remains in Zustand.

No saved-view persistence is added for `layoutMode` in this change. Saved views persist positions and visibility state; layout mode is treated as the next algorithm to apply, not part of a view snapshot.

## Error Handling

No new error surface is required. Layout application continues through the existing `onLayout` path, which delegates to the layout orchestrator. If ELK fails for `leftright` or `snowflake`, the orchestrator falls back to compact layout.

## Testing

Add focused tests for pure behavior where practical:

- `DEFAULT_LAYOUT_MODE` is `compact`.
- Applying each mode through a small helper sets mode before invoking layout.

If component testing infrastructure is not present, keep the UI code simple and verify through:

- `npm run test:layout`
- `npm run build`

Also run the in-progress dictionary width regression test if that work remains uncommitted:

- `npm run test:dbml-math`
