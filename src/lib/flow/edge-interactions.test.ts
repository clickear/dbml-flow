import assert from "node:assert/strict";
import test from "node:test";

import { applyEdgeInteractionState } from "./edge-interactions";

test("applyEdgeInteractionState highlights edges connected to selected or hovered tables", () => {
  const edges = [
    { id: "orders-users", source: "orders", target: "users" },
    { id: "orders-products", source: "orders", target: "products" },
    { id: "audit-users", source: "audit", target: "users" },
  ];

  const updated = applyEdgeInteractionState(edges, {
    selectedNodeIds: ["orders"],
    hoveredNodeId: "users",
  });

  assert.equal(updated[0].animated, true);
  assert.equal(updated[1].animated, true);
  assert.equal(updated[2].animated, true);
});

test("applyEdgeInteractionState highlights directly selected and hovered edges only", () => {
  const edges = [
    { id: "orders-users", source: "orders", target: "users" },
    { id: "orders-products", source: "orders", target: "products" },
  ];

  const updated = applyEdgeInteractionState(edges, {
    selectedEdgeIds: ["orders-users"],
    hoveredEdgeId: "orders-products",
  });

  assert.equal(updated[0].animated, true);
  assert.equal(updated[1].animated, true);
});

test("applyEdgeInteractionState clears animated on unrelated edges", () => {
  const edges = [
    {
      id: "orders-users",
      source: "orders",
      target: "users",
      animated: true,
    },
    {
      id: "orders-products",
      source: "orders",
      target: "products",
      animated: true,
    },
  ];

  const updated = applyEdgeInteractionState(edges, {
    selectedNodeIds: ["users"],
  });

  assert.equal(updated[0].animated, true);
  assert.equal(updated[1].animated, false);
});
