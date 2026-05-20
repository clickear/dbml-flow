import { NodeType, NodeTypes } from "@/types/nodes.types";
import type { Node, Viewport } from "@xyflow/react";

export function getNodeColor(node: NodeType) {
  return (node.data.color as string) ?? "#636363ff";
}

export function getNodeClass(node: NodeType) {
  return node.type === NodeTypes.TableGroup ? "opacity-30" : "";
}

export function getNodeCenter(node: Pick<Node, "position" | "width" | "height" | "measured">) {
  return {
    x: node.position.x + (node.measured?.width ?? node.width ?? 0) / 2,
    y: node.position.y + (node.measured?.height ?? node.height ?? 0) / 2,
  };
}

export function getNodesCenter(
  nodes: Pick<Node, "position" | "width" | "height" | "measured">[],
) {
  if (nodes.length === 0) return null;

  const bounds = nodes.reduce(
    (acc, node) => {
      const width = node.measured?.width ?? node.width ?? 0;
      const height = node.measured?.height ?? node.height ?? 0;
      return {
        minX: Math.min(acc.minX, node.position.x),
        minY: Math.min(acc.minY, node.position.y),
        maxX: Math.max(acc.maxX, node.position.x + width),
        maxY: Math.max(acc.maxY, node.position.y + height),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function getPanOnlyCenterOptions(zoom: number, duration = 250) {
  return { duration, zoom };
}

export function getMiniMapInteractionProps() {
  return {
    pannable: true,
    zoomable: true,
  };
}

export function getMiniMapHorizontalWheelViewport(
  viewport: Viewport,
  {
    deltaX,
    deltaY,
    shiftKey,
  }: {
    deltaX: number;
    deltaY: number;
    shiftKey: boolean;
  },
) {
  const horizontalDelta = shiftKey && deltaX === 0 ? deltaY : deltaX;
  const isHorizontalIntent =
    Math.abs(horizontalDelta) > 0 &&
    (shiftKey || Math.abs(horizontalDelta) > Math.abs(deltaY));

  if (!isHorizontalIntent) {
    return null;
  }

  return {
    ...viewport,
    x: viewport.x - horizontalDelta,
  };
}
