import type { Edge } from "@xyflow/react";

export type EdgeInteractionState = {
  selectedNodeIds?: Iterable<string>;
  selectedEdgeIds?: Iterable<string>;
  hoveredNodeId?: string | null;
  hoveredEdgeId?: string | null;
};

function toIdSet(ids?: Iterable<string>) {
  return new Set(ids ?? []);
}

export function applyEdgeInteractionState<T extends Edge>(
  edges: T[],
  {
    selectedNodeIds,
    selectedEdgeIds,
    hoveredNodeId,
    hoveredEdgeId,
  }: EdgeInteractionState,
): T[] {
  const highlightedNodeIds = toIdSet(selectedNodeIds);
  const highlightedEdgeIds = toIdSet(selectedEdgeIds);

  if (hoveredNodeId) {
    highlightedNodeIds.add(hoveredNodeId);
  }

  if (hoveredEdgeId) {
    highlightedEdgeIds.add(hoveredEdgeId);
  }

  return edges.map((edge) => ({
    ...edge,
    animated:
      highlightedEdgeIds.has(edge.id) ||
      highlightedNodeIds.has(edge.source) ||
      highlightedNodeIds.has(edge.target),
  }));
}
