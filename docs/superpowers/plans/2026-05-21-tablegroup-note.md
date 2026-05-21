# TableGroup Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `TableGroup` note support so group headers show the same note icon and tooltip behavior already used for table headers.

**Architecture:** Extend the DBML-to-node mapping so `GroupNodeData` carries parsed note text from `@dbml/core`. Reuse the existing `TableFoldHeader` `afterTitle` slot in `table-group-node.tsx`, and extract a tiny shared note-adornment component so table and group headers render the same icon. Keep verification focused on parser output plus server-rendered tooltip/adornment markup, which fits the repo's current Node-based test setup.

**Tech Stack:** TypeScript, React 19, React DOM server rendering, React Flow, Zustand, `@dbml/core`, esbuild, Node test runner.

---

### Task 1: Add Parser Coverage For Group Notes

**Files:**
- Modify: `src/types/nodes.types.ts`
- Modify: `src/lib/dbml/node-dmbl.parser.ts`
- Create: `src/lib/dbml/node-dmbl.parser.test.ts`

- [ ] **Step 1: Write the failing parser test**

Create `src/lib/dbml/node-dmbl.parser.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { Parser } from "@dbml/core";

import { parseDatabaseToGraph } from "./node-dmbl.parser";

const parser = new Parser();

test("maps inline TableGroup note into group node data", () => {
  const database = parser.parse(
    `
Table users {
  id int [pk]
}

TableGroup ecommerce [note: 'Group summary', color: #20B2AA] {
  users
}
`,
    "dbmlv2",
  );

  const { groupNodes } = parseDatabaseToGraph(database);

  assert.equal(groupNodes[0]?.data.note, "Group summary");
});

test("maps block TableGroup note into group node data", () => {
  const database = parser.parse(
    `
Table users {
  id int [pk]
}

TableGroup ecommerce {
  Note: 'Block summary'
  users
}
`,
    "dbmlv2",
  );

  const { groupNodes } = parseDatabaseToGraph(database);

  assert.equal(groupNodes[0]?.data.note, "Block summary");
});
```

Run:

```sh
esbuild src/lib/dbml/node-dmbl.parser.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-node-dbml-parser.test.mjs && node --test /tmp/dbml-flow-node-dbml-parser.test.mjs
```

Expected: FAIL because `GroupNodeData` does not expose `note` yet.

- [ ] **Step 2: Add `note` to group node data**

Update `src/types/nodes.types.ts`:

```ts
export type GroupNodeData = SharedNodeData & {
  note?: string;
  nodeIds: string[];
  parentGroupId?: string;
  dimensions: {
    width: number;
    height: number;
  };
  bounds: NodeBounds;
};
```

- [ ] **Step 3: Map DBML group notes into graph nodes**

Update `src/lib/dbml/node-dmbl.parser.ts` inside `mapToGroupNode()`:

```ts
  return <GroupNodeType>{
    id: getGroupId(g),
    type: NodeTypes.TableGroup,
    zIndex: GROUP_Z_INDEX,
    position: { x: 0, y: 0 },
    data: {
      label: g.name,
      note: g.note,
      nodeIds: [...groupChildIds, ...tableChildIds],
      parentGroupId,
      color: g.color,
      folded: false,
      dimensions: { width: 0, height: 0 },
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
    },
  };
```

- [ ] **Step 4: Run the parser test to verify it passes**

Run:

```sh
esbuild src/lib/dbml/node-dmbl.parser.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-node-dbml-parser.test.mjs && node --test /tmp/dbml-flow-node-dbml-parser.test.mjs
```

Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit the parser slice**

```bash
git add src/types/nodes.types.ts src/lib/dbml/node-dmbl.parser.ts src/lib/dbml/node-dmbl.parser.test.ts
git commit -m "feat: parse tablegroup notes"
```

### Task 2: Render Group Header Notes With Shared Adornment And Tooltip

**Files:**
- Create: `src/components/table-tooltip/header-note-adornment.tsx`
- Create: `src/components/table-tooltip/group-header-tooltip-view.tsx`
- Create: `src/components/table-tooltip/group-header-tooltip-view.test.tsx`
- Modify: `src/components/table-group-node.tsx`
- Modify: `src/components/table-node.tsx`

- [ ] **Step 1: Write the failing tooltip and adornment render tests**

Create `src/components/table-tooltip/group-header-tooltip-view.test.tsx`:

```tsx
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GroupHeaderTooltipView } from "./group-header-tooltip-view";
import { HeaderNoteAdornment } from "./header-note-adornment";

test("renders group header tooltip with label and note", () => {
  const html = renderToStaticMarkup(
    <GroupHeaderTooltipView label="ecommerce" note="Group summary" />,
  );

  assert.match(html, /ecommerce/);
  assert.match(html, /Group summary/);
});

test("renders note adornment only when note exists", () => {
  const withNote = renderToStaticMarkup(
    <>{HeaderNoteAdornment({ note: "Group summary" })}</>,
  );
  const withoutNote = renderToStaticMarkup(
    <>{HeaderNoteAdornment({ note: undefined })}</>,
  );

  assert.match(withNote, /svg/);
  assert.equal(withoutNote, "");
});
```

Run:

```sh
esbuild src/components/table-tooltip/group-header-tooltip-view.test.tsx --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-group-header-tooltip.test.mjs && node --test /tmp/dbml-flow-group-header-tooltip.test.mjs
```

Expected: FAIL because the tooltip view and adornment component do not exist yet.

- [ ] **Step 2: Add a shared header note adornment**

Create `src/components/table-tooltip/header-note-adornment.tsx`:

```tsx
import { StickyNote } from "lucide-react";

export function HeaderNoteAdornment({ note }: { note?: string }) {
  if (!note) {
    return null;
  }

  return (
    <span className="inline-flex min-w-[1.25rem] shrink-0 items-center pl-1">
      <StickyNote size="1rem" />
    </span>
  );
}
```

- [ ] **Step 3: Add a group tooltip view component**

Create `src/components/table-tooltip/group-header-tooltip-view.tsx`:

```tsx
export const GroupHeaderTooltipView = ({
  label,
  note,
}: {
  label: string;
  note: string;
}) => {
  return (
    <div className="flex flex-col gap-1 px-2 py-1 text-gray-100 text-xs">
      <div className="text-xs pb-0.5 whitespace-nowrap border-b-2 border-b-muted-foreground">
        <span>{label}</span>
      </div>
      <div className="text-muted-foreground">{note}</div>
    </div>
  );
};
```

- [ ] **Step 4: Wire the shared adornment into table and group headers**

Update `src/components/table-node.tsx` `Header()`:

```tsx
import { HeaderNoteAdornment } from "./table-tooltip/header-note-adornment";

  return (
    <TableTooltip>
      <TableTooltipTrigger>
        <TableFoldHeader
          {...sharedProps}
          afterTitle={<HeaderNoteAdornment note={data.table.note} />}
        />
      </TableTooltipTrigger>
      <TableTooltipContent>
        <TableHeaderTooltipView table={data.table} />
      </TableTooltipContent>
    </TableTooltip>
  );
```

Update `src/components/table-group-node.tsx`:

```tsx
import { GroupHeaderTooltipView } from "./table-tooltip/group-header-tooltip-view";
import { HeaderNoteAdornment } from "./table-tooltip/header-note-adornment";
import {
  TableTooltip,
  TableTooltipContent,
  TableTooltipTrigger,
} from "./table-tooltip/table-tooltip";

function GroupHeader({
  selected,
  data,
  id,
}: Pick<NodeProps<GroupNodeType>, "selected" | "data" | "id">) {
  if (!data.note) {
    return (
      <TableFoldHeader
        id={id}
        headerColor={data.color}
        label={data.label}
        selected={selected}
        data={data}
        folded={data.folded}
        className="pointer-events-auto"
      />
    );
  }

  return (
    <TableTooltip>
      <TableTooltipTrigger>
        <TableFoldHeader
          id={id}
          headerColor={data.color}
          label={data.label}
          selected={selected}
          data={data}
          folded={data.folded}
          className="pointer-events-auto"
          afterTitle={<HeaderNoteAdornment note={data.note} />}
        />
      </TableTooltipTrigger>
      <TableTooltipContent>
        <GroupHeaderTooltipView label={data.label} note={data.note} />
      </TableTooltipContent>
    </TableTooltip>
  );
}
```

Then replace the inline `TableFoldHeader` call in `TableGroupNodeBody()` with:

```tsx
      <GroupHeader selected={selected} data={data} id={id} />
```

- [ ] **Step 5: Run the tooltip and adornment tests to verify they pass**

Run:

```sh
esbuild src/components/table-tooltip/group-header-tooltip-view.test.tsx --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-group-header-tooltip.test.mjs && node --test /tmp/dbml-flow-group-header-tooltip.test.mjs
```

Expected: PASS with 2 tests passing.

- [ ] **Step 6: Run the parser tests again to catch regressions**

Run:

```sh
esbuild src/lib/dbml/node-dmbl.parser.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-node-dbml-parser.test.mjs && node --test /tmp/dbml-flow-node-dbml-parser.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the UI slice**

```bash
git add src/components/table-tooltip/header-note-adornment.tsx src/components/table-tooltip/group-header-tooltip-view.tsx src/components/table-tooltip/group-header-tooltip-view.test.tsx src/components/table-group-node.tsx src/components/table-node.tsx
git commit -m "feat: show tablegroup notes in headers"
```

### Task 3: Update Support Matrix And Verify The Build

**Files:**
- Modify: `ReadMe.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update the feature matrix and changelog**

Update `ReadMe.md`:

```md
| TableGroup Note | `TableGroup g [note: '...']` / `Note: '...'` | ✅ | 已支持在分组头部显示 note 图标并通过 tooltip 展示内容。 |
```

Add to `CHANGELOG.md` under `2026-05-21`:

```md
- Added `TableGroup` header note icons and tooltips for DBML group notes.
```

- [ ] **Step 2: Run focused tests and the production build**

Run:

```sh
esbuild src/lib/dbml/node-dmbl.parser.test.ts --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-node-dbml-parser.test.mjs && node --test /tmp/dbml-flow-node-dbml-parser.test.mjs
esbuild src/components/table-tooltip/group-header-tooltip-view.test.tsx --bundle --platform=node --format=esm --outfile=/tmp/dbml-flow-group-header-tooltip.test.mjs && node --test /tmp/dbml-flow-group-header-tooltip.test.mjs
npm run build
```

Expected:

- parser test: PASS
- tooltip/adornment test: PASS
- build: PASS

- [ ] **Step 3: Commit docs and verification-ready state**

```bash
git add ReadMe.md CHANGELOG.md
git commit -m "docs: mark tablegroup note support"
```
