import assert from "node:assert/strict";
import test from "node:test";

import {
  getMiniMapHorizontalWheelViewport,
  getMiniMapInteractionProps,
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

test("enables minimap panning and zooming", () => {
  assert.deepEqual(getMiniMapInteractionProps(), {
    pannable: true,
    zoomable: true,
  });
});

test("maps horizontal minimap wheel movement to viewport x offset", () => {
  assert.deepEqual(
    getMiniMapHorizontalWheelViewport(
      { x: 120, y: 40, zoom: 0.5 },
      { deltaX: 60, deltaY: 5, shiftKey: false },
    ),
    { x: 60, y: 40, zoom: 0.5 },
  );
});

test("treats shift+wheel as horizontal minimap panning", () => {
  assert.deepEqual(
    getMiniMapHorizontalWheelViewport(
      { x: 120, y: 40, zoom: 0.5 },
      { deltaX: 0, deltaY: 30, shiftKey: true },
    ),
    { x: 90, y: 40, zoom: 0.5 },
  );
});

test("ignores vertical minimap wheel movement so zoom can handle it", () => {
  assert.equal(
    getMiniMapHorizontalWheelViewport(
      { x: 120, y: 40, zoom: 0.5 },
      { deltaX: 5, deltaY: 30, shiftKey: false },
    ),
    null,
  );
});
