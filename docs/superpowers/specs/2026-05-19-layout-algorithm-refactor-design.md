# Layout Algorithm Refactor Design

## Context

`docs/layout-algorithm-analysis.md` describes the layout behavior used by dbdiagram.io: graph-aware ELK layout for normal diagrams, compact column layout for large diagrams and fallback, and persisted user layout applied after automatic layout. The current app has a synchronous Dagre layout in `src/lib/layout/dagre.utils.ts`, a commented ELK experiment in `src/lib/layout/useElk.ts`, and layout orchestration embedded in `src/state/store.ts`.

The refactor will replace Dagre as the primary layout path with an ELK plus compact layout system. The main product rule is:

```text
Automatic layout provides a starting point; persisted user layout is authoritative until the user explicitly rearranges the diagram.
```

## Goals

- Support `leftright`, `snowflake`, and `compact` layout modes.
- Use ELK for graph-aware `leftright` and `snowflake` layouts.
- Use deterministic compact layout for large diagrams, ELK failure, and explicit compact mode.
- Preserve saved table positions during ordinary DBML edits.
- Append newly added tables below the existing saved layout instead of rearranging existing tables.
- Let the user-triggered rearrange action recompute the whole diagram and overwrite saved positions.
- Keep layout code isolated from Zustand store concerns.

## Non-Goals

- Persist custom reference paths. React Flow currently computes edge paths from node and handle positions.
- Add sticky notes. The app does not currently model sticky notes.
- Add collaboration state.
- Change table rendering, folding semantics, saved views, or structure tree behavior except where layout data must remain consistent.

## Architecture

The layout code will be split into focused modules:

- `src/lib/layout/layout.types.ts`
  Defines layout modes, layout reasons, layout input, layout result, and shared constants such as the large diagram threshold.

- `src/lib/layout/elk-layout.ts`
  Converts React Flow table/group nodes and edges into an ELK graph, runs `elk.layout`, and maps result coordinates back onto table nodes.

- `src/lib/layout/compact-layout.ts`
  Implements deterministic column placement. It groups ungrouped tables and each table group into separate blocks, then lays each block out in compact columns.

- `src/lib/layout/layout.orchestrator.ts`
  Selects the appropriate strategy, handles ELK fallback, overlays saved positions for ordinary updates, appends new nodes, and returns positioned table nodes.

- `src/lib/layout/layout.helpers.ts`
  Keeps `toNodeIndex` and `applySavedPositions`, and adds reusable helpers for position existence, saved-position bounds, and new-node detection.

`src/state/store.ts` will call the orchestrator instead of `getLayoutedGraph`. Store code remains responsible for parsing DBML, deriving groups and edges, bounding group nodes, saving positions, and fitting the viewport.

## Layout Modes

### LeftRight

`leftright` uses ELK layered layout. It is the default mode for diagrams with up to 100 tables when there are no saved positions.

Initial ELK options:

```ts
{
  "elk.algorithm": "layered",
  "elk.layered.spacing.baseValue": "40",
  "elk.spacing.componentComponent": "80",
  "elk.layered.spacing.edgeNodeBetweenLayers": "120",
  "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
  "elk.layered.mergeEdges": "true",
  "elk.layered.nodePlacement.strategy": "INTERACTIVE",
  "elk.layered.layering.strategy": "INTERACTIVE"
}
```

### Snowflake

`snowflake` uses ELK force layout. It is available as an explicit mode and is useful for star or warehouse schemas where highly connected tables should move toward the center.

Initial ELK options:

```ts
{
  "elk.algorithm": "force",
  "elk.spacing.nodeNode": "5",
  "elk.force.temperature": "0.001",
  "elk.force.iterations": "300"
}
```

### Compact

`compact` ignores graph topology and places tables in deterministic columns. It is used for:

- explicit compact mode;
- diagrams with more than 100 tables during automatic initialization;
- fallback when ELK fails.

## ELK Graph Conversion

Table nodes are converted with measured dimensions when present, otherwise `data.guessedDimensions`, `initialWidth`, and `initialHeight` are used. A small padding is added around table dimensions to match the reference behavior.

Field-level edges already carry `sourceHandle` and `targetHandle`. ELK ports are derived from table fields:

- source ports are placed on the east side;
- target ports are placed on the west side;
- port IDs use the same field IDs as React Flow handles;
- folded tables or folded groups use their node ID as a node-level port when the edge parser has collapsed an edge to that node.

For `snowflake`, field ports can be forced to the east side to match the reference behavior.

Reference direction is normalized before sending edges to ELK. When a relation has different endpoint cardinalities and the first side is many, the edge direction is reversed so layout flow tends to run from the one side to the many side.

Table groups become compound ELK nodes. Their child table IDs come from `GroupNodeData.nodeIds`, filtered to table nodes for ELK children. Group padding is set to keep the group header and inner spacing readable.

## Compact Layout

Compact layout places groups of tables in horizontal blocks:

1. ungrouped tables form the first block, if any;
2. each table group with member tables forms a subsequent block;
3. nested group child IDs are ignored for compact placement, while bounded group calculation still happens afterward in the existing group helper.

Inside each block:

- column count is `max(4, floor(sqrt(tableCount)))`;
- tables are distributed by index modulo column count;
- vertical gap is `50px`;
- horizontal gap between columns is `50px`;
- horizontal gap between blocks is `60px`;
- table dimensions use measured node dimensions first and guessed dimensions second.

The compact layout returns positioned table nodes only. Existing `getBoundedGroups` recalculates group positions and bounds from table positions.

## Persistence Behavior

Ordinary DBML updates follow this sequence:

1. parse DBML into table nodes, group nodes, and edges;
2. create a candidate layout using ELK or compact when needed;
3. apply saved positions for matching node IDs;
4. find new table nodes with no saved position;
5. append new nodes starting at `{ x: savedBounds.minX, y: savedBounds.maxY + 50 }`;
6. recalculate group bounds;
7. save the resulting table positions.

If there are no saved positions, all tables use the chosen automatic layout.

User-triggered rearrange follows a different path:

1. ignore saved positions for placement;
2. run the selected layout mode for all table nodes;
3. recalculate group bounds;
4. overwrite `savedPositions` and the DBML positions block.

This preserves manual layout during normal editing while making the explicit rearrange action authoritative.

## Store Integration

`AppState` will gain a `layoutMode` field with default `leftright`. The existing `onLayout(direction, fitView)` signature can be simplified in implementation to use the current mode, because the `direction` argument is currently unused.

`updateViewerFromDatabase` will call the orchestrator asynchronously. Since ELK is async, layout requests need a sequence guard:

- increment a layout request ID before starting async layout;
- when a result resolves, apply it only if it is still the newest request;
- fallback to compact when ELK throws.

This prevents stale ELK results from replacing newer parse results after rapid editor changes.

The first render `fitView` behavior remains in the viewer. User-triggered rearrange still calls `fitView` after nodes are updated.

## Controls

The current rearrange button can keep the existing single-click behavior initially. It will use `layoutMode` and perform full-layout overwrite behavior. A later UI change can expose mode selection, but the core layout API will support `leftright`, `snowflake`, and `compact` from the first refactor.

## Error Handling

- Invalid or empty node sets return the input nodes unchanged.
- ELK conversion skips edges whose endpoints cannot be represented.
- ELK failures are caught by the orchestrator and replaced with compact layout.
- The UI should not display a layout-specific error unless both ELK and compact placement fail, which should be treated as an unexpected programming error.

## Testing

Focused tests will cover pure behavior:

- `compact-layout`: deterministic columns, group block spacing, empty input.
- `layout.helpers`: saved-position bounds, new-node detection, saved-position overlay.
- `layout.orchestrator`: large-diagram strategy selection, saved position preservation, new-node append, explicit rearrange overwrite semantics, ELK failure fallback.
- `elk-layout`: graph conversion for table ports, collapsed node-level handles, group children, and relation direction normalization.

Verification commands:

```sh
npm run test:saved-views
npm run test:structure-tree
npm run test:flow
npm run build
```

Additional layout tests can be added as a new script if the implementation introduces a dedicated test file.
