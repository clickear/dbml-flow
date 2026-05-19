import { getFieldId } from "@/lib/dbml/node-dmbl.parser";
import { getNodeSize } from "@/lib/math/math.helper";
import {
  type GroupNodeType,
  type TableEdgeType,
  type TableNodeType,
} from "@/types/nodes.types";
import ELK, {
  type ElkExtendedEdge,
  type ElkNode,
} from "elkjs/lib/elk.bundled.js";
import { ELK_NODE_PADDING, type LayoutMode } from "./layout.types";

type ElkMode = Exclude<LayoutMode, "compact">;

const leftrightOptions: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.layered.spacing.baseValue": "40",
  "elk.spacing.componentComponent": "80",
  "elk.layered.spacing.edgeNodeBetweenLayers": "120",
  "elk.layered.considerModelOrder.strategy": "PREFER_EDGES",
  "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
  "elk.layered.mergeEdges": "true",
  "elk.layered.nodePlacement.strategy": "INTERACTIVE",
  "elk.layered.layering.strategy": "INTERACTIVE",
};

const snowflakeOptions: Record<string, string> = {
  "elk.algorithm": "force",
  "elk.spacing.nodeNode": "5",
  "elk.force.temperature": "0.001",
  "elk.force.iterations": "300",
};

function layoutOptionsForMode(mode: ElkMode) {
  return mode === "snowflake" ? snowflakeOptions : leftrightOptions;
}

export function normalizeEdgeDirection(edge: TableEdgeType) {
  const sourceRelation = edge.data?.sourceRelationType;
  const targetRelation = edge.data?.targetRelationType;
  const sourceHandle = edge.sourceHandle ?? edge.source;
  const targetHandle = edge.targetHandle ?? edge.target;

  if (sourceRelation !== targetRelation && sourceRelation === "many") {
    return { sourceHandle: targetHandle, targetHandle: sourceHandle };
  }

  return { sourceHandle, targetHandle };
}

function tableToElkNode(node: TableNodeType, mode: ElkMode): ElkNode {
  const size = getNodeSize(node);
  const fields = node.data.table.fields ?? [];
  const rowHeight = fields.length > 0 ? size.height / fields.length : size.height;
  const sharedPortOptions =
    mode === "snowflake"
      ? { layoutOptions: { "elk.port.side": "EAST" } }
      : {};

  const ports = fields.flatMap((field, index) => {
    const fieldId = getFieldId(field);
    if (!fieldId) return [];

    const y = Math.max(0, rowHeight * index + rowHeight / 2 + ELK_NODE_PADDING);

    return [
      {
        id: fieldId,
        x: size.width + ELK_NODE_PADDING,
        y,
        ...sharedPortOptions,
      },
    ];
  });

  return {
    id: node.id,
    width: size.width + ELK_NODE_PADDING * 2,
    height: size.height + ELK_NODE_PADDING * 2,
    ports: [{ id: node.id, ...sharedPortOptions }, ...ports],
    layoutOptions: {
      "elk.aspectRatio": "1.6f",
      "elk.alignment": "LEFT",
    },
  };
}

function groupToElkNode(groupNode: GroupNodeType): ElkNode {
  return {
    id: groupNode.id,
    children: [],
    layoutOptions: {
      "elk.aspectRatio": "1.6f",
      "elk.alignment": "LEFT",
      "elk.padding": "[top=30,left=30,bottom=30,right=30]",
    },
  };
}

export function buildElkGraph(
  tableNodes: TableNodeType[],
  groupNodes: GroupNodeType[],
  edges: TableEdgeType[],
  mode: ElkMode,
): ElkNode {
  const tableById = new Map(tableNodes.map((node) => [node.id, node]));
  const groupById = new Map(groupNodes.map((node) => [node.id, node]));
  const elkGroups = new Map<string, ElkNode>();
  const looseChildren: ElkNode[] = [];

  tableNodes.forEach((tableNode) => {
    const elkTable = tableToElkNode(tableNode, mode);
    const groupId = tableNode.data.groupId;
    if (!groupId || !groupById.has(groupId)) {
      looseChildren.push(elkTable);
      return;
    }

    let elkGroup = elkGroups.get(groupId);
    if (!elkGroup) {
      elkGroup = groupToElkNode(groupById.get(groupId)!);
      elkGroups.set(groupId, elkGroup);
    }
    elkGroup.children = [...(elkGroup.children ?? []), elkTable];
  });

  const elkEdges: ElkExtendedEdge[] = edges.flatMap((edge) => {
    if (!tableById.has(edge.source) && !groupById.has(edge.source)) return [];
    if (!tableById.has(edge.target) && !groupById.has(edge.target)) return [];

    const normalized = normalizeEdgeDirection(edge);
    return [
      {
        id: edge.id,
        sources: [normalized.sourceHandle],
        targets: [normalized.targetHandle],
      },
    ];
  });

  return {
    id: "root",
    layoutOptions: layoutOptionsForMode(mode),
    children: [...elkGroups.values(), ...looseChildren],
    edges: elkEdges,
  };
}

function collectLayoutPositions(root: ElkNode) {
  const positions = new Map<string, { x: number; y: number }>();

  root.children?.forEach((child) => {
    if (child.children?.length) {
      child.children.forEach((tableNode) => {
        positions.set(tableNode.id, {
          x: (child.x ?? 0) + (tableNode.x ?? 0),
          y: (child.y ?? 0) + (tableNode.y ?? 0),
        });
      });
      return;
    }

    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  });

  return positions;
}

export async function layoutElkGraph(
  tableNodes: TableNodeType[],
  groupNodes: GroupNodeType[],
  edges: TableEdgeType[],
  mode: ElkMode,
) {
  if (tableNodes.length === 0) return tableNodes;

  const elk = new ELK();
  const graph = buildElkGraph(tableNodes, groupNodes, edges, mode);
  const result = await elk.layout(graph);
  const positions = collectLayoutPositions(result);

  return tableNodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}
