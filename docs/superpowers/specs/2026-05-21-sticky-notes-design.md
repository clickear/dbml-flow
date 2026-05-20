# Sticky Notes Design

**Goal:** Render DBML `Note` blocks as draggable canvas notes with editor/canvas navigation and lightweight markdown-style display.

**Architecture:** Parse `database.notes` into dedicated note nodes, extend source mapping so notes can be focused from the editor and vice versa, and render notes as a third canvas node type beside tables and groups. Notes stay outside automatic layout; initial placement is manual-friendly and later persistence reuses the existing saved-position flow.

**Tech Stack:** React Flow, Zustand, `@dbml/core`, Monaco source map helpers, existing saved-view/position storage.

---

## Context

The current app already parses DBML `Note` blocks through `@dbml/core`, but it does not render them on the canvas. The viewer currently supports tables, groups, refs, minimap, selection, and bidirectional navigation for tables/fields/groups/refs.

This feature adds a first-pass sticky note experience without changing automatic layout behavior.

## Behavior

- `Note note_1 { '...' }` renders as a sticky note node on the canvas.
- Notes are draggable and selectable.
- Notes are visible in the minimap.
- Notes are excluded from automatic layout.
- Notes are saved and restored with the existing saved-position flow.
- Double-clicking a note node in the canvas jumps the editor to the note declaration.
- Clicking a note declaration in the editor focuses the corresponding note node.
- Note content is rendered as plain text with lightweight markdown-style formatting:
  - paragraphs
  - headings
  - bullet lines
  - preserved line breaks

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

Attachment behavior:

- If a note is attached to a table or group, its initial placement is near that owner.
- Attached notes are hidden when their owner is hidden.
- Attached notes do not drag the owner with them.
- If attachment metadata is missing or invalid, the note behaves as a standalone note.

## Non-Goals

- Automatic note layout participation.
- Rich text editing UI or toolbar.
- Drag coupling between notes and their owner table/group.
- Note-to-note linking.

## Data Flow

1. `@dbml/core` parses `database.notes`.
2. The DBML-to-graph layer maps notes into note nodes.
3. The viewer registers a dedicated note node component.
4. The source-map layer maps note declarations to editor ranges.
5. Store actions handle selection, focus, saved positions, and hide/show behavior.

## Testing

- Parse a DBML `Note` block into a note node.
- Parse attachment metadata from the first content line.
- Resolve editor positions to note targets.
- Resolve note-node double-click back to the note declaration.
- Verify attached notes hide with their owner and remain draggable independently.

## Open Questions

- None for the first pass. If the markdown-lite rendering feels too dense, the body renderer can be simplified later without changing the data model.
