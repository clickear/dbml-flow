import { NodeType, NodeTypes } from "@/types/nodes.types";

export function expandNodesForFocus(
  nodes: NodeType[],
  foldedIds: Set<string>,
  targetNodeId: string,
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const idsToExpand = new Set<string>();
  let currentId: string | undefined = targetNodeId;

  while (currentId) {
    idsToExpand.add(currentId);
    const node = nodeById.get(currentId);
    if (!node) break;
    currentId =
      node.type === NodeTypes.TableGroup
        ? node.data.parentGroupId
        : node.type === NodeTypes.Table
          ? node.data.groupId
          : undefined;
  }

  const nextFoldedIds = new Set(foldedIds);
  for (const id of idsToExpand) {
    nextFoldedIds.delete(id);
  }

  const nextNodes = nodes.map((node) =>
    idsToExpand.has(node.id)
      ? { ...node, data: { ...node.data, folded: false } }
      : node,
  ) as NodeType[];

  return {
    nodes: nextNodes,
    foldedIds: nextFoldedIds,
  };
}
