# Sticky Notes Design

**Goal:** Render DBML `Note` blocks as draggable canvas notes with editor/canvas navigation, fold/expand behavior, attached-top owner bars, and lightweight markdown-style display.

**Architecture:** Parse `database.notes` into dedicated note nodes, extend source mapping so notes can be focused from the editor and vice versa, and render notes as a third canvas node type beside tables and groups. Notes stay outside automatic layout; attached notes default to a folded bar anchored above their owner, while expanded notes still reuse the existing saved-position flow as floating nodes.

**Tech Stack:** React Flow, Zustand, `@dbml/core`, Monaco source map helpers, existing saved-view/position storage.

---

## Context

The current app already parses DBML `Note` blocks through `@dbml/core`, but it does not render them on the canvas. The viewer currently supports tables, groups, refs, minimap, selection, and bidirectional navigation for tables/fields/groups/refs.

This feature adds a sticky note experience without changing automatic layout behavior. Notes remain independent nodes, but attached notes should default to a predictable folded header above the owner instead of choosing between left/right/docked fallback positions.

## Behavior

- `Note note_1 { '...' }` renders as a sticky note node on the canvas.
- Notes are draggable and selectable.
- Notes are visible in the minimap.
- Notes are excluded from automatic layout.
- Notes are saved and restored with the existing saved-position flow.
- Notes support fold and expand.
- Double-clicking a note node in the canvas jumps the editor to the note declaration.
- Clicking a note declaration in the editor focuses the corresponding note node.
- Note content is rendered as plain text with lightweight markdown-style formatting:
  - paragraphs
  - headings
  - bullet lines
  - preserved line breaks

## Note Visual States

Notes use three visible states:

- `expanded-floating`
  - full sticky note card
  - title plus rendered body
  - draggable
- `folded-attached-top`
  - attached note default state
  - rendered as a title bar above the owner
  - title only
  - anchored to owner position and width rules
- `folded-floating`
  - optional folded state for unattached notes or explicitly floating notes
  - rendered as a compact floating title bar
  - draggable

State transitions:

- attached note initial placement:
  - always `folded-attached-top`
- user expands an attached top bar:
  - `expanded-floating`
  - placed beside the owner, preferring right side and then left side
- user collapses an expanded attached note:
  - returns to `folded-attached-top`
- unattached floating note may use `folded-floating`
- saved folded state and attached ownership override generic floating restoration rules

## Attached Note Placement

Attachment behavior:

- If a note is attached to a table or group, its initial placement is `folded-attached-top`.
- `table` attachments:
  - attached top bar width matches the table width
  - x aligns with the table left edge
  - y sits just above the table top edge
- `tableGroup` attachments:
  - attached top bar sits above the group top edge
  - width is capped to a reasonable maximum instead of spanning the whole group
  - default alignment is the group left edge
- Expanding an attached top bar converts it into `expanded-floating`.
- Expanded attached notes prefer owner right side first, then left side.
- Collapsing an expanded attached note always returns it to the attached top bar state.
- Attached notes are hidden when their owner is hidden.
- Attached notes do not drag the owner with them.
- If attachment metadata is missing or invalid, the note behaves as a standalone note.

## Note Metadata

The first line of the note content may optionally define attachment metadata:

```dbml
Note note_orders {
  '@attach table:ecommerce.orders\n# Orders summary\n- pending review'
}
```

Supported attachment targets:

- `table:<table-id>`
- `group:<group-id>`

## Non-Goals

- Automatic note layout participation.
- Rich text editing UI or toolbar.
- Drag coupling between notes and their owner table/group.
- Note-to-note linking.
- General collision-avoidance layout between notes and arbitrary nearby nodes.
- Keeping attached notes expanded in-place above the owner.

## Data Flow

1. `@dbml/core` parses `database.notes`.
2. The DBML-to-graph layer maps notes into note nodes.
3. The viewer registers a dedicated note node component.
4. The source-map layer maps note declarations to editor ranges.
5. Store actions handle selection, focus, folded state, saved positions, and hide/show behavior.

## Testing

- Parse a DBML `Note` block into a note node.
- Parse attachment metadata from the first content line.
- Resolve editor positions to note targets.
- Resolve note-node double-click back to the note declaration.
- Verify attached notes hide with their owner and remain draggable independently.
- Verify note fold and expand state transitions.
- Verify attached notes default to `folded-attached-top`.
- Verify table-attached top bars match table width.
- Verify group-attached top bars use capped width.
- Verify expanding an attached top bar restores a floating note beside the owner.
- Verify collapsing an expanded attached note returns it to the owner top bar.

## Open Questions

- None for this increment. If attached top bars need stacking, batching, or group-level compaction later, that should be handled as a separate pass.
