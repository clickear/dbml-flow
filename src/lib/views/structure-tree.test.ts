import assert from "node:assert/strict";
import test from "node:test";

import {
  NodeTypes,
  type GroupNodeType,
  type TableEdgeType,
  type TableNodeType,
} from "@/types/nodes.types";
import {
  buildStructureTree,
  collectHiddenNodeIds,
  filterVisibleEdges,
  filterVisibleNodes,
  getVisibleGraph,
  toggleStructureHiddenRoot,
} from "./structure-tree";

function group(
  id: string,
  label: string,
  nodeIds: string[],
  parentGroupId?: string,
): GroupNodeType {
  return {
    id,
    type: NodeTypes.TableGroup,
    position: { x: 0, y: 0 },
    data: {
      label,
      hovered: false,
      folded: false,
      nodeIds,
      parentGroupId,
      dimensions: { width: 0, height: 0 },
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
    },
  };
}

function table(id: string, label: string, groupId?: string): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x: 0, y: 0 },
    data: {
      label,
      hovered: false,
      folded: false,
      groupId,
      table: {} as TableNodeType["data"]["table"],
    },
  };
}

function positionedTable(
  id: string,
  label: string,
  position: { x: number; y: number },
  groupId?: string,
): TableNodeType {
  return {
    ...table(id, label, groupId),
    position,
    width: 100,
    height: 50,
    initialWidth: 100,
    initialHeight: 50,
  };
}

const nodes = [
  group("g-public.parent", "Parent", ["g-public.child", "t-public.accounts"]),
  group("g-public.child", "Child", ["t-public.users"], "g-public.parent"),
  table("t-public.users", "users", "g-public.child"),
  table("t-public.accounts", "accounts", "g-public.parent"),
  table("t-public.logs", "logs"),
] satisfies Array<GroupNodeType | TableNodeType>;

test("builds tree with nested groups and ungrouped tables at root", () => {
  assert.deepEqual(buildStructureTree(nodes), [
    {
      id: "g-public.parent",
      label: "Parent",
      type: "group",
      children: [
        {
          id: "g-public.child",
          label: "Child",
          type: "group",
          children: [
            {
              id: "t-public.users",
              label: "users",
              type: "table",
              children: [],
            },
          ],
        },
        {
          id: "t-public.accounts",
          label: "accounts",
          type: "table",
          children: [],
        },
      ],
    },
    { id: "t-public.logs", label: "logs", type: "table", children: [] },
  ]);
});

test("collects hidden descendants for hidden groups", () => {
  assert.deepEqual(
    collectHiddenNodeIds(nodes, new Set(["g-public.parent"])),
    new Set([
      "g-public.parent",
      "g-public.child",
      "t-public.users",
      "t-public.accounts",
    ]),
  );
});

test("filters visible nodes and edges", () => {
  const hidden = collectHiddenNodeIds(nodes, new Set(["g-public.child"]));
  const edges = [
    { id: "e1", source: "t-public.users", target: "t-public.accounts" },
    { id: "e2", source: "t-public.accounts", target: "t-public.logs" },
  ] as TableEdgeType[];

  assert.deepEqual(
    filterVisibleNodes(nodes, hidden).map((node) => node.id),
    ["g-public.parent", "t-public.accounts", "t-public.logs"],
  );
  assert.deepEqual(
    filterVisibleEdges(edges, hidden).map((edge) => edge.id),
    ["e2"],
  );
});

test("hiding a group marks every descendant as a hidden root for icon state", () => {
  assert.deepEqual(
    toggleStructureHiddenRoot(nodes, new Set(), "g-public.parent"),
    new Set([
      "g-public.parent",
      "g-public.child",
      "t-public.users",
      "t-public.accounts",
    ]),
  );
});

test("showing a group shows every descendant", () => {
  assert.deepEqual(
    toggleStructureHiddenRoot(
      nodes,
      new Set([
        "g-public.parent",
        "g-public.child",
        "t-public.users",
        "t-public.accounts",
      ]),
      "g-public.parent",
    ),
    new Set([]),
  );
});

test("hiding all children collapses the parent hidden root", () => {
  assert.deepEqual(
    toggleStructureHiddenRoot(
      nodes,
      new Set(["g-public.child", "t-public.users"]),
      "t-public.accounts",
    ),
    new Set([
      "g-public.parent",
      "g-public.child",
      "t-public.users",
      "t-public.accounts",
    ]),
  );
});

test("showing the last hidden child shows the parent", () => {
  assert.deepEqual(
    toggleStructureHiddenRoot(
      nodes,
      new Set([
        "g-public.parent",
        "g-public.child",
        "t-public.users",
        "t-public.accounts",
      ]),
      "t-public.accounts",
    ),
    new Set(["g-public.child", "t-public.users"]),
  );
});

test("showing the last hidden nested child shows ancestor groups", () => {
  assert.deepEqual(
    toggleStructureHiddenRoot(
      nodes,
      new Set(["g-public.parent", "g-public.child", "t-public.users"]),
      "t-public.users",
    ),
    new Set([]),
  );
});

test("recomputes visible group bounds after hidden children are filtered", () => {
  const graphNodes = [
    group("g-public.parent", "Parent", ["t-public.left", "t-public.right"]),
    positionedTable("t-public.left", "left", { x: 0, y: 0 }, "g-public.parent"),
    positionedTable("t-public.right", "right", { x: 500, y: 0 }, "g-public.parent"),
  ];
  const visibleGraph = getVisibleGraph(
    graphNodes,
    [],
    new Set(["t-public.right"]),
  );
  const parent = visibleGraph.nodes.find(
    (node) => node.id === "g-public.parent",
  ) as GroupNodeType | undefined;

  assert.equal(parent?.data.bounds.xMin, 0);
  assert.equal(parent?.data.bounds.xMax, 100);
  assert.equal(parent?.data.bounds.width, 100);
});
