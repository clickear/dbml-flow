import assert from "node:assert/strict";
import test from "node:test";

import {
  getNodeCenter,
  getNodesCenter,
  getPanOnlyCenterOptions,
} from "./viewer.helper";

test("computes a node center without changing zoom", () => {
  assert.deepEqual(
    getNodeCenter({
      position: { x: 10, y: 20 },
      width: 100,
      height: 40,
      measured: undefined,
    }),
    { x: 60, y: 40 },
  );
});

test("computes the center across related edge endpoint nodes", () => {
  assert.deepEqual(
    getNodesCenter([
      {
        position: { x: 10, y: 20 },
        width: 100,
        height: 40,
        measured: undefined,
      },
      {
        position: { x: 250, y: 160 },
        width: 80,
        height: 60,
        measured: undefined,
      },
    ]),
    { x: 170, y: 120 },
  );
});

test("keeps the current zoom when centering the viewport", () => {
  assert.deepEqual(getPanOnlyCenterOptions(0.42), {
    duration: 250,
    zoom: 0.42,
  });
});
