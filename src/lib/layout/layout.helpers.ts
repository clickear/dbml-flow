import { getNodeSize, type NodeBounds } from "@/lib/math/math.helper";
import { NodePositionIndex } from "@/types/nodes.types";
import { Node } from "@xyflow/react";

export function toNodeIndex<TNode extends Node>(nodes: TNode[]) {
  return nodes.reduce((acc, node) => {
    acc[node.id] = [node.position.x, node.position.y];
    return acc;
  }, {} as NodePositionIndex);
}

export function applySavedPositions<TNode extends Node>(
  nodes: TNode[],
  savedPositions: NodePositionIndex,
) {
  return nodes.map(
    (node) =>
      <TNode>{
        ...node,
        position: {
          x: hasSavedPosition(savedPositions, node.id)
            ? savedPositions[node.id][0]
            : node.position.x,
          y: hasSavedPosition(savedPositions, node.id)
            ? savedPositions[node.id][1]
            : node.position.y,
        },
      },
  );
}

export function hasAnySavedPositions(savedPositions: NodePositionIndex) {
  return Object.keys(savedPositions).length > 0;
}

export function hasSavedPosition(
  savedPositions: NodePositionIndex,
  nodeId: string,
) {
  const saved = savedPositions[nodeId];
  return (
    Array.isArray(saved) &&
    Number.isFinite(saved[0]) &&
    Number.isFinite(saved[1])
  );
}

export function getUnsavedTableNodes<TNode extends Node>(
  nodes: TNode[],
  savedPositions: NodePositionIndex,
) {
  return nodes.filter((node) => !hasSavedPosition(savedPositions, node.id));
}

export function getSavedPositionBounds<TNode extends Node>(
  nodes: TNode[],
  savedPositions: NodePositionIndex,
): NodeBounds {
  const savedNodes = nodes.filter((node) =>
    hasSavedPosition(savedPositions, node.id),
  );
  if (savedNodes.length === 0) {
    return { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 };
  }

  const bounds = savedNodes.map((node) => {
    const [x, y] = savedPositions[node.id];
    const size = getNodeSize(node);
    return {
      xMin: x,
      xMax: x + size.width,
      yMin: y,
      yMax: y + size.height,
    };
  });

  const xMin = Math.min(...bounds.map((bound) => bound.xMin));
  const xMax = Math.max(...bounds.map((bound) => bound.xMax));
  const yMin = Math.min(...bounds.map((bound) => bound.yMin));
  const yMax = Math.max(...bounds.map((bound) => bound.yMax));

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    width: xMax - xMin,
    height: yMax - yMin,
  };
}
