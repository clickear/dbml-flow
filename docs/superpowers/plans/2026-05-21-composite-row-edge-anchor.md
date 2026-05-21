# Composite Row Edge Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach composite foreign key edges directly to the dedicated composite relationship rows and remove composite row tooltips.

**Architecture:** Keep the existing grouped field metadata on composite edges, but switch composite `sourceHandle` and `targetHandle` from first-field handles to stable row-level handles derived from the edge id. Extend the composite row derivation helper and renderer so both tables expose those handles, while leaving single-field relationship behavior unchanged.

**Tech Stack:** TypeScript, React 19, React Flow, Zustand, `@dbml/core`, esbuild, Node test runner, Vite.

---

### Task 1: Move Composite Edge Anchors To Row-Level Handles

**Files:**
- Modify: `src/lib/dbml/edge-dbml.parser.ts`
- Modify: `src/lib/dbml/edge-dbml.parser.test.ts`
- Modify: `src/lib/dbml/composite-relations.ts`
- Modify: `src/lib/dbml/composite-relations.test.ts`

- [ ] **Step 1: Write the failing handle-anchor tests**

Add to `src/lib/dbml/edge-dbml.parser.test.ts`:

```ts
  assert.equal(edges[0]?.sourceHandle, "cr-source-1");
  assert.equal(edges[0]?.targetHandle, "cr-target-1");
```

inside the composite-edge test, and keep the existing single-column test asserting:

```ts
  assert.equal(edges[0]?.sourceHandle, "f-public.orders.user_id");
  assert.equal(edges[0]?.targetHandle, "f-public.users.id");
```

Add to `src/lib/dbml/composite-relations.test.ts`:

```ts
  assert.equal(rows[0]?.sourceHandleId, "cr-source-ref-1");
  assert.equal(rows[0]?.targetHandleId, "cr-target-ref-1");
```

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/edge-dbml.parser.test.ts src/lib/dbml/composite-relations.test.ts --bundle --platform=node --format=esm --outdir=/tmp/dbml-flow-composite-anchor-dbml-tests && node --test /tmp/dbml-flow-composite-anchor-dbml-tests/*.js
```

Expected: FAIL because composite edges still use field handles and composite rows do not expose row handle ids.

- [ ] **Step 2: Implement stable composite row handle ids**

Update `src/lib/dbml/composite-relations.ts` so `CompositeRelationRow` includes:

```ts
  sourceHandleId: string;
  targetHandleId: string;
```

and `buildRow()` returns deterministic ids:

```ts
    sourceHandleId: `cr-source-${edgeId}`,
    targetHandleId: `cr-target-${edgeId}`,
```

- [ ] **Step 3: Bind composite edges to row-level handles**

Update `src/lib/dbml/edge-dbml.parser.ts` so composite refs override the handle ids after normal endpoint analysis:

```ts
  const edgeId = ref.id.toString();
  const sourceHandle = isComposite ? `cr-source-${edgeId}` : sourceHandleData.handleId;
  const targetHandle = isComposite ? `cr-target-${edgeId}` : targetHandleData.handleId;
```

while single-column refs keep the existing field or folded handle ids.

- [ ] **Step 4: Run the DBML anchor tests to verify they pass**

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/edge-dbml.parser.test.ts src/lib/dbml/composite-relations.test.ts --bundle --platform=node --format=esm --outdir=/tmp/dbml-flow-composite-anchor-dbml-tests && node --test /tmp/dbml-flow-composite-anchor-dbml-tests/*.js
```

Expected: PASS with all tests passing.

### Task 2: Render Composite Row Handles And Remove The Tooltip

**Files:**
- Modify: `src/components/table-composite-relations-view.tsx`
- Modify: `src/components/table-composite-relations.tsx`
- Modify: `src/components/table-composite-relations.test.tsx`
- Modify: `src/components/table-node-field.helpers.test.ts`
- Possibly delete usage of: `src/components/table-tooltip/composite-relation-tooltip-view.tsx`

- [ ] **Step 1: Write the failing row-renderer tests**

Update `src/components/table-composite-relations.test.tsx` to assert:

```ts
  assert.match(markup, /cr-source-ref-1/);
  assert.match(markup, /cr-target-ref-1/);
```

and remove the tooltip-content expectation. Replace it with a check that the rendered markup does not include the previous remote-table text:

```ts
  assert.doesNotMatch(markup, /Composite FK/);
  assert.doesNotMatch(markup, /merchants/);
```

Run:

```sh
./node_modules/.bin/esbuild src/components/table-composite-relations.test.tsx src/components/table-node-field.helpers.test.ts --bundle --platform=node --format=cjs --outdir=/tmp/dbml-flow-composite-anchor-ui-tests && node --test /tmp/dbml-flow-composite-anchor-ui-tests/*.js
```

Expected: FAIL because the row renderer does not render row-level handles and still depends on tooltip rendering.

- [ ] **Step 2: Render row-level handles and drop the tooltip wrapper**

Update `src/components/table-composite-relations-view.tsx` to:

- remove `TableTooltip`, `TableTooltipTrigger`, and `TableTooltipContent`
- render one hidden left handle with `id={row.targetHandleId}` and `type="target"`
- render one hidden right handle with `id={row.sourceHandleId}` and `type="source"`
- keep the existing hover and double-click handlers on the row container

Update `src/components/table-composite-relations.tsx` to stop passing `renderTooltip`.

- [ ] **Step 3: Run the UI tests to verify they pass**

Run:

```sh
./node_modules/.bin/esbuild src/components/table-composite-relations.test.tsx src/components/table-node-field.helpers.test.ts --bundle --platform=node --format=cjs --outdir=/tmp/dbml-flow-composite-anchor-ui-tests && node --test /tmp/dbml-flow-composite-anchor-ui-tests/*.js
```

Expected: PASS with all tests passing.

### Task 3: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused verification**

Run:

```sh
./node_modules/.bin/esbuild src/lib/dbml/edge-dbml.parser.test.ts src/lib/dbml/composite-relations.test.ts --bundle --platform=node --format=esm --outdir=/tmp/dbml-flow-composite-anchor-dbml-tests && node --test /tmp/dbml-flow-composite-anchor-dbml-tests/*.js
./node_modules/.bin/esbuild src/components/table-composite-relations.test.tsx src/components/table-node-field.helpers.test.ts --bundle --platform=node --format=cjs --outdir=/tmp/dbml-flow-composite-anchor-ui-tests && node --test /tmp/dbml-flow-composite-anchor-ui-tests/*.js
npm run build
```

Expected: PASS for both test commands and a successful production build.

- [ ] **Step 2: Commit**

```bash
git add src/lib/dbml/edge-dbml.parser.ts src/lib/dbml/edge-dbml.parser.test.ts src/lib/dbml/composite-relations.ts src/lib/dbml/composite-relations.test.ts src/components/table-composite-relations-view.tsx src/components/table-composite-relations.tsx src/components/table-composite-relations.test.tsx
git commit -m "feat: anchor composite edges to relation rows"
```
