# dbdiagram.io Layout Algorithm Analysis

This document summarizes the layout algorithm found in the bundled dbdiagram.io frontend assets under `assets/`.

The code inspected is minified/bundled, so function names such as `M$e`, `Eqe`, `_qe`, and `rJe` are generated names from the bundle. Code examples below are either short direct excerpts or readable reconstructions of the same logic.

## Source Files

- `main-CjTbEFd1.js`: contains the diagram renderer, layout orchestration, ELK integration, persistence state, and Konva rendering logic.
- `diagram-lL1j8iAB.js`: contains the Vue diagram page wrapper and passes visual state into the diagram renderer.

Important state passed into the diagram renderer:

```js
tablePositions
tableGroupCollapseStates
referencePaths
stickyNoteLayouts
detailLevel
visibleEntities
```

These values are the persisted layout/view state. They are restored after the diagram shapes are created.

## High-Level Flow

The diagram layout flow is:

1. Parse / normalize the DBML into `normalizedDatabase`.
2. Create Konva shapes for schemas, tables, fields, indexes, checks, refs, table groups, and sticky notes.
3. Run an initial layout:
   - small/medium diagrams use ELK, normally `LeftRight`;
   - large diagrams use the internal compact layout.
4. Apply persisted table positions, table group collapse states, sticky note layouts, and reference paths.
5. Focus / resize / update viewport.
6. Emit generated visual state back to Vue/store when users move tables, refs, sticky notes, or change view settings.

## Renderer Class

The core renderer class is created as `a2e`. It stores all diagram entities and Konva shapes:

```js
class DiagramRenderer {
  normalizedDatabase;
  shapes = new Map();
  schemas = new Map();
  tables = new Map();
  fields = new Map();
  refs = new Map();
  tableGroups = new Map();
  stickyNotes = new Map();

  stage;
  layers = [];

  detailLevel = "All";
  gridEnabling = false;
  snapPositions;
}
```

The real bundled class also includes selection, highlighting, mouse/collaboration state, color picker handlers, sticky note handlers, and diff mode support.

## Initialization

The renderer initializes the diagram through `initDiagram(tablePositions, groupStates, stickyLayouts, refPaths)`.

Readable reconstruction:

```js
async function initDiagram(tablePositions, groupStates, stickyLayouts, refPaths) {
  stage.hide();

  const isLarge = tableCount(normalizedDatabase) > 100;

  try {
    initSchemas();
    await initTables(isLarge);
    await initTableGroups(isLarge);
    await initReferences(isLarge);
    initStickyNotes();
  } catch {
    stage.show();
    setDiagramLoadingState(false);
  }

  if (isLarge) {
    await autoArrange("default", true);
  } else {
    await autoArrange(undefined, true); // defaults to leftright
  }

  if (tablePositions) updateTablePositions(tablePositions);
  if (stickyLayouts) updateStickyNoteLayouts(stickyLayouts);
  if (groupStates) updateTableGroupCollapseStates(groupStates);
  if (refPaths) updateReferencePaths(refPaths);

  if (tablePositions || groupStates || stickyLayouts || refPaths) {
    focus();
  }

  finalizeAndShow();
}
```

The threshold constant is:

```js
lBe = 100
```

So diagrams with more than 100 tables avoid the expensive ELK layout during initial render.

## Updating an Existing Diagram

When the normalized database changes, the renderer calls `updateDatabase(...)`.

Important behavior:

- The diagram is softly reset and rebuilt.
- Existing reference paths are saved in `prevDetailLevelRefPaths`.
- If there are no saved table positions, auto-arrange runs again.
- If positions exist, they are applied by table name + schema name.
- New tables without persisted positions are placed after the existing layout instead of disrupting the old layout.

Readable reconstruction:

```js
async function updateDatabase(database, detailLevel, tablePositions, groupStates, stickyLayouts, refPaths, displayFullTableIds) {
  softReset();
  prevDetailLevelRefPaths = generateReferencePaths();

  normalizedDatabase = database;
  this.detailLevel = detailLevel;
  this.displayFullTableIds = displayFullTableIds ?? [];

  initSchemas();
  await initTables(isVeryLarge);
  await initTableGroups(isVeryLarge);
  await initReferences(isVeryLarge);
  initStickyNotes();

  const noSavedPositions = !tablePositions || tablePositions.length === 0;
  if (tables.length > 0 && noSavedPositions) {
    await autoArrange(isVeryLarge ? "default" : undefined, true);
  }

  updateTablePositions(tablePositions);
  updateStickyNoteLayouts(stickyLayouts);

  const newTables = tablesNotFoundInSavedPositions();
  const bounds = boundsOfSavedTables(tablePositions);
  compactPlaceNewTables(newTables, bounds.minX, bounds.maxY + 50);

  updateTableGroupCollapseStates(groupStates);
  updateReferencePaths(refPaths);

  refreshVisibilityAndViewport();
}
```

## Detail Levels

Detail level changes alter which fields are rendered and therefore table heights and ref ports.

Supported values:

```js
{
  Tables: "Tables",
  Keys: "Keys",
  All: "All"
}
```

The field filtering logic is:

```js
function visibleFields(diagram, fields, forceFull = false) {
  if (!diagram.featuresToggle.detailLevelsEnabled || forceFull) return fields;

  switch (diagram.detailLevel) {
    case "Tables":
      return [];
    case "Keys":
      return fields.filter(field =>
        field.pk || field.endpointIds?.length || field.isComposite || fieldHasIndex(field)
      );
    default:
      return fields;
  }
}
```

When fields are hidden, the renderer may append a synthetic row:

```text
+N hidden field(s)
```

Clicking that row adds the table id to `displayFullTableIds` and rerenders that table with all fields.

## Table Shape Creation

Tables are rendered before layout because layout requires real widths and heights.

The initialization pass:

1. Creates indexes and checks.
2. Creates table header shapes.
3. Creates fields according to the current detail level.
4. Computes max field/header width.
5. Updates table border and shadow to match final dimensions.

Readable reconstruction:

```js
for (const rawTable of normalizedDatabase.tables) {
  const { table, tableShape } = createTable(diagram, rawTable);
  const border = createTableBorder(diagram, table);
  const shadow = createTableShadow(diagram, table);

  diagram.tables.set(table.id, table);
  diagram.shapes.set(table.id, tableShape);

  const rawFields = rawTable.fieldIds
    .map(id => normalizedDatabase.fields[id])
    .concat(compositeRelationshipFields(diagram, rawTable));

  const fields = visibleFields(diagram, rawFields, displayFullTableIds.includes(table.id));
  const fieldShapes = createFieldShapes(diagram, fields, table);

  const maxWidth = Math.max(...fieldShapes.map(s => s.width()), tableShape.width());

  layoutFieldsBelowHeader(fieldShapes, tableShape, maxWidth);
  tableShape.width(maxWidth + 50);
  border.size({ width: tableShape.width(), height: totalTableHeight });
  shadow.size({ width: tableShape.width(), height: totalTableHeight });
}
```

## Auto Arrange Modes

There are three exposed arrange modes:

```js
hS = {
  LeftRight: "leftright",
  Snowflake: "snowflake",
  Default: "default"
}
```

The UI labels are:

- LeftRight: arrange based on relationship direction.
- Snowflake: arrange highly connected tables near the center.
- Default / Compact: compact rectangle layout.

## Auto Arrange Orchestration

The main auto-arrange function is `M$e`.

Readable reconstruction:

```js
async function autoArrange(diagram, mode = "leftright", silent = false) {
  try {
    setDiagramLoadingState(true, "Arranging diagram", true);
    await sleep(10);

    diagram.selectManager.clearSelections();

    // Auto arrange resets custom ref routing.
    diagram.refs.forEach(ref => {
      const refShape = diagram.getShape(ref.id);
      refShape.checkPoints = [];
      refShape.isFirstEPCustom = false;
      refShape.isSecondEPCustom = false;
    });

    const tables = [...diagram.tables.values()];
    if (tables.length === 0) {
      centerViewport(diagram);
      return;
    }

    switch (mode) {
      case "leftright":
      case "snowflake": {
        const elkResult = await runElkLayout(diagram, mode);
        if (elkResult === "abort") {
          if (silent) compactLayout(diagram, tables);
        } else if (elkResult) {
          applyElkResult(diagram, elkResult);
          diagram.stage.batchDraw();
        } else {
          compactLayout(diagram, tables);
        }
        break;
      }
      case "default":
      default:
        compactLayout(diagram, tables);
    }
  } finally {
    setDiagramLoadingState(false);
  }
}
```

Important detail: `autoArrange` clears all custom reference line control points and endpoint side customizations.

## ELK Conversion

Before calling ELK, the renderer converts the diagram into an ELK graph.

Readable reconstruction of `_qe`:

```js
function toElkGraph(diagram, mode) {
  const looseChildren = [];
  const edges = [];
  const tableGroupNodes = new Map();

  if (diagram.tables.size === 0) return null;

  diagram.tables.forEach(table => {
    const tableNode = tableToElkNode(diagram, table, mode);
    if (!tableNode) return;

    if (!table.tableGroupId) {
      looseChildren.push(tableNode);
      return;
    }

    let groupNode = tableGroupNodes.get(table.tableGroupId);
    if (!groupNode) {
      const group = diagram.tableGroups.get(table.tableGroupId);
      if (!group) return;
      groupNode = tableGroupToElkNode(diagram, group);
      tableGroupNodes.set(table.tableGroupId, groupNode);
    }

    groupNode.children.push(tableNode);
  });

  diagram.refs.forEach(ref => {
    const edge = refToElkEdge(diagram, ref);
    if (edge) edges.push(edge);
  });

  diagram.stickyNotes.forEach(note => {
    const node = stickyNoteToElkNode(diagram, note);
    if (node) looseChildren.push(node);
  });

  return {
    id: "root",
    children: [...tableGroupNodes.values(), ...looseChildren],
    edges
  };
}
```

### Table ELK Node

Readable reconstruction of `vqe`:

```js
function tableToElkNode(diagram, table, mode) {
  const tableShape = diagram.getShape(table.id);
  if (!tableShape) return null;

  let width = tableShape.width();
  let height = tableShape.height();
  const ports = [];

  table.fieldIds.forEach(fieldId => {
    const { port, width: fieldWidth, height: fieldHeight } =
      fieldToElkPort(diagram, fieldId, height, mode);

    if (port) {
      width = Math.max(width, fieldWidth);
      height += fieldHeight;
      ports.push(port);
    }
  });

  return {
    id: table.id,
    ports,
    width: width + 2 * 3,
    height: height + 2 * 3,
    layoutOptions: {
      "elk.aspectRatio": "1.6f",
      "elk.alignment": "LEFT"
    }
  };
}
```

The `3px` padding is stored as `Ow = 3`.

### Field Ports

Readable reconstruction of `bqe`:

```js
function fieldToElkPort(diagram, fieldId, currentY, mode) {
  const shape = diagram.getShape(fieldId);
  if (!shape) return { port: null, width: 0, height: 0 };

  const height = shape.height();
  const width = shape.width();

  return {
    port: {
      id: fieldId,
      layoutOptions: mode === "snowflake"
        ? { "elk.port.side": "EAST" }
        : undefined,
      y: currentY + height / 2 + 3,
      x: width + 3
    },
    width,
    height
  };
}
```

### Table Group Nodes

Readable reconstruction of `yqe`:

```js
function tableGroupToElkNode(diagram, group) {
  return {
    id: group.id,
    children: [],
    layoutOptions: {
      "elk.aspectRatio": "1.6f",
      "elk.alignment": "LEFT",
      "elk.padding": "[top=30,left=30,bottom=30,right=30]"
    }
  };
}
```

### Reference Edges

Readable reconstruction of `xqe`:

```js
function refToElkEdge(diagram, ref) {
  const firstField = diagram.fields.get(ref.firstFieldId);
  const secondField = diagram.fields.get(ref.secondFieldId);
  if (!firstField || !secondField) return null;

  let source = ref.firstFieldId;
  let target = ref.secondFieldId;

  // If relation directions differ and the first side is many,
  // reverse the edge direction.
  if (ref.firstRelation !== ref.secondRelation && ref.firstRelation === "*") {
    source = ref.secondFieldId;
    target = ref.firstFieldId;
  }

  return {
    id: ref.id,
    sources: [source],
    targets: [target]
  };
}
```

### Sticky Note Nodes

Readable reconstruction of `Sqe`:

```js
function stickyNoteToElkNode(diagram, note) {
  const id = stickyNoteGroupId(note.name);
  const stored = diagram.stickyNotes.get(note.name);

  return stored
    ? { id, width: stored.config.width, height: stored.config.height }
    : null;
}
```

## ELK Layout Options

### LeftRight

The `LeftRight` mode uses ELK layered layout:

```js
layoutOptions = {
  "elk.algorithm": "layered",
  "elk.layered.spacing.baseValue": "40",
  "elk.spacing.componentComponent": "80",
  "elk.layered.spacing.edgeNodeBetweenLayers": "120",
  "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
  "elk.layered.mergeEdges": "true",
  "elk.layered.nodePlacement.strategy": "INTERACTIVE",
  "elk.layered.layering.strategy": "INTERACTIVE"
};
```

Notes:

- The code does not explicitly set `elk.direction = RIGHT`.
- Direction is mainly implied by source/target edge orientation.
- The layout tries to keep model order and edge order stable.
- Edge-node spacing between layers is large: `120`.

### Snowflake

The `Snowflake` mode uses ELK force layout:

```js
layoutOptions = {
  "elk.algorithm": "force",
  "elk.spacing.nodeNode": "5",
  "elk.force.temperature": "0.001",
  "elk.force.iterations": "300"
};
```

Notes:

- Field ports are forced to the `EAST` side.
- Highly connected tables tend to move toward the center.
- This is better for warehouse/star/snowflake schemas than lineage-style diagrams.

## ELK Execution

The renderer uses `elkjs` with a worker factory.

Readable reconstruction:

```js
function layoutWithElk(graph, abortSignal) {
  return new Promise((resolve, reject) => {
    if (abortSignal.aborted) {
      reject(abortSignal.reason);
      return;
    }

    const elk = new ELK({
      workerFactory: () => new ElkWorker()
    });

    abortSignal.addEventListener("abort", () => {
      elk.terminateWorker();
      reject("abort");
    });

    elk.layout(graph).then(resolve, reject);
  });
}
```

Only one ELK layout is allowed at a time:

```js
function abortCurrentElkLayout() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}
```

If ELK fails or returns null, the renderer falls back to the internal compact layout.

## Applying ELK Results

Readable reconstruction of `rJe`:

```js
function applyElkResult(diagram, root) {
  root.children?.forEach(child => {
    const id = child.id;

    if (child.children?.length) {
      child.children.forEach(tableNode => {
        applyTableNode(diagram, tableNode, child);
      });
      applyTableGroupNode(diagram, child);
      return;
    }

    switch (elementTypeFromId(id)) {
      case "table":
        applyTableNode(diagram, child);
        break;
      case "sticky-note":
        applyStickyNoteNode(diagram, child);
        break;
    }
  });
}
```

For tables inside a table group, the final table position is:

```js
{
  x: tableNode.x + groupNode.x,
  y: tableNode.y + groupNode.y
}
```

After moving a table, the renderer updates:

- table header
- table border / shadow
- field rows
- related references
- table group bounds, when applicable

## Compact / Default Layout

The internal compact layout is used:

- when mode is `default`;
- when ELK fails;
- when ELK is aborted during silent initialization;
- for large initial diagrams.

The compact layout does not analyze graph topology. It places tables in compact columns.

Readable reconstruction of `j$e`:

```js
function compactPlaceTables(diagram, tables, beginX = 0, beginY = 0) {
  if (!tables || tables.length === 0) return [];

  const columnCount = Math.max(4, Math.floor(Math.sqrt(tables.length)));
  const columns = Array(columnCount).fill(0).map(() => ({
    tables: [],
    x: beginX,
    width: 0
  }));

  tables.forEach((table, index) => {
    columns[index % columnCount].tables.push(table);
  });

  columns.forEach((column, index) => {
    if (index > 0) {
      const previous = columns[index - 1];
      column.x = previous.x + previous.width + 50;
    }

    let y = beginY;

    column.tables.forEach(table => {
      const shape = diagram.getShape(table.id);
      if (!shape) return;

      moveTable(diagram, table, { x: column.x, y }, true);
      shape.visible(true);
      showTableShadow(diagram, table);
      updateTableGroupForTable(diagram, table);
      updateRefsForTable(diagram, table);

      y += fullTableHeight(diagram, table.id) + 50;
      column.width = Math.max(column.width, shape.width());
    });
  });

  return columns;
}
```

The compact group orchestration (`P$e`) works like this:

```js
function compactLayoutTablesAndGroups(diagram, tables) {
  const groups = [];
  const ungrouped = [];

  tables.forEach(table => {
    if (!table.tableGroupId) ungrouped.push(table);
  });

  if (ungrouped.length > 0) groups.push(ungrouped);

  diagram.tableGroups.forEach(group => {
    const groupTables = group.tableIds
      .map(id => diagram.tables.get(id))
      .filter(Boolean);

    if (groupTables.length > 0) groups.push(groupTables);
  });

  let nextX = 0;
  let maxY = 0;

  groups.forEach(groupTables => {
    const columns = compactPlaceTables(diagram, groupTables, nextX);
    const lastColumn = columns[columns.length - 1];

    if (lastColumn) {
      nextX = lastColumn.x + lastColumn.width + 60;
    }

    columns.forEach(column => {
      const lastTable = column.tables[column.tables.length - 1];
      if (!lastTable) return;

      const shape = diagram.getShape(lastTable.id);
      if (!shape) return;

      maxY = Math.max(maxY, shape.y() + shape.height() + 50);
    });
  });

  return {
    nextBeginX: nextX,
    nextBeginY: maxY
  };
}
```

## Sticky Note Layout

Sticky notes are included in ELK as nodes, but the default fallback arranges them separately after tables.

Readable reconstruction of `UKe`:

```js
function compactPlaceStickyNotes(diagram, notes, beginX = 0, beginY = 0) {
  const maxColumns = 4;
  const columnCount = Math.max(maxColumns, Math.floor(Math.sqrt(notes.length)));

  const columns = Array(columnCount).fill(0).map(() => ({
    notes: [],
    x: beginX,
    width: 0
  }));

  notes.forEach((note, index) => {
    columns[index % columnCount].notes.push(note);
  });

  columns.forEach((column, index) => {
    if (index > 0) {
      const previous = columns[index - 1];
      column.x = previous.x + previous.width + 50;
    }

    let y = beginY;

    column.notes.forEach(note => {
      const groupShape = diagram.stickyNoteShapes.get(stickyNoteGroupId(note.name));
      groupShape?.setAttrs({ x: column.x, y });

      const stored = diagram.stickyNotes.get(note.name);
      stored.config.x = column.x;
      stored.config.y = y;

      y += note.config.height + 50;
      column.width = Math.max(column.width, note.config.width);
    });
  });

  const lastNonEmpty = [...columns].reverse().find(c => c.width !== 0);

  return {
    nextBeginX: lastNonEmpty ? lastNonEmpty.x + lastNonEmpty.width + 60 : 0,
    nextBeginY: 0
  };
}
```

Default sticky note dimensions:

```js
{
  width: 192,
  height: 192,
  minWidth: 160,
  minHeight: 80
}
```

## Persisted Table Positions

The renderer generates table positions like this:

```js
function generateTablePositions(roundToGrid = false) {
  return [...tables.values()].map(table => {
    const shape = getShape(table.id);
    const schemaName = schemas.get(String(table.schemaId))?.name || "public";

    return {
      name: table.tableName,
      schemaName,
      x: roundToGrid ? snapToGrid(shape.x()) : shape.x(),
      y: roundToGrid ? snapToGrid(shape.y()) : shape.y()
    };
  });
}
```

Applying saved positions matches by `schemaName.name`:

```js
function updateTablePositions(diagram, positions) {
  const normalizedPositions = positions.map(p => ({
    schemaName: p.schemaName || "public",
    name: p.name,
    x: p.x,
    y: p.y
  }));

  const byKey = keyBy(normalizedPositions, p => `${p.schemaName}.${p.name}`);

  for (const table of diagram.tables.values()) {
    const schemaName = diagram.schemas.get(table.schemaId)?.name || "public";
    const saved = byKey[`${schemaName}.${table.tableName}`];
    if (!saved) continue;

    if (saved.x == null || Number.isNaN(saved.x)) continue;
    if (saved.y == null || Number.isNaN(saved.y)) continue;

    moveTable(diagram, table, { x: saved.x, y: saved.y }, true);
    updateTableGroupForTable(diagram, table);
    updateRefsForTable(diagram, table);
  }
}
```

## New Tables After Existing Layout

When a DBML update adds new tables, the renderer does not rerun layout if existing positions are available.

Instead, it calculates the bounds of saved-position tables:

```js
function boundsOfSavedTables(diagram, positions) {
  if (!positions || positions.length === 0) {
    return { maxX: 0, maxY: 0, minX: 0, minY: 0 };
  }

  // Match table by schemaName + tableName and calculate min/max
}
```

Then it places new tables starting at:

```js
{
  x: existingBounds.minX,
  y: existingBounds.maxY + 50
}
```

Sticky notes without saved layouts are then placed to the right of that new table block.

## Reference Path Persistence

Reference paths are generated with:

```js
function generateReferencePaths() {
  return [...refs.values()].map(ref => {
    const endpointInfo = describeRefEndpoints(ref);
    const shape = shapes.get(ref.id);

    return {
      ...endpointInfo,
      firstEndpointSide: shape.isFirstEPCustom ? shape.firstEPSide : undefined,
      secondEndpointSide: shape.isSecondEPCustom ? shape.secondEPSide : undefined,
      checkPoints: shape.checkPoints
    };
  });
}
```

The endpoint identity includes:

```js
firstFieldNames
firstTableName
firstSchemaName
firstRelation
secondFieldNames
secondTableName
secondSchemaName
secondRelation
```

When paths are restored, refs are matched by endpoint identity. The code also checks the reversed endpoint order so saved paths still match when the ref direction is reversed.

Readable reconstruction:

```js
function updateReferencePaths(diagram, savedPaths) {
  const refs = [...diagram.refs.values()];

  const matchedRefs = intersectionWith(refs, savedPaths, sameEndpointIdentity);
  const savedByForwardKey = keyBy(savedPaths, pathIdentityKey);

  matchedRefs.forEach(ref => {
    const forwardKey = pathIdentityKey(describeRefEndpoints(ref));
    const reverseKey = reversePathIdentityKey(describeRefEndpoints(ref));
    const shape = diagram.shapes.get(ref.id);

    if (savedByForwardKey[forwardKey]) {
      const saved = savedByForwardKey[forwardKey];
      if (!pathChanged(shape, saved)) return;

      shape.checkPoints = saved.checkPoints.map(p => point(p.x, p.y));
      shape.isFirstEPCustom = !!saved.firstEndpointSide;
      shape.isSecondEPCustom = !!saved.secondEndpointSide;
      updateEndpointSides(ref, saved.firstEndpointSide, saved.secondEndpointSide);
    } else if (savedByForwardKey[reverseKey]) {
      const saved = cloneDeep(savedByForwardKey[reverseKey]);
      saved.checkPoints.reverse();

      if (!pathChanged(shape, saved)) return;

      shape.checkPoints = saved.checkPoints.map(p => point(p.x, p.y));
      shape.isFirstEPCustom = !!saved.secondEndpointSide;
      shape.isSecondEPCustom = !!saved.firstEndpointSide;
      updateEndpointSides(ref, saved.secondEndpointSide, saved.firstEndpointSide);
    }
  });
}
```

## Grid and Snapping

The grid size is `8px`:

```js
TS = 8;
snapToGrid = value => Math.round(value / TS) * TS;
```

Snapping applies to:

- tables
- table groups
- sticky notes
- ref control points

The renderer builds snap candidates from:

- all tables
- table groups
- sticky notes

Each snap candidate includes:

```js
{
  shape,
  left,
  top,
  right,
  bottom,
  middleX,
  middleY
}
```

During drag, the renderer checks nearest left/top/right/bottom/middle values and draws snap lines. If grid is enabled, positions are rounded to the nearest 8px.

## Viewport and Focus

The renderer computes diagram bounds using all visible tables, table groups, refs, and sticky notes.

When focusing the whole diagram, it calculates a scale:

```js
scale = min(
  (stageWidth - rightSidebarWidth) / (diagramBounds.width + 50),
  (stageHeight - controllerBarHeight - 50) / diagramBounds.height,
  1
);
```

Then it centers the bounding box in the available viewport.

Specific focus targets are also supported:

- table
- table group
- ref
- sticky note

## Persistence Surface

The renderer exposes:

```js
generateDiagramVizData() {
  return {
    tablePositions: generateTablePositions(),
    tableGroupCollapseStates: generateTableGroupCollapseStates(),
    stickyNoteLayouts: generateStickyNoteLayouts(),
    referencePaths: generateReferencePaths()
  };
}
```

Events from the renderer are emitted back to Vue/store:

```js
onTableMoved
onRefMoved
onTableGroupCollapsed
onStickyNoteLayoutChanged
onViewportStateChanged
```

The outer Vue/store layer writes these into:

- default diagram view state
- named diagram views
- collaborative Yjs maps, when collaboration is enabled
- dbdocs project state, when running inside dbdocs

## Collaboration State

When collaboration is active, visual state is mirrored through Yjs maps:

```js
yDoc.getMap("positions")
yDoc.getMap("groups")
yDoc.getMap("refs")
yDoc.getMap("configs")
yDoc.getMap("stickyNoteLayouts")
yDoc.getMap("visibleEntities")
yDoc.getMap("diagramViews")
```

The collaboration binding observes changes and calls:

```js
setTablePositions
setTableGroupCollapsedStates
setReferencePaths
setDetailLevel
setStickyNoteLayouts
setVisibleEntities
setView
```

## Important Behavioral Details

### Manual Layout Wins

Persisted `tablePositions`, `referencePaths`, and `stickyNoteLayouts` are applied after initial layout. This means saved user edits override auto layout.

### Auto Arrange Resets Ref Edits

Calling auto arrange clears:

```js
refShape.checkPoints = [];
refShape.isFirstEPCustom = false;
refShape.isSecondEPCustom = false;
```

So manually adjusted reference paths are lost after auto arrange.

### Large Diagrams Prefer Speed

Initial render uses:

```js
tableCount > 100 ? "default" : "leftright"
```

For very large updates, the stage is temporarily hidden while the diagram is rebuilt.

### Compact Layout Ignores Relationships

The compact/default mode is deterministic and fast, but it does not consider ref topology. It only groups tables by table group and lays them out in columns.

### ELK Uses Field Ports

Refs connect field ports, not table centers. This is why table height and visible fields matter before layout.

### Detail Level Can Invalidate Ref Paths

When switching to `Tables` detail level, refs may collapse from field-level refs into table-level refs. The code keeps `prevDetailLevelRefPaths` to merge compatible previous paths where possible.

## Practical Summary

The renderer combines two layout strategies:

- **ELK layered / force** for graph-aware layout.
- **Internal compact grid layout** for speed and fallback.

The system is designed for an editor rather than a pure diagram generator. Its most important rule is:

```text
auto layout provides a starting point; persisted user layout is authoritative.
```

This explains why the code first creates and auto-arranges shapes, then reapplies saved visual state, and why new tables are appended around the existing layout instead of triggering a full rearrangement.

