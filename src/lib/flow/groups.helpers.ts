import {
  GroupNodeData,
  GroupNodeType,
  NodeType,
  NodeTypes,
} from "@/types/nodes.types";
import { getNodesBounds, NodeBounds } from "../math/math.helper";
import { NodeChange, NodePositionChange } from "@xyflow/react";
import { vectorAdd, vectorSub } from "../math/vector.helper";
import { GROUP_PADDING, HEADER_HEIGHT } from "@/components/table-constants";

const EMPTY_BOUNDS: NodeBounds = {
  xMin: 0,
  xMax: 100,
  yMin: 0,
  yMax: 60,
  width: 100,
  height: 60,
};

/**
 * Collect leaf table nodes contained in a group (including nested subgroups).
 */
export function getGroupLeafNodes(
  group: GroupNodeType,
  nodesById: Map<string, NodeType>,
): NodeType[] {
  return group.data.nodeIds.flatMap((id) => {
    const child = nodesById.get(id);
    if (!child) {
      return [];
    }
    if (child.type === NodeTypes.TableGroup) {
      return getGroupLeafNodes(child, nodesById);
    }
    return [child];
  });
}

/** All descendant node ids to move when dragging a group (excludes the dragged group itself). */
export function collectGroupDragTargets(
  group: GroupNodeType,
  nodesById: Map<string, NodeType>,
): Set<string> {
  const ids = new Set<string>();

  getGroupLeafNodes(group, nodesById).forEach((n) => ids.add(n.id));

  const visit = (g: GroupNodeType) => {
    g.data.nodeIds.forEach((id) => {
      ids.add(id);
      const child = nodesById.get(id);
      if (child?.type === NodeTypes.TableGroup) {
        visit(child);
      }
    });
  };
  visit(group);
  ids.delete(group.id);
  return ids;
}

export function sortGroupsByDepth(groupNodes: GroupNodeType[]): GroupNodeType[] {
  const byId = new Map(groupNodes.map((g) => [g.id, g]));

  const depthOf = (id: string, visiting = new Set<string>()): number => {
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parentId = byId.get(id)?.data.parentGroupId;
    if (!parentId) return 0;
    return 1 + depthOf(parentId, visiting);
  };

  return [...groupNodes].sort(
    (a, b) => depthOf(b.id) - depthOf(a.id),
  );
}

/**
 * Calculate and update group nodes parameters (width, height, position) based on their children nodes bounds.
 * @param groupNodes
 * @param childrenNodesById
 * @param moveChildren
 * @param groupPadding
 * @returns
 */
export function getBoundedGroups(
  groupNodes: GroupNodeType[],
  childrenNodesById: Map<string, NodeType>,
  groupPadding = GROUP_PADDING,
) {
  const nodesById = new Map(childrenNodesById);
  const sorted = sortGroupsByDepth(groupNodes);
  const result = new Map<string, GroupNodeType>();

  for (const groupNode of sorted) {
    const leafNodes = getGroupLeafNodes(groupNode, nodesById);

    const bounds =
      leafNodes.length > 0 ? getNodesBounds(leafNodes) : EMPTY_BOUNDS;
    const position = getGroupPosition(bounds, groupPadding);
    const dimensions = getGroupDimensions(bounds, groupPadding);
    const updated = {
      ...groupNode,
      position,
      initialHeight: dimensions.heightWithHeader,
      initialWidth: dimensions.width,
      data: {
        ...groupNode.data,
        dimensions,
        bounds,
      },
    };
    result.set(groupNode.id, updated);
    nodesById.set(groupNode.id, updated);
  }

  return groupNodes.map((g) => result.get(g.id)!);
}

function buildGroupAncestorChain(
  groupId: string,
  nodesById: Map<string, NodeType>,
): string[] {
  const chain: string[] = [];
  let currentId: string | undefined = groupId;
  while (currentId) {
    chain.push(currentId);
    const group = nodesById.get(currentId);
    currentId =
      group?.type === NodeTypes.TableGroup
        ? group.data.parentGroupId
        : undefined;
  }
  return chain;
}

function pushGroupChainResizeChanges(
  groupIds: string[],
  nodesById: Map<string, NodeType>,
  computedChanges: NodeChange<NodeType>[],
  groupPadding: number,
) {
  const workingNodes = new Map(nodesById);

  for (const groupId of groupIds) {
    const group = workingNodes.get(groupId) as GroupNodeType | undefined;
    if (!group) continue;

    const leafNodes = getGroupLeafNodes(group, workingNodes);
    const bounds =
      leafNodes.length > 0 ? getNodesBounds(leafNodes) : EMPTY_BOUNDS;
    const replaceChange = computeGroupDimentionsChange(
      group,
      bounds,
      groupPadding,
    );

    computedChanges.push(replaceChange);
    workingNodes.set(groupId, replaceChange.item);
  }
}

export function computeRelatedGroupChanges(
  changes: NodeChange<NodeType>[],
  oldNodesById: Map<string, NodeType>,
  groupPadding = GROUP_PADDING,
) {
  const computedChanges = [] as NodeChange<NodeType>[];
  for (const change of changes) {
    if (change.type !== "position") continue;

    const oldNode = oldNodesById.get(change.id);
    if (!oldNode) continue;

    if (oldNode.type === NodeTypes.TableGroup && change.type === "position") {
      if (oldNode.data.nodeIds.length === 0) continue;

      const draggedGroup = oldNode as GroupNodeType;
      const drag = vectorSub(change.position!, draggedGroup.position);
      const movableIds = collectGroupDragTargets(draggedGroup, oldNodesById);

      movableIds.forEach((nodeId) => {
        const childNode = oldNodesById.get(nodeId);
        if (!childNode) return;

        computedChanges.push(<NodePositionChange>{
          id: nodeId,
          type: "position",
          position: vectorAdd(childNode.position, drag),
          dragging: true,
        });
      });

      const nodesAfterDrag = new Map(oldNodesById);
      movableIds.forEach((nodeId) => {
        const childNode = nodesAfterDrag.get(nodeId);
        if (!childNode) return;
        nodesAfterDrag.set(nodeId, {
          ...childNode,
          position: vectorAdd(childNode.position, drag),
        });
      });
      nodesAfterDrag.set(change.id, {
        ...draggedGroup,
        position: change.position!,
      });

      pushGroupChainResizeChanges(
        buildGroupAncestorChain(change.id, nodesAfterDrag),
        nodesAfterDrag,
        computedChanges,
        groupPadding,
      );
      continue;
    } else if (
      (oldNode.type === NodeTypes.Table && oldNode.data.groupId) ||
      (oldNode.type === NodeTypes.TableGroup && oldNode.data.parentGroupId)
    ) {
      const nodesAfterDrag = new Map(oldNodesById);
      nodesAfterDrag.set(change.id, {
        ...oldNode,
        position: change.position!,
      });

      const startGroupId =
        oldNode.type === NodeTypes.Table
          ? oldNode.data.groupId!
          : oldNode.data.parentGroupId!;

      pushGroupChainResizeChanges(
        buildGroupAncestorChain(startGroupId, nodesAfterDrag),
        nodesAfterDrag,
        computedChanges,
        groupPadding,
      );
    }
  }
  return computedChanges;
}

export function computeGroupDimentionsChange(
  groupParent: GroupNodeType,
  bounds: NodeBounds,
  groupPadding: number,
) {
  const dimensions = getGroupDimensions(bounds, groupPadding);

  return {
    id: groupParent.id,
    type: "replace" as const,
    item: {
      ...groupParent,
      initialHeight: dimensions.heightWithHeader,
      initialWidth: dimensions.width,
      position: getGroupPosition(bounds, groupPadding),
      dragging: true,
      data: <GroupNodeData>{
        ...groupParent.data,
        bounds,
        dimensions,
      },
    },
  };
}

export function getGroupPosition(bounds: NodeBounds, padding: number) {
  return {
    x: bounds.xMin - padding,
    y: bounds.yMin - padding - HEADER_HEIGHT,
  };
}

export function getGroupDimensions(bounds: NodeBounds, padding: number) {
  const height = bounds.height + padding * 2;
  return {
    width: bounds.width + padding * 2,
    heightWithHeader: height + HEADER_HEIGHT,
    height,
  };
}
