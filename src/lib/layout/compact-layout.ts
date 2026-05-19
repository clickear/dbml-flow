import { getNodeSize } from "@/lib/math/math.helper";
import {
  NodeTypes,
  type GroupNodeType,
  type TableNodeType,
} from "@/types/nodes.types";
import {
  COMPACT_BLOCK_GAP,
  COMPACT_COLUMN_GAP,
  COMPACT_VERTICAL_GAP,
} from "./layout.types";

type CompactColumn = {
  tableIds: string[];
  x: number;
  width: number;
};

function placeBlock(
  tableNodes: TableNodeType[],
  beginX: number,
  beginY = 0,
) {
  if (tableNodes.length === 0) {
    return { nodes: [] as TableNodeType[], nextBeginX: beginX };
  }

  const columnCount = Math.max(4, Math.floor(Math.sqrt(tableNodes.length)));
  const columns: CompactColumn[] = Array.from({ length: columnCount }, () => ({
    tableIds: [],
    x: beginX,
    width: 0,
  }));

  tableNodes.forEach((node, index) => {
    columns[index % columnCount].tableIds.push(node.id);
  });

  const tableById = new Map(tableNodes.map((node) => [node.id, node]));
  const positions = new Map<string, { x: number; y: number }>();

  columns.forEach((column, index) => {
    if (index > 0) {
      const previous = columns[index - 1];
      column.x = previous.x + previous.width + COMPACT_COLUMN_GAP;
    }

    let y = beginY;
    column.tableIds.forEach((tableId) => {
      const node = tableById.get(tableId);
      if (!node) return;

      const size = getNodeSize(node);
      positions.set(node.id, { x: column.x, y });
      y += size.height + COMPACT_VERTICAL_GAP;
      column.width = Math.max(column.width, size.width);
    });
  });

  const positionedNodes = tableNodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
  const lastColumn = [...columns].reverse().find((column) => column.width > 0);

  return {
    nodes: positionedNodes,
    nextBeginX: lastColumn
      ? lastColumn.x + lastColumn.width + COMPACT_BLOCK_GAP
      : beginX,
  };
}

export function layoutCompactGraph(
  tableNodes: TableNodeType[],
  groupNodes: GroupNodeType[],
) {
  if (tableNodes.length === 0) return tableNodes;

  const tableById = new Map(tableNodes.map((node) => [node.id, node]));
  const placedIds = new Set<string>();
  const blocks: TableNodeType[][] = [];

  const ungrouped = tableNodes.filter((node) => !node.data.groupId);
  if (ungrouped.length > 0) {
    blocks.push(ungrouped);
    ungrouped.forEach((node) => placedIds.add(node.id));
  }

  groupNodes.forEach((groupNode) => {
    const groupTables = groupNode.data.nodeIds
      .map((nodeId) => tableById.get(nodeId))
      .filter(
        (node): node is TableNodeType =>
          !!node && node.type === NodeTypes.Table,
      )
      .filter((node) => !placedIds.has(node.id));

    if (groupTables.length === 0) return;

    groupTables.forEach((node) => placedIds.add(node.id));
    blocks.push(groupTables);
  });

  const remaining = tableNodes.filter((node) => !placedIds.has(node.id));
  if (remaining.length > 0) blocks.push(remaining);

  let nextBeginX = 0;
  const positionedById = new Map<string, TableNodeType>();

  blocks.forEach((block) => {
    const result = placeBlock(block, nextBeginX);
    result.nodes.forEach((node) => positionedById.set(node.id, node));
    nextBeginX = result.nextBeginX;
  });

  return tableNodes.map((node) => positionedById.get(node.id) ?? node);
}
