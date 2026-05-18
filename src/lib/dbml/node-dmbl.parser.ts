import {
  GROUP_Z_INDEX,
  TABLE_Z_INDEX,
} from "@/components/table-constants";
import {
  GroupNodeType,
  NodePositionIndex,
  NodeTypes,
  TableNodeType,
} from "@/types/nodes.types";
import { Parser, type Database, type Field, type Table, type TableGroup } from "@dbml/core";
import { findClosestSize } from "./dbml.math";
import {
  getGroupNodeId,
  type NestedGroupModel,
} from "./nested-group.parser";

//#region DBML to Nodes

export const parser = new Parser();

export function parseDatabaseToGraph(
  database: Database,
  nestedGroups?: NestedGroupModel,
) {
  const tables = database.schemas.flatMap((s) => s.tables);
  const groups = database.schemas.flatMap((s) => s.tableGroups);

  const tableNodes = tables.map((t) => mapTableToNode(t));

  const tableNodesById = new Map(tableNodes.map((n) => [n.id, n]));
  const groupNodes = groups.map((g) =>
    mapToGroupNode(g, tableNodesById, nestedGroups),
  );

  return {
    tableNodes,
    groupNodes,
  };
}

export const paddingX = 20;
export const paddingY = 20;

function mapToGroupNode(
  g: TableGroup,
  nodes: Map<string, TableNodeType>,
  nestedGroups?: NestedGroupModel,
) {
  const schemaName = g.schema.name;
  const nestedDef = nestedGroups?.groups.get(g.name);
  const tableChildIds = g.tables
    .map(getTableId)
    .filter((id): id is string => !!id);
  const groupChildIds =
    nestedDef?.members
      .filter((m) => m.kind === "group")
      .map((m) => getGroupNodeId(m.name, schemaName)) ?? [];
  const parentGroupId = nestedDef?.parentGroupName
    ? getGroupNodeId(nestedDef.parentGroupName, schemaName)
    : undefined;

  return <GroupNodeType>{
    id: getGroupId(g),
    type: NodeTypes.TableGroup,
    zIndex: GROUP_Z_INDEX,
    position: { x: 0, y: 0 },
    data: {
      label: g.name,
      nodeIds: [...groupChildIds, ...tableChildIds],
      parentGroupId,
      color: g.color,
      folded: false,
      dimensions: { width: 0, height: 0 },
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
    },
  };
}

export function mapTableToNode(table: Table) {
  const tableId = getTableId(table);

  const guessedDimensions = findClosestSize(table);
  return <TableNodeType>{
    id: tableId,
    type: NodeTypes.Table,
    zIndex: TABLE_Z_INDEX,
    data: {
      table,
      label: table.name,
      groupId: table.group ? getGroupId(table.group) : undefined,
      color: table.headerColor,
      folded: false,
      guessedDimensions,
    },
    initialWidth: guessedDimensions.width,
    initialHeight: guessedDimensions.height,
    position: { x: 0, y: 0 },
  };
}

// #endregion

//#region helpers

export function getTableId(table: Table) {
  return table ? `t-${getBaseId(table)}` : undefined;
}

export function getGroupId(group: TableGroup) {
  return group ? `g-${getBaseId(group)}` : undefined;
}

export function getFieldId(e: Field) {
  return e ? `f-${getBaseId(e.table)}.${e.name}` : undefined;
}

function getBaseId(table: Table | TableGroup) {
  return `${table.schema.name}.${table.name}`;
}

// #endregion


//#region Position Store

const positionStoreRegex =
  /\n?\/\*\s*<(?:posistions|positions)>(.*?)<\/(?:positions|posistions)>\s*\*\//s;

export function extractPositions(code: string) {
  const positionMatch = positionStoreRegex.exec(code);
  if (!positionMatch) return {};

  return JSON.parse(positionMatch[1]) as NodePositionIndex;
}

export function setPositionsInCode(
  code: string,
  savedPositions: NodePositionIndex
) {
  const positionMatch = positionStoreRegex.exec(code);
  const start = positionMatch?.index ?? code.length;
  const end = start + (positionMatch?.[0].length ?? 0);

  const hasValue = savedPositions && Object.keys(savedPositions).length;
  const positionsString = hasValue
    ? `${start > 0 ? "\n" : ""}/*<posistions>${JSON.stringify(
        savedPositions
      )}</positions>*/`
    : "";

  return code.substring(0, start) + positionsString + code.substring(end);
}

// #endregion
