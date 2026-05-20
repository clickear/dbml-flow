export function getTableFieldRowClassName(highlighted: boolean) {
  const baseClassName =
    "relative text-sm whitespace-nowrap hover:bg-[#e0f2fe] hover:text-[#075985] transition-colors";

  if (!highlighted) {
    return baseClassName;
  }

  return `${baseClassName} bg-[#e0f2fe] text-[#075985]`;
}

export function getTableFieldContentClassName(highlighted: boolean) {
  if (!highlighted) {
    return "transition-colors";
  }

  return "text-[#075985] transition-colors";
}

type FieldRelationLike = {
  table: {
    schema: { name: string };
    name: string;
  };
  endpoints: Array<{
    ref?: {
      endpoints?: Array<{
        schemaName: string | null;
        tableName: string;
      }>;
    };
  }>;
};

type EdgeFieldLike = {
  id: string;
  data?: {
    sourcefieldId?: string;
    targetfieldId?: string;
  };
};

export function isFieldRelatedToTable(
  field: FieldRelationLike,
  hoveredTableId: string | null,
) {
  if (!hoveredTableId) {
    return false;
  }

  return field.endpoints.some((endpoint) =>
    endpoint.ref?.endpoints?.some((refEndpoint) => {
      const tableId = `t-${refEndpoint.schemaName ?? field.table.schema.name}.${refEndpoint.tableName}`;
      return tableId === hoveredTableId;
    }),
  );
}

export function isFieldConnectedToHoveredEdge(
  fieldId: string,
  edges: EdgeFieldLike[],
  hoveredEdgeId: string | null,
) {
  if (!hoveredEdgeId) {
    return false;
  }

  const hoveredEdge = edges.find((edge) => edge.id === hoveredEdgeId);
  if (!hoveredEdge?.data) {
    return false;
  }

  return (
    hoveredEdge.data.sourcefieldId === fieldId ||
    hoveredEdge.data.targetfieldId === fieldId
  );
}
