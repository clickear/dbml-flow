# Composite Foreign Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support DBML composite foreign keys as one edge with a composite-relationship row in both participating tables, including grouped hover, highlight, and editor navigation.

**Architecture:** Extend the existing edge model so one relationship edge can carry grouped source and target field ids while still preserving current single-field behavior. Add a derived composite-row block to table nodes, then thread grouped relationship membership through field highlighting and edge/source-map selection logic instead of inventing a separate relation graph.

**Tech Stack:** TypeScript, React 19, React Flow, Zustand, `@dbml/core`, Monaco source-map helpers, esbuild, Node test runner.

---

### Task 1: Extend Edge Parsing For Composite Endpoint Groups

**Files:**
- Modify: `src/types/nodes.types.ts`
- Modify: `src/lib/dbml/edge-dbml.parser.ts`
- Create: `src/lib/dbml/edge-dbml.parser.test.ts`

- [ ] **Step 1: Write the failing composite edge parser tests**

Create `src/lib/dbml/edge-dbml.parser.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { Parser } from "@dbml/core";

import { mapDatabaseToEdges } from "./edge-dbml.parser";

const parser = new Parser();

test("maps a composite foreign key into one edge with grouped field ids", () => {
  const database = parser.parse(
    `
Table ecommerce.merchants {
  id int
  country_code int
  Indexes {
    (id, country_code) [pk]
  }
}

Table ecommerce.merchant_periods {
  merchant_id int
  country_code int
}

Ref: ecommerce.merchant_periods.(merchant_id, country_code) > ecommerce.merchants.(id, country_code)
`,
    "dbmlv2",
  );

  const edges = mapDatabaseToEdges(database, new Set());

  assert.equal(edges.length, 1);
  assert.equal(edges[0]?.data.isComposite, true);
  assert.deepEqual(edges[0]?.data.sourceFieldIds, [
    "f-ecommerce.merchant_periods.merchant_id",
    "f-ecommerce.merchant_periods.country_code",
  ]);
  assert.deepEqual(edges[0]?.data.targetFieldIds, [
    "f-ecommerce.merchants.id",
    "f-ecommerce.merchants.country_code",
  ]);
});

test("keeps single-column refs compatible with the existing edge data fields", () => {
  const database = parser.parse(
    `
Table users {
  id int [pk]
}

Table orders {
  user_id int
}

Ref: orders.user_id > users.id
`,
    "dbmlv2",
  );

  const edges = mapDatabaseToEdges(database, new Set());

  assert.equal(edges.length, 1);
  assert.equal(edges[0]?.data.isComposite, false);
  assert.equal(edges[0]?.data.sourcefieldId, "f-public.orders.user_id");
  assert.equal(edges[0]?.data.targetfieldId, "f-public.users.id");
  assert.deepEqual(edges[0]?.data.sourceFieldIds, ["f-public.orders.user_id"]);
  assert.deepEqual(edges[0]?.data.targetFieldIds, ["f-public.users.id"]);
});
```

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/edge-dbml.parser.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-edge-dbml-parser.test.mjs && node --test /tmp/dbml-flow-edge-dbml-parser.test.mjs
```

Expected: FAIL because edge data does not expose grouped field ids yet.

- [ ] **Step 2: Extend the table edge data type**

Update `src/types/nodes.types.ts`:

```ts
export type TableEdgeData = {
  sourcefieldId: string;
  targetfieldId: string;
  sourceFieldIds: string[];
  targetFieldIds: string[];
  isComposite: boolean;
  ref: Ref;
  sourceRelationType: ERRelationTypes;
  targetRelationType: ERRelationTypes;
};
```

- [ ] **Step 3: Parse grouped endpoint field ids**

Update `src/lib/dbml/edge-dbml.parser.ts` so `mapToEdge()` derives all endpoint fields:

```ts
  const sourceFields = sourceEndPoint.fields;
  const targetFields = targetEndPoint.fields;
  const sourceField = sourceFields[0]!;
  const targetField = targetFields[0]!;
  const sourceFieldIds = sourceFields.map((field) => getFieldId(field)!);
  const targetFieldIds = targetFields.map((field) => getFieldId(field)!);
  const sourcefieldId = sourceFieldIds[0]!;
  const targetfieldId = targetFieldIds[0]!;
  const isComposite = sourceFieldIds.length > 1 || targetFieldIds.length > 1;
```

Then store the grouped ids in `data`:

```ts
    data: {
      sourcefieldId,
      targetfieldId,
      sourceFieldIds,
      targetFieldIds,
      isComposite,
      ref,
      sourceRelationType,
      targetRelationType,
      sourceFolded,
      targetFolded,
    },
```

- [ ] **Step 4: Run the edge parser tests to verify they pass**

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/edge-dbml.parser.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-edge-dbml-parser.test.mjs && node --test /tmp/dbml-flow-edge-dbml-parser.test.mjs
```

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit the parser slice**

```bash
git add src/types/nodes.types.ts src/lib/dbml/edge-dbml.parser.ts src/lib/dbml/edge-dbml.parser.test.ts
git commit -m "feat: parse composite foreign key edge groups"
```

### Task 2: Add Composite Relationship Row Derivation And Width Support

**Files:**
- Create: `src/lib/dbml/composite-relations.ts`
- Create: `src/lib/dbml/composite-relations.test.ts`
- Modify: `src/lib/dbml/dbml.math.ts`
- Modify: `src/lib/dbml/dbml.math.test.ts`
- Modify: `src/components/table-node.tsx`

- [ ] **Step 1: Write failing composite row derivation and width tests**

Create `src/lib/dbml/composite-relations.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { getCompositeRowsForTable } from "./composite-relations";

const compositeEdge = {
  id: "ref-1",
  data: {
    isComposite: true,
    sourceFieldIds: [
      "f-ecommerce.merchant_periods.merchant_id",
      "f-ecommerce.merchant_periods.country_code",
    ],
    targetFieldIds: [
      "f-ecommerce.merchants.id",
      "f-ecommerce.merchants.country_code",
    ],
    sourcefieldId: "f-ecommerce.merchant_periods.merchant_id",
    targetfieldId: "f-ecommerce.merchants.id",
    ref: {
      endpoints: [
        { tableName: "merchant_periods" },
        { tableName: "merchants" },
      ],
    },
  },
} as const;

test("derives one composite row for the source table", () => {
  const rows = getCompositeRowsForTable("t-ecommerce.merchant_periods", [compositeEdge as never]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.label, "(merchant_id, country_code)");
  assert.equal(rows[0]?.edgeId, "ref-1");
});

test("derives one composite row for the target table", () => {
  const rows = getCompositeRowsForTable("t-ecommerce.merchants", [compositeEdge as never]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.label, "(id, country_code)");
  assert.equal(rows[0]?.edgeId, "ref-1");
});
```

Append to `src/lib/dbml/dbml.math.test.ts`:

```ts
test("expands table width for composite relationship row labels", () => {
  installTextMeasurementStub();
  const table = tableWithFieldType("int");
  table.name = "merchant_periods";
  (table as unknown as { compositeRelationLabels?: string[] }).compositeRelationLabels = [
    "(merchant_id, country_code)",
  ];

  assert.ok(findClosestSize(table).width >= 250);
});
```

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/composite-relations.test.ts src/lib/dbml/dbml.math.test.ts --bundle --platform=node --format=esm --outdir=/tmp/dbml-flow-composite-dbml-tests && node --test /tmp/dbml-flow-composite-dbml-tests/*.js
```

Expected: FAIL because the helper and width support do not exist yet.

- [ ] **Step 2: Add a focused composite relation derivation helper**

Create `src/lib/dbml/composite-relations.ts`:

```ts
import type { TableEdgeType } from "@/types/nodes.types";

export type CompositeRelationRow = {
  id: string;
  edgeId: string;
  label: string;
  localFieldIds: string[];
  remoteTableName: string;
  fieldPairs: Array<{ local: string; remote: string }>;
};

export function getCompositeRowsForTable(
  tableId: string,
  edges: TableEdgeType[],
): CompositeRelationRow[] {
  return edges
    .filter((edge) => edge.data?.isComposite)
    .flatMap((edge) => {
      const data = edge.data!;
      if (edge.source === tableId) {
        return [buildRow(edge.id, tableId, data.sourceFieldIds, data.targetFieldIds, edge.target)];
      }
      if (edge.target === tableId) {
        return [buildRow(edge.id, tableId, data.targetFieldIds, data.sourceFieldIds, edge.source)];
      }
      return [];
    });
}

function buildRow(
  edgeId: string,
  tableId: string,
  localFieldIds: string[],
  remoteFieldIds: string[],
  remoteTableId: string,
): CompositeRelationRow {
  const localNames = localFieldIds.map(getFieldNameFromId);
  const remoteNames = remoteFieldIds.map(getFieldNameFromId);

  return {
    id: `cr-${tableId}-${edgeId}`,
    edgeId,
    label: `(${localNames.join(", ")})`,
    localFieldIds,
    remoteTableName: getTableNameFromId(remoteTableId),
    fieldPairs: localNames.map((local, index) => ({
      local,
      remote: remoteNames[index] ?? "",
    })),
  };
}

function getFieldNameFromId(fieldId: string) {
  return fieldId.split(".").at(-1) ?? fieldId;
}

function getTableNameFromId(tableId: string) {
  return tableId.split(".").at(-1) ?? tableId;
}
```

- [ ] **Step 3: Include composite row labels in width calculation**

Update `src/lib/dbml/dbml.math.ts`:

```ts
type TableWithCompositeLabels = Table & {
  compositeRelationLabels?: string[];
};
```

Add:

```ts
function getCompositeRowWidth(table: TableWithCompositeLabels): number {
  return Math.max(
    0,
    ...(table.compositeRelationLabels ?? []).map((label) =>
      getTextWidth(label, FIELD_FONT) + INLINE_PADDING * 2 + FIELD_BORDER * 2,
    ),
  );
}
```

Then update `getContentWidth()`:

```ts
function getContentWidth(table: TableWithCompositeLabels) {
  return Math.max(
    getFieldRowWidth(table),
    getHeaderRowWidth(table),
    getCompositeRowWidth(table),
  );
}
```

- [ ] **Step 4: Thread composite labels into table sizing**

Update `src/components/table-node.tsx` before `BaseNode` render:

```tsx
  const compositeRows = useMemo(
    () => getCompositeRowsForTable(id, useStore.getState().edges as TableEdgeType[]),
    [id, useStore((s) => s.edges)],
  );
```

Then use a sizing table wrapper when computing width-sensitive data:

```tsx
  const sizingTable = {
    ...data.table,
    compositeRelationLabels: compositeRows.map((row) => row.label),
  };
```

and replace width references:

```tsx
          width: findClosestSize(sizingTable).width,
```

Expected result: table width accounts for the extra row labels.

- [ ] **Step 5: Run the derivation and width tests to verify they pass**

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/composite-relations.test.ts src/lib/dbml/dbml.math.test.ts --bundle --platform=node --format=esm --outdir=/tmp/dbml-flow-composite-dbml-tests && node --test /tmp/dbml-flow-composite-dbml-tests/*.js
```

Expected: PASS.

- [ ] **Step 6: Commit the derivation and width slice**

```bash
git add src/lib/dbml/composite-relations.ts src/lib/dbml/composite-relations.test.ts src/lib/dbml/dbml.math.ts src/lib/dbml/dbml.math.test.ts src/components/table-node.tsx
git commit -m "feat: add composite relation rows"
```

### Task 3: Render Composite Relationship Rows And Grouped Hover Behavior

**Files:**
- Create: `src/components/table-composite-relations.tsx`
- Create: `src/components/table-composite-relations.test.tsx`
- Modify: `src/components/table-node-field.helpers.ts`
- Modify: `src/components/table-node-field.helpers.test.ts`
- Modify: `src/components/table-node.tsx`

- [ ] **Step 1: Write failing grouped hover tests**

Append to `src/components/table-node-field.helpers.test.ts`:

```ts
test("fields become active when they belong to a hovered composite edge", () => {
  const edges = [
    {
      id: "composite-edge",
      data: {
        sourcefieldId: "f-ecommerce.merchant_periods.merchant_id",
        targetfieldId: "f-ecommerce.merchants.id",
        sourceFieldIds: [
          "f-ecommerce.merchant_periods.merchant_id",
          "f-ecommerce.merchant_periods.country_code",
        ],
        targetFieldIds: [
          "f-ecommerce.merchants.id",
          "f-ecommerce.merchants.country_code",
        ],
        isComposite: true,
      },
    },
  ];

  assert.equal(
    isFieldConnectedToHoveredEdge(
      "f-ecommerce.merchant_periods.country_code",
      edges,
      "composite-edge",
    ),
    true,
  );
});
```

Create `src/components/table-composite-relations.test.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TableCompositeRelations } from "./table-composite-relations";

test("renders composite relationship rows with grouped labels", () => {
  const html = renderToStaticMarkup(
    <TableCompositeRelations
      rows={[
        {
          id: "cr-t-ecommerce.merchant_periods-ref-1",
          edgeId: "ref-1",
          label: "(merchant_id, country_code)",
          localFieldIds: [
            "f-ecommerce.merchant_periods.merchant_id",
            "f-ecommerce.merchant_periods.country_code",
          ],
          remoteTableName: "merchants",
          fieldPairs: [
            { local: "merchant_id", remote: "id" },
            { local: "country_code", remote: "country_code" },
          ],
        },
      ]}
    />,
  );

  assert.match(html, /\(merchant_id, country_code\)/);
  assert.match(html, /Composite FK -&gt; merchants/);
});
```

Run:

```sh
./node_modules/.bin/esbuild src/components/table-node-field.helpers.test.ts src/components/table-composite-relations.test.tsx --bundle --platform=node --format=cjs --outdir=/tmp/dbml-flow-composite-ui-tests && node --test /tmp/dbml-flow-composite-ui-tests/*.js
```

Expected: FAIL because grouped hover and the composite row component do not exist yet.

- [ ] **Step 2: Expand hovered-edge membership checks to grouped ids**

Update `src/components/table-node-field.helpers.ts`:

```ts
type EdgeFieldLike = {
  id: string;
  data?: {
    sourcefieldId?: string;
    targetfieldId?: string;
    sourceFieldIds?: string[];
    targetFieldIds?: string[];
  };
};
```

Then update `isFieldConnectedToHoveredEdge()`:

```ts
  const fieldIds = [
    hoveredEdge.data.sourcefieldId,
    hoveredEdge.data.targetfieldId,
    ...(hoveredEdge.data.sourceFieldIds ?? []),
    ...(hoveredEdge.data.targetFieldIds ?? []),
  ].filter(Boolean);

  return fieldIds.includes(fieldId);
```

- [ ] **Step 3: Add a dedicated composite row renderer**

Create `src/components/table-composite-relations.tsx`:

```tsx
import { TableTooltip, TableTooltipContent, TableTooltipTrigger } from "./table-tooltip/table-tooltip";
import type { CompositeRelationRow } from "@/lib/dbml/composite-relations";

export function TableCompositeRelations({ rows }: { rows: CompositeRelationRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border/60">
      {rows.map((row) => (
        <TableTooltip key={row.id}>
          <TableTooltipTrigger>
            <div className="px-2 py-1 text-sm text-muted-foreground hover:bg-[#e0f2fe] hover:text-[#075985]">
              {row.label}
            </div>
          </TableTooltipTrigger>
          <TableTooltipContent>
            <div className="flex flex-col gap-1 px-2 py-1 text-gray-100 text-xs">
              <div className="text-xs pb-0.5 whitespace-nowrap border-b-2 border-b-muted-foreground">
                Composite FK -&gt; {row.remoteTableName}
              </div>
              {row.fieldPairs.map((pair) => (
                <div key={`${row.id}-${pair.local}`}>
                  {pair.local} -&gt; {pair.remote}
                </div>
              ))}
            </div>
          </TableTooltipContent>
        </TableTooltip>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Render composite rows below normal fields**

Update `src/components/table-node.tsx` to derive rows with `useMemo`, pass the current edge list from store, and render them below `<table>`:

```tsx
import { getCompositeRowsForTable } from "@/lib/dbml/composite-relations";
import { type TableEdgeType } from "@/types/nodes.types";
import { TableCompositeRelations } from "./table-composite-relations";

  const edges = useStore((s) => s.edges as TableEdgeType[]);
  const compositeRows = useMemo(() => getCompositeRowsForTable(id, edges), [id, edges]);
```

Then render:

```tsx
        <TableCompositeRelations rows={compositeRows} />
```

- [ ] **Step 5: Run the grouped hover and composite row tests to verify they pass**

Run:

```sh
./node_modules/.bin/esbuild src/components/table-node-field.helpers.test.ts src/components/table-composite-relations.test.tsx --bundle --platform=node --format=cjs --outdir=/tmp/dbml-flow-composite-ui-tests && node --test /tmp/dbml-flow-composite-ui-tests/*.js
```

Expected: PASS.

- [ ] **Step 6: Commit the UI and hover slice**

```bash
git add src/components/table-node-field.helpers.ts src/components/table-node-field.helpers.test.ts src/components/table-composite-relations.tsx src/components/table-composite-relations.test.tsx src/components/table-node.tsx
git commit -m "feat: render composite foreign key rows"
```

### Task 4: Support Composite Edge Navigation And Editor Focus

**Files:**
- Modify: `src/lib/dbml/source-map.ts`
- Modify: `src/lib/dbml/source-map.test.ts`
- Modify: `src/components/edges/table-edge.tsx`
- Modify: `src/components/viewer/viewer.tsx`
- Modify: `src/state/store.ts`

- [ ] **Step 1: Write the failing composite ref source-map test**

Append to `src/lib/dbml/source-map.test.ts`:

```ts
test("maps composite refs for editor-to-canvas navigation", () => {
  const code = `Table ecommerce.merchant_periods {\n  merchant_id int\n  country_code int\n}\nTable ecommerce.merchants {\n  id int\n  country_code int\n}\nRef: ecommerce.merchant_periods.(merchant_id, country_code) > ecommerce.merchants.(id, country_code)\n`;
  const sourceMap = buildDbmlSourceMap(code);

  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 9, column: 2 }), {
    kind: "edge",
    sourceFieldId: "f-ecommerce.merchant_periods.merchant_id",
    targetFieldId: "f-ecommerce.merchants.id",
  });
});
```

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/source-map.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-source-map.test.mjs && node --test /tmp/dbml-flow-source-map.test.mjs
```

Expected: FAIL if the composite ref parser cannot normalize grouped endpoints consistently.

- [ ] **Step 2: Normalize composite refs through the first stable endpoint pair**

Update `src/lib/dbml/source-map.ts` `parseRefs()` so grouped endpoints still emit one `SourceRef` using the first field from each side after full endpoint parsing. Keep the editor target shape unchanged:

```ts
  const sourceFieldId = sourceFieldIds[0];
  const targetFieldId = targetFieldIds[0];
```

The key is that the normalized ids must match the new edge data's first pair.

- [ ] **Step 3: Reuse the normalized first pair for double-click navigation**

Keep `TableEdge` double-click using the first pair, but ensure it still works with grouped data:

```tsx
          const sourceFieldId =
            tableEdgeData.sourceFieldIds?.[0] ?? tableEdgeData.sourcefieldId;
          const targetFieldId =
            tableEdgeData.targetFieldIds?.[0] ?? tableEdgeData.targetfieldId;
          if (!sourceFieldId || !targetFieldId) {
            return;
          }
```

Then pass those ids into `jumpToSource`.

- [ ] **Step 4: Match selected edges against grouped data consistently**

Update `src/state/store.ts` `requestFlowFocusAtEditorPosition()` and `selectFlowTarget()` edge matching:

```ts
      const sourceMatches =
        edge.data?.sourcefieldId === target.sourceFieldId ||
        edge.data?.sourceFieldIds?.[0] === target.sourceFieldId;
      const targetMatches =
        edge.data?.targetfieldId === target.targetFieldId ||
        edge.data?.targetFieldIds?.[0] === target.targetFieldId;
```

Use the same matching rule in both places so editor navigation and double-clicked edges converge on one selected edge.

- [ ] **Step 5: Run the source-map test to verify it passes**

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/source-map.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-source-map.test.mjs && node --test /tmp/dbml-flow-source-map.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the navigation slice**

```bash
git add src/lib/dbml/source-map.ts src/lib/dbml/source-map.test.ts src/components/edges/table-edge.tsx src/state/store.ts src/components/viewer/viewer.tsx
git commit -m "feat: navigate composite foreign keys"
```

### Task 5: Update Support Matrix And Run Final Verification

**Files:**
- Modify: `ReadMe.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update docs for composite FK support**

Update `ReadMe.md`:

```md
| Composite Foreign Keys | `Ref: merchant_periods.(merchant_id, country_code) > merchants.(id, country_code)` | ✅ | 已支持单条关系边、两侧组合关系行，以及多列 hover/跳转/高亮。 |
```

Update the checklist entry:

```md
- [x] Composite foreign keys
```

Add to `CHANGELOG.md` under `Unreleased` `Added`:

```md
- Added composite foreign key rendering as one edge with grouped table rows and multi-field highlighting.
```

- [ ] **Step 2: Run focused regression tests and build**

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/edge-dbml.parser.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-edge-dbml-parser.test.mjs && node --test /tmp/dbml-flow-edge-dbml-parser.test.mjs
./node_modules/.bin/esbuild src/lib/dbml/composite-relations.test.ts src/lib/dbml/dbml.math.test.ts --bundle --platform=node --format=esm --outdir=/tmp/dbml-flow-composite-dbml-tests && node --test /tmp/dbml-flow-composite-dbml-tests/*.js
./node_modules/.bin/esbuild src/components/table-node-field.helpers.test.ts src/components/table-composite-relations.test.tsx --bundle --platform=node --format=cjs --outdir=/tmp/dbml-flow-composite-ui-tests && node --test /tmp/dbml-flow-composite-ui-tests/*.js
./node_modules/.bin/esbuild src/lib/dbml/source-map.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-source-map.test.mjs && node --test /tmp/dbml-flow-source-map.test.mjs
npm run build
```

Expected:

- all focused tests: PASS
- build: PASS

- [ ] **Step 3: Commit docs and verification-ready state**

```bash
git add ReadMe.md CHANGELOG.md
git commit -m "docs: mark composite foreign key support"
```
