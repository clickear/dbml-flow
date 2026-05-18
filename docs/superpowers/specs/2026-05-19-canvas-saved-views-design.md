# Canvas Saved Views and Structure Drawer Design

## Goal

Add project-local saved canvas views and a right-side structure drawer to the DBML flow viewer.

Users can save multiple named canvas views, switch them from a compact select-like control, inspect the TableGroup/Table hierarchy in a collapsible right drawer, and hide groups or tables per saved view.

## User Experience

The viewer gets a right-side drawer that can be expanded or collapsed. When collapsed, it remains available as a narrow right-edge handle. The drawer must not replace the existing React Flow control buttons.

At the top of the drawer, show a compact saved-view selector. The selector chooses the active named view. Next to it, provide:

- `Save` to update the currently selected view with the current canvas state.
- `Save as` to create a new named view from the current canvas state.

The main drawer body shows a tree of the current DBML structure:

- TableGroups are displayed according to their nested group hierarchy.
- Tables inside groups appear under their group.
- Tables that do not belong to any TableGroup appear directly at the root level.
- TableGroups and Tables each show a hide/show icon.

Clicking a tree item selects and centers the matching canvas node. It does not jump the Monaco editor to source.

## Saved View Model

Saved views are stored only in browser localStorage. They are not written into DBML comments and are not encoded into the URL.

The view list is scoped to this project/application as one local list. It is not keyed by DBML content, URL, or browser tab session.

Each saved view stores:

- view id, name, created timestamp, updated timestamp
- React Flow viewport `{ x, y, zoom }`
- node positions
- folded node ids
- relation-only global state
- relation-only per-table overrides
- hidden node ids

Saved views do not store minimap state, selected nodes, selected edges, hover state, or transient field highlights.

When applying a view, any saved node id that no longer exists in the current DBML is ignored silently. Valid saved state is still applied.

## Hide/Show Behavior

The hide icon in the structure tree removes nodes from the rendered canvas:

- Hiding a Table hides that table and all edges connected to it.
- Hiding a TableGroup hides the group, all descendant TableGroups, all descendant Tables, and all edges connected to hidden Tables.
- Showing a hidden item removes that item from the hidden set. Descendants can become visible again unless hidden by another hidden ancestor.

Hidden state is part of the active saved view. Different saved views can hide different groups or tables.

Hiding is distinct from folding. Folding keeps a node on the canvas in a collapsed form; hiding removes it from the rendered canvas.

## Architecture

Add focused helper modules for saved-view serialization and structure-tree/visibility calculations. These helpers should be independent of React components and covered by unit tests.

The Zustand store owns:

- saved view list and active view id
- drawer open/closed state
- hidden node ids for the current active view
- actions to load, apply, save, create, and delete saved views
- actions to toggle hidden nodes and focus a tree item on the canvas

React Flow should keep the full parsed node and edge state in the store. Visibility filtering happens before passing nodes and edges to `<ReactFlow>`, so unhidden nodes can reuse their existing positions and group metadata.

The viewer component uses `useReactFlow().getViewport()` when saving a view and `setViewport()` when applying one.

## Testing

Add focused tests before implementation:

- saved view serialization/deserialization handles Set-backed fields as arrays
- structure tree places ungrouped tables at the root
- structure tree preserves nested TableGroup hierarchy
- hiding a TableGroup expands to all descendant groups and tables
- visible edge filtering removes edges connected to hidden nodes
- applying a saved view ignores missing node ids

Run TypeScript build after implementation.
