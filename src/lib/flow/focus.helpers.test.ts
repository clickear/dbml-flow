import assert from "node:assert/strict";
import test from "node:test";

import { NodeTypes, type GroupNodeType, type TableNodeType } from "@/types/nodes.types";
import { expandNodesForFocus } from "./focus.helpers";

function group(id: string, parentGroupId?: string): GroupNodeType {
  return {
    id,
    type: NodeTypes.TableGroup,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      hovered: false,
      folded: true,
      nodeIds: [],
      parentGroupId,
      dimensions: { width: 0, height: 0 },
      bounds: {
        xMin: 0,
        xMax: 0,
        yMin: 0,
        yMax: 0,
        width: 0,
        height: 0,
      },
    },
  };
}

function table(id: string, groupId?: string): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      hovered: false,
      folded: true,
      groupId,
      table: {} as TableNodeType["data"]["table"],
    },
  };
}

test("expands a focused table group and folded parent groups", () => {
  const result = expandNodesForFocus(
    [group("g-public.parent"), group("g-public.child", "g-public.parent")],
    new Set(["g-public.parent", "g-public.child"]),
    "g-public.child",
  );

  assert.deepEqual([...result.foldedIds], []);
  assert.equal(result.nodes.find((node) => node.id === "g-public.parent")?.data.folded, false);
  assert.equal(result.nodes.find((node) => node.id === "g-public.child")?.data.folded, false);
});

test("expands a focused table and folded ancestor groups", () => {
  const result = expandNodesForFocus(
    [group("g-public.group"), table("t-public.users", "g-public.group")],
    new Set(["g-public.group", "t-public.users"]),
    "t-public.users",
  );

  assert.deepEqual([...result.foldedIds], []);
  assert.equal(result.nodes.find((node) => node.id === "g-public.group")?.data.folded, false);
  assert.equal(result.nodes.find((node) => node.id === "t-public.users")?.data.folded, false);
});
