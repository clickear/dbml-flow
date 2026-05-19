import assert from "node:assert/strict";
import test from "node:test";

import { NodeTypes, type TableNodeType } from "@/types/nodes.types";
import {
  applySavedPositions,
  getSavedPositionBounds,
  getUnsavedTableNodes,
  hasAnySavedPositions,
  hasSavedPosition,
  toNodeIndex,
} from "./layout.helpers";

function table(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 40,
): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x, y },
    initialWidth: width,
    initialHeight: height,
    data: {
      label: id,
      hovered: false,
      folded: false,
      table: {} as TableNodeType["data"]["table"],
      guessedDimensions: { width, height },
    },
  };
}

test("detects saved positions by node id", () => {
  const saved = { "t-public.users": [10, 20] as [number, number] };

  assert.equal(hasAnySavedPositions(saved), true);
  assert.equal(hasSavedPosition(saved, "t-public.users"), true);
  assert.equal(hasSavedPosition(saved, "t-public.orders"), false);
  assert.equal(hasAnySavedPositions({}), false);
});

test("applies saved positions without mutating other node coordinates", () => {
  const nodes = [
    table("t-public.users", 0, 0),
    table("t-public.orders", 50, 60),
  ];
  const positioned = applySavedPositions(nodes, {
    "t-public.users": [300, 400],
  });

  assert.deepEqual(
    positioned.map((node) => node.position),
    [
      { x: 300, y: 400 },
      { x: 50, y: 60 },
    ],
  );
  assert.deepEqual(toNodeIndex(positioned), {
    "t-public.users": [300, 400],
    "t-public.orders": [50, 60],
  });
});

test("computes bounds only for nodes with saved positions", () => {
  const nodes = [
    table("t-public.users", 0, 0, 100, 40),
    table("t-public.orders", 0, 0, 200, 60),
    table("t-public.logs", 0, 0, 80, 30),
  ];
  const bounds = getSavedPositionBounds(nodes, {
    "t-public.users": [10, 20],
    "t-public.orders": [300, 100],
  });

  assert.deepEqual(bounds, {
    xMin: 10,
    xMax: 500,
    yMin: 20,
    yMax: 160,
    width: 490,
    height: 140,
  });
});

test("returns zero bounds when no nodes match saved positions", () => {
  assert.deepEqual(getSavedPositionBounds([table("t-public.users", 0, 0)], {}), {
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0,
    width: 0,
    height: 0,
  });
});

test("finds table nodes without saved positions", () => {
  const nodes = [
    table("t-public.users", 0, 0),
    table("t-public.orders", 0, 0),
    table("t-public.logs", 0, 0),
  ];

  assert.deepEqual(
    getUnsavedTableNodes(nodes, {
      "t-public.users": [10, 20],
      "t-public.orders": [30, 40],
    }).map((node) => node.id),
    ["t-public.logs"],
  );
});
