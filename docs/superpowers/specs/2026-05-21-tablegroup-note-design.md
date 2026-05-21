# TableGroup Note Design

## Context

The app already supports `table.note` in the canvas header by showing a note icon and exposing the content through a tooltip. `TableGroup` nodes support `color`, folding, nested groups, structure-tree visibility, and navigation, but group-level `note` content parsed by `@dbml/core` is not surfaced in the UI.

The goal of this increment is to bring `TableGroup` note behavior in line with `Table` note behavior without changing layout, source mapping, sticky-note handling, or saved-view state.

## Goal

Render DBML `TableGroup` notes in the group header as a note icon with tooltip content.

Supported DBML forms for this increment:

```dbml
TableGroup ecommerce [note: 'group note', color: #20B2AA] {
  orders
}
```

```dbml
TableGroup ecommerce {
  Note: 'group note'
  orders
}
```

## Recommended Approach

Reuse the existing header extension pattern already used by table nodes.

This means:

- keep `TableFoldHeader` as the common header component
- pass a note icon through its `afterTitle` slot from `table-group-node.tsx`
- add parsed `note` content to `GroupNodeData`
- render a tooltip beside the group label only when a note exists

This keeps the change local and aligned with existing table behavior.

## Behavior

- A `TableGroup` with a `note` shows a note icon in the group header.
- Hovering or focusing the note icon shows a tooltip with:
  - the group name
  - the note content
- A `TableGroup` without a `note` shows no note icon.
- Existing group fold/unfold behavior is unchanged.
- Existing group navigation and selection behavior is unchanged.
- The note remains purely informational; it does not create a sticky note node.

## Data Flow

1. `@dbml/core` parses the `TableGroup` note.
2. `parseDatabaseToGraph()` maps the `TableGroup` into a `GroupNodeType`.
3. `GroupNodeData` carries an optional `note` string.
4. `table-group-node.tsx` renders a note icon with tooltip when `data.note` is present.

## Implementation Scope

Files expected to change:

- `src/types/nodes.types.ts`
- `src/lib/dbml/node-dmbl.parser.ts`
- `src/components/table-group-node.tsx`
- one or more existing tooltip or header helper files if needed for reuse
- focused tests for parsing and rendering

## Non-Goals

- Converting `TableGroup` notes into sticky notes
- Adding note editing UI
- Changing layout or group bounds behavior
- Changing saved-view serialization
- Adding source-map ranges for group notes separately from the group declaration

## Testing

- Parse `TableGroup ... [note: '...']` into `GroupNodeData.note`.
- Parse `TableGroup { Note: '...' }` into `GroupNodeData.note`.
- Render the group note icon only when a note exists.
- Render the tooltip content with group name and note text.
- Confirm existing group rendering still works when no note exists.

## Risks

- `@dbml/core` may normalize group note access differently between inline setting and block `Note:` syntax. Tests should cover both forms before implementation.
- If the current table note icon/tooltip logic is overly table-specific, a small shared helper extraction may be needed. The change should still stay local to header rendering.
