import assert from "node:assert/strict";
import test from "node:test";

import {
  EDGE_HIGHLIGHT_STROKE,
  getTableEdgeVisualState,
} from "./table-edge.visuals";

test("animated edges reuse the shared highlight color", () => {
  const state = getTableEdgeVisualState({
    selected: false,
    animated: true,
    defaultStroke: "#94a3b8",
  });

  assert.equal(state.strokeWidth, 6);
  assert.equal(state.stroke, EDGE_HIGHLIGHT_STROKE);
  assert.equal(state.showRefName, true);
});

test("selected edges stay strongest while reusing the highlight color", () => {
  const state = getTableEdgeVisualState({
    selected: true,
    animated: false,
    defaultStroke: "#94a3b8",
  });

  assert.equal(state.strokeWidth, 7);
  assert.equal(state.stroke, EDGE_HIGHLIGHT_STROKE);
  assert.equal(state.showRefName, true);
});

test("idle edges keep their default stroke and hide the ref label", () => {
  const state = getTableEdgeVisualState({
    selected: false,
    animated: false,
    defaultStroke: "#94a3b8",
  });

  assert.equal(state.strokeWidth, 5);
  assert.equal(state.stroke, "#94a3b8");
  assert.equal(state.showRefName, false);
});
