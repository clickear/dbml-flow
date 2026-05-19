import type {
  GroupNodeType,
  NodePositionIndex,
  TableEdgeType,
  TableNodeType,
} from "@/types/nodes.types";

export type LayoutMode = "leftright" | "snowflake" | "compact";
export type LayoutReason = "database-update" | "rearrange";
export type LayoutStrategy = "elk" | "compact";

export const DEFAULT_LAYOUT_MODE: LayoutMode = "leftright";
export const LARGE_DIAGRAM_TABLE_THRESHOLD = 100;
export const ELK_NODE_PADDING = 3;
export const COMPACT_VERTICAL_GAP = 50;
export const COMPACT_COLUMN_GAP = 50;
export const COMPACT_BLOCK_GAP = 60;

export type LayoutGraphInput = {
  tableNodes: TableNodeType[];
  groupNodes: GroupNodeType[];
  edges: TableEdgeType[];
  savedPositions: NodePositionIndex;
  mode: LayoutMode;
  reason: LayoutReason;
};

export type LayoutGraphResult = {
  tableNodes: TableNodeType[];
  strategy: LayoutStrategy;
  mode: LayoutMode;
  savedPositionsApplied: boolean;
  appendedNodeIds: string[];
  fallbackReason?: string;
};

export type LayoutEngines = {
  elk: (
    tableNodes: TableNodeType[],
    groupNodes: GroupNodeType[],
    edges: TableEdgeType[],
    mode: Exclude<LayoutMode, "compact">,
  ) => Promise<TableNodeType[]>;
  compact: (
    tableNodes: TableNodeType[],
    groupNodes: GroupNodeType[],
  ) => TableNodeType[];
};
