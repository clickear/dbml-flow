import type { Edge } from "@xyflow/react";

import { getBoundedGroups } from "@/lib/flow/groups.helpers";
import { toMapId } from "@/lib/utils";
import {
  NodeTypes,
  type GroupNodeType,
  type NoteNodeType,
  type NodeType,
} from "@/types/nodes.types";

export type StructureTreeItem = {
  id: string;
  label: string;
  type: "group" | "table";
  children: StructureTreeItem[];
};

function toTreeItem(
  node: NodeType,
  nodesById: Map<string, NodeType>,
): StructureTreeItem {
  if (node.type !== NodeTypes.TableGroup) {
    return {
      id: node.id,
      label: node.data.label,
      type: "table",
      children: [],
    };
  }

  return {
    id: node.id,
    label: node.data.label,
    type: "group",
    children: node.data.nodeIds
      .map((id) => nodesById.get(id))
      .filter((child): child is NodeType => !!child)
      .map((child) => toTreeItem(child, nodesById)),
  };
}

export function buildStructureTree(nodes: NodeType[]): StructureTreeItem[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return nodes
    .filter((node) => {
      if (node.type === NodeTypes.Note) {
        return false;
      }
      if (node.type === NodeTypes.TableGroup) {
        return !node.data.parentGroupId;
      }
      return !node.data.groupId;
    })
    .map((node) => toTreeItem(node, nodesById));
}

function collectGroupDescendants(
  group: GroupNodeType,
  nodesById: Map<string, NodeType>,
  hidden: Set<string>,
) {
  for (const childId of group.data.nodeIds) {
    hidden.add(childId);
    const child = nodesById.get(childId);
    if (child?.type === NodeTypes.TableGroup) {
      collectGroupDescendants(child, nodesById, hidden);
    }
  }
}

export function collectHiddenNodeIds(
  nodes: NodeType[],
  hiddenRootIds: Set<string>,
): Set<string> {
  const visibleNodes = nodes.filter((node) => node.type !== NodeTypes.Note);
  const notes = nodes.filter(
    (node): node is NoteNodeType => node.type === NodeTypes.Note,
  );
  const nodesById = new Map(visibleNodes.map((node) => [node.id, node]));
  const hidden = new Set<string>();

  for (const id of hiddenRootIds) {
    const node = nodesById.get(id);
    if (!node) continue;
    hidden.add(id);
    if (node.type === NodeTypes.TableGroup) {
      collectGroupDescendants(node, nodesById, hidden);
    }
  }

  for (const note of notes) {
    if (note.data.ownerNodeId && hidden.has(note.data.ownerNodeId)) {
      hidden.add(note.id);
    }
  }

  return hidden;
}

function getDescendantIds(
  group: GroupNodeType,
  nodesById: Map<string, NodeType>,
): Set<string> {
  const ids = new Set<string>();
  collectGroupDescendants(group, nodesById, ids);
  return ids;
}

function findParentGroupId(node: NodeType): string | undefined {
  return node.type === NodeTypes.TableGroup
    ? node.data.parentGroupId
    : node.type === NodeTypes.Table
      ? node.data.groupId
      : undefined;
}

function syncParentHiddenState(
  nodesById: Map<string, NodeType>,
  hiddenRootIds: Set<string>,
  startingNodeId: string,
) {
  let parentId = findParentGroupId(nodesById.get(startingNodeId)!);

  while (parentId) {
    const parent = nodesById.get(parentId);
    if (parent?.type !== NodeTypes.TableGroup) break;

    const childHiddenStates = parent.data.nodeIds.map((childId) =>
      hiddenRootIds.has(childId),
    );
    const allChildrenHidden = childHiddenStates.every(Boolean);

    if (allChildrenHidden) {
      hiddenRootIds.add(parent.id);
    } else {
      hiddenRootIds.delete(parent.id);
    }

    parentId = parent.data.parentGroupId;
  }
}

export function toggleStructureHiddenRoot(
  nodes: NodeType[],
  hiddenRootIds: Set<string>,
  nodeId: string,
): Set<string> {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const node = nodesById.get(nodeId);
  if (!node) return new Set(hiddenRootIds);

  const nextHiddenRootIds = new Set(hiddenRootIds);
  const descendantIds =
    node.type === NodeTypes.TableGroup ? getDescendantIds(node, nodesById) : new Set<string>();

  if (nextHiddenRootIds.has(nodeId)) {
    nextHiddenRootIds.delete(nodeId);
    for (const descendantId of descendantIds) {
      nextHiddenRootIds.delete(descendantId);
    }
  } else {
    nextHiddenRootIds.add(nodeId);
    for (const descendantId of descendantIds) {
      nextHiddenRootIds.add(descendantId);
    }
  }
  syncParentHiddenState(nodesById, nextHiddenRootIds, nodeId);

  return nextHiddenRootIds;
}

export function filterVisibleNodes<TNode extends NodeType>(
  nodes: TNode[],
  hiddenNodeIds: Set<string>,
): TNode[] {
  return nodes.filter((node) => !hiddenNodeIds.has(node.id));
}

export function filterVisibleEdges<TEdge extends Edge>(
  edges: TEdge[],
  hiddenNodeIds: Set<string>,
): TEdge[] {
  return edges.filter(
    (edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target),
  );
}

export function getVisibleGraph<TEdge extends Edge>(
  nodes: NodeType[],
  edges: TEdge[],
  hiddenNodeIds: Set<string>,
): { nodes: NodeType[]; edges: TEdge[] } {
  const visibleNodes = filterVisibleNodes(nodes, hiddenNodeIds);
  const tableNodes = visibleNodes.filter((node) => node.type === NodeTypes.Table);
  const groupNodes = visibleNodes.filter(
    (node): node is GroupNodeType => node.type === NodeTypes.TableGroup,
  );
  const noteNodes = visibleNodes.filter(
    (node): node is NoteNodeType => node.type === NodeTypes.Note,
  );
  const boundedGroupNodes = getBoundedGroups(
    groupNodes,
    toMapId([...groupNodes, ...tableNodes]),
  );

  return {
    nodes: [...boundedGroupNodes, ...tableNodes, ...noteNodes],
    edges: filterVisibleEdges(edges, hiddenNodeIds),
  };
}
