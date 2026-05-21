import type { TableEdgeType } from "@/types/nodes.types";

export type CompositeRelationRow = {
  id: string;
  edgeId: string;
  label: string;
  localFieldIds: string[];
  sourceFieldId: string;
  targetFieldId: string;
  handleId: string;
  remoteTableName: string;
  fieldPairs: Array<{ local: string; remote: string }>;
};

export function getCompositeSourceHandleId(edgeId: string) {
  return `cr-source-${edgeId}`;
}

export function getCompositeTargetHandleId(edgeId: string) {
  return `cr-target-${edgeId}`;
}

export function getCompositeRowsForTable(
  tableId: string,
  edges: TableEdgeType[],
): CompositeRelationRow[] {
  return edges
    .filter((edge) => edge.data?.isComposite)
    .flatMap((edge) => {
      const data = edge.data;
      if (!data) {
        return [];
      }

      if (edge.source === tableId) {
        return [
          buildRow(
            edge.id,
            tableId,
            data.sourceFieldIds,
            data.targetFieldIds,
            edge.target,
            getCompositeSourceHandleId(edge.id),
          ),
        ];
      }

      if (edge.target === tableId) {
        return [
          buildRow(
            edge.id,
            tableId,
            data.targetFieldIds,
            data.sourceFieldIds,
            edge.source,
            getCompositeTargetHandleId(edge.id),
          ),
        ];
      }

      return [];
    });
}

function buildRow(
  edgeId: string,
  tableId: string,
  localFieldIds: string[],
  remoteFieldIds: string[],
  remoteTableId: string,
  handleId: string,
): CompositeRelationRow {
  const localNames = localFieldIds.map(getFieldNameFromId);
  const remoteNames = remoteFieldIds.map(getFieldNameFromId);

  return {
    id: `cr-${tableId}-${edgeId}`,
    edgeId,
    label: `(${localNames.join(", ")})`,
    localFieldIds,
    sourceFieldId: localFieldIds[0] ?? "",
    targetFieldId: remoteFieldIds[0] ?? "",
    handleId,
    remoteTableName: getTableNameFromId(remoteTableId),
    fieldPairs: localNames.map((local, index) => ({
      local,
      remote: remoteNames[index] ?? "",
    })),
  };
}

function getFieldNameFromId(fieldId: string) {
  return fieldId.split(".").at(-1) ?? fieldId;
}

function getTableNameFromId(tableId: string) {
  return tableId.split(".").at(-1) ?? tableId;
}
