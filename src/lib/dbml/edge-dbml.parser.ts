import { ERMarkerTypes } from "@/components/edges/markers";
import {
  ERRelationTypes,
  TableEdgeType,
  TableEdgeTypeName,
} from "@/types/nodes.types";
import type { Database, Endpoint, Field, Ref } from "@dbml/core";
import { uniqBy } from "lodash-es";
import {
  getCompositeSourceHandleId,
  getCompositeTargetHandleId,
} from "./composite-relations";
import { findOutermostFoldedGroupId } from "./nested-group.parser";
import { getFieldId, getGroupId, getTableId } from "./node-dmbl.parser";

export function mapDatabaseToEdges(
  database: Database,
  foldedIds: Set<string>,
  groupParentById: Map<string, string | undefined> = new Map(),
): TableEdgeType[] {
  const edges = database.schemas
    .flatMap((s) => s.refs)
    .map((r) => mapToEdge(r, foldedIds, groupParentById))
    .filter((e) => e.source !== e.target && e.sourceHandle !== e.targetHandle); // remove self loop edges

  return uniqBy(
    edges,
    (e) => `${e.source}-${e.target}-${e.sourceHandle}-${e.targetHandle}`
  ); // remove duplicate edges (can happen folding groups)
}

export function mapToEdge(
  ref: Ref,
  foldedIds: Set<string>,
  groupParentById: Map<string, string | undefined>,
) {
  const sourceEndPoint = ref.endpoints[0];
  const targetEndPoint = ref.endpoints[1];

  const sourceFields = sourceEndPoint.fields;
  const targetFields = targetEndPoint.fields;
  const sourceField = sourceFields[0];
  const targetField = targetFields[0];
  const sourceFieldIds = sourceFields.map((field) => getFieldId(field)!);
  const targetFieldIds = targetFields.map((field) => getFieldId(field)!);
  const sourcefieldId = sourceFieldIds[0];
  const targetfieldId = targetFieldIds[0];
  const isComposite = sourceFieldIds.length > 1 || targetFieldIds.length > 1;

  const sourceHandleData = getHandleData(sourceField, sourceEndPoint, foldedIds, groupParentById);
  const {
    handleId: defaultSourceHandle,
    marker: markerStart,
    folded: sourceFolded,
    relationType: sourceRelationType,
    nodeId: source,
  } = sourceHandleData;

  const targetHandleData = getHandleData(targetField, targetEndPoint, foldedIds, groupParentById);
  const {
    handleId: defaultTargetHandle,
    marker: markerEnd,
    folded: targetFolded,
    relationType: targetRelationType,
    nodeId: target,
  } = targetHandleData;

  const edgeId = ref.id.toString();
  const sourceHandle = isComposite
    ? getCompositeSourceHandleId(edgeId)
    : defaultSourceHandle;
  const targetHandle = isComposite
    ? getCompositeTargetHandleId(edgeId)
    : defaultTargetHandle;

  return <TableEdgeType>{
    id: edgeId,
    source,
    target,
    type: TableEdgeTypeName,
    sourceHandle,
    targetHandle,
    markerStart,
    markerEnd,
    data: {
      sourcefieldId,
      targetfieldId,
      sourceFieldIds,
      targetFieldIds,
      isComposite,
      ref,
      sourceRelationType,
      targetRelationType,
      sourceFolded,
      targetFolded,
    },
  };
}

function getHandleData(
  field: Field,
  endPoint: Endpoint,
  foldedIds: Set<string>,
  groupParentById: Map<string, string | undefined>,
) {
  const tableNodeId = getTableId(field.table)!;
  const groupNodeId = getGroupId(field.table.group);
  const fieldId = getFieldId(field);
  let handleId = fieldId;
  let nodeId = tableNodeId;

  let folded = false;
  const foldedGroupId = findOutermostFoldedGroupId(
    groupNodeId,
    foldedIds,
    groupParentById,
  );
  if (foldedGroupId) {
    folded = true;
    handleId = foldedGroupId;
    nodeId = foldedGroupId;
  } else if (foldedIds.has(tableNodeId)) {
    folded = true;
    handleId = tableNodeId;
  }
  const relationType = getRelationType(endPoint, field);
  return {
    nodeId,
    handleId,
    marker: folded ? ERMarkerTypes.none : relationType,
    relationType,
    folded,
  };
}

export function getRelationType(
  endPoint: Endpoint,
  targetfield: Field
): ERRelationTypes {
  if (endPoint.relation === "1" && isNotNull(targetfield)) {
    return "one";
  } else if (endPoint.relation === "1") {
    return "oneOptionnal";
  } else if (endPoint.relation === "*") {
    return "many";
  }

  throw new Error("Unknown relation type");
}

export function isNotNull(field: Field): boolean {
  const table = field.table;
  return (
    field.not_null ||
    field.pk ||
    (table.indexes?.find((i) => i.columns.some((c) => c.value === field.name))
      ?.pk as unknown as boolean)
  );
}
