import assert from "node:assert/strict";
import test from "node:test";

import {
  deserializeSavedView,
  sanitizeSavedView,
  serializeSavedView,
  type SavedCanvasView,
} from "./saved-views";

const view: SavedCanvasView = {
  id: "view-1",
  name: "Overview",
  createdAt: 1779140000000,
  updatedAt: 1779140000000,
  viewport: { x: 10, y: 20, zoom: 0.5 },
  positions: {
    "t-public.users": [100, 200],
    "g-public.auth": [50, 75],
    "n-public.users_note": [320, 140],
  },
  detachedNoteIds: new Set(["n-public.users_note"]),
  foldedIds: new Set(["g-public.auth"]),
  relationOnly: true,
  relationOnlyOverrides: new Set(["t-public.users"]),
  hiddenNodeIds: new Set(["t-public.sessions"]),
};

test("serializes saved view Set fields as arrays", () => {
  assert.deepEqual(serializeSavedView(view), {
    id: "view-1",
    name: "Overview",
    createdAt: 1779140000000,
    updatedAt: 1779140000000,
    viewport: { x: 10, y: 20, zoom: 0.5 },
    positions: {
      "t-public.users": [100, 200],
      "g-public.auth": [50, 75],
      "n-public.users_note": [320, 140],
    },
    detachedNoteIds: ["n-public.users_note"],
    foldedIds: ["g-public.auth"],
    relationOnly: true,
    relationOnlyOverrides: ["t-public.users"],
    hiddenNodeIds: ["t-public.sessions"],
  });
});

test("deserializes saved view arrays back into Sets", () => {
  const serialized = serializeSavedView(view);
  const result = deserializeSavedView(serialized);

  assert.deepEqual(result.detachedNoteIds, new Set(["n-public.users_note"]));
  assert.deepEqual(result.foldedIds, new Set(["g-public.auth"]));
  assert.deepEqual(result.relationOnlyOverrides, new Set(["t-public.users"]));
  assert.deepEqual(result.hiddenNodeIds, new Set(["t-public.sessions"]));
});

test("sanitizes saved view state against current node ids", () => {
  const result = sanitizeSavedView(
    view,
    new Set(["t-public.users", "n-public.users_note"]),
  );

  assert.deepEqual(result.positions, {
    "t-public.users": [100, 200],
    "n-public.users_note": [320, 140],
  });
  assert.deepEqual(result.detachedNoteIds, new Set(["n-public.users_note"]));
  assert.deepEqual(result.foldedIds, new Set([]));
  assert.deepEqual(result.relationOnlyOverrides, new Set(["t-public.users"]));
  assert.deepEqual(result.hiddenNodeIds, new Set([]));
});
