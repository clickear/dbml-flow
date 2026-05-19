import assert from "node:assert/strict";
import test from "node:test";

import {
  NodeTypes,
  type GroupNodeType,
  type TableNodeType,
} from "@/types/nodes.types";
import { layoutCompactGraph } from "./compact-layout";

function table(
  id: string,
  groupId?: string,
  width = 100,
  height = 40,
): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x: 999, y: 999 },
    initialWidth: width,
    initialHeight: height,
    data: {
      label: id,
      hovered: false,
      folded: false,
      groupId,
      table: {} as TableNodeType["data"]["table"],
      guessedDimensions: { width, height },
    },
  };
}

function group(id: string, nodeIds: string[]): GroupNodeType {
  return {
    id,
    type: NodeTypes.TableGroup,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      hovered: false,
      folded: false,
      nodeIds,
      dimensions: { width: 0, height: 0 },
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
    },
  };
}

test("returns empty table list unchanged", () => {
  assert.deepEqual(layoutCompactGraph([], []), []);
});

test("lays ungrouped tables in deterministic compact columns", () => {
  const result = layoutCompactGraph(
    [
      table("t-1", undefined, 100, 40),
      table("t-2", undefined, 100, 40),
      table("t-3", undefined, 100, 40),
      table("t-4", undefined, 100, 40),
      table("t-5", undefined, 100, 40),
    ],
    [],
  );

  assert.deepEqual(
    result.map((node) => [node.id, node.position]),
    [
      ["t-1", { x: 0, y: 0 }],
      ["t-2", { x: 150, y: 0 }],
      ["t-3", { x: 300, y: 0 }],
      ["t-4", { x: 450, y: 0 }],
      ["t-5", { x: 0, y: 90 }],
    ],
  );
});

test("places table group blocks to the right of ungrouped tables", () => {
  const result = layoutCompactGraph(
    [
      table("t-free", undefined, 100, 40),
      table("t-users", "g-auth", 120, 40),
      table("t-sessions", "g-auth", 120, 40),
    ],
    [group("g-auth", ["t-users", "t-sessions"])],
  );

  const byId = new Map(result.map((node) => [node.id, node.position]));
  assert.deepEqual(byId.get("t-free"), { x: 0, y: 0 });
  assert.deepEqual(byId.get("t-users"), { x: 160, y: 0 });
  assert.deepEqual(byId.get("t-sessions"), { x: 330, y: 0 });
});

test("ignores nested group ids while placing tables inside a group block", () => {
  const result = layoutCompactGraph(
    [
      table("t-users", "g-child", 100, 40),
      table("t-accounts", "g-parent", 100, 40),
    ],
    [
      group("g-parent", ["g-child", "t-accounts"]),
      group("g-child", ["t-users"]),
    ],
  );

  assert.deepEqual(
    result.map((node) => [node.id, node.position]),
    [
      ["t-users", { x: 160, y: 0 }],
      ["t-accounts", { x: 0, y: 0 }],
    ],
  );
});
