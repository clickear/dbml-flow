import { NodeBounds } from "@/lib/math/math.helper";
import type { Ref, StickyNote, Table } from "@dbml/core";
import { Edge, InternalNode, type Node } from "@xyflow/react";

export type SharedNodeData = {
  label: string;
  color?: string;
  folded: boolean;
  hovered: boolean;
  guessedDimensions?: {
    width: number;
    height: number;
  };
};

export type TableNodeData = SharedNodeData & {
  table: Table;
  index?: number;
  groupId?: string;
};

export type NoteAttachment =
  | { kind: "table"; targetId: string }
  | { kind: "group"; targetId: string };

export type NoteDisplayMode =
  | "expanded-floating"
  | "folded-floating"
  | "folded-attached-top";

export type NoteNodeData = SharedNodeData & {
  note: StickyNote;
  ownerNodeId?: string;
  detached?: boolean;
  lines: string[];
  displayMode: NoteDisplayMode;
  dockedWidth?: number;
};

export const NodeTypes = {
  TableGroup: "TableGroup",
  Table: "Table",
  Note: "Note",
} as const;

export const TableEdgeTypeName = "table-edge";

export type NodeTypes = (typeof NodeTypes)[keyof typeof NodeTypes];

export type TableNodeType = Node<TableNodeData, "Table">;
export type InternalTableNode = InternalNode & { data: TableNodeData };
export type NoteNodeType = Node<NoteNodeData, "Note">;
export type InternalNoteNode = InternalNode & { data: NoteNodeData };

export type GroupNodeData = SharedNodeData & {
  note?: string;
  nodeIds: string[];
  parentGroupId?: string;
  dimensions: {
    width: number;
    height: number;
  };
  bounds: NodeBounds;
};
export type GroupNodeType = Node<GroupNodeData, "TableGroup">;
export type InternalGroupNode = InternalNode & { data: GroupNodeData };

export type NodeType = TableNodeType | GroupNodeType | NoteNodeType;

export type ERRelationTypes = "oneOptionnal" | "one" | "many";

export type TableEdgeData = {
  sourcefieldId: string;
  targetfieldId: string;
  sourceFieldIds: string[];
  targetFieldIds: string[];
  isComposite: boolean;
  ref: Ref;
  sourceRelationType: ERRelationTypes;
  targetRelationType: ERRelationTypes;
};

export type TableEdgeType = Edge<TableEdgeData>;

export type NodePositionIndex = {
  [nodeId: string]: [x: number, y: number];
};
