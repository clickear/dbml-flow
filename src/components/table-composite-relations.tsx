import type { CompositeRelationRow } from "@/lib/dbml/composite-relations";
import useStore from "@/state/store";
import { TableCompositeRelationsView } from "./table-composite-relations-view";
import { CompositeRelationTooltipView } from "./table-tooltip/composite-relation-tooltip-view";

export function TableCompositeRelations({
  rows,
}: {
  rows: CompositeRelationRow[];
}) {
  const hoveredEdgeId = useStore((s) => s.hoveredEdgeId);
  const onEdgeMouseEnter = useStore((s) => s.onEdgeMouseEnter);
  const onEdgeMouseLeave = useStore((s) => s.onEdgeMouseLeave);
  const jumpToSource = useStore((s) => s.jumpToSource);

  return (
    <TableCompositeRelationsView
      rows={rows}
      hoveredEdgeId={hoveredEdgeId}
      onEdgeMouseEnter={onEdgeMouseEnter}
      onEdgeMouseLeave={onEdgeMouseLeave}
      onRowDoubleClick={(row) => {
        jumpToSource({
          kind: "edge",
          sourceFieldId: row.sourceFieldId,
          targetFieldId: row.targetFieldId,
        });
      }}
      renderTooltip={(row) => (
        <CompositeRelationTooltipView
          remoteTableName={row.remoteTableName}
          fieldPairs={row.fieldPairs}
        />
      )}
    />
  );
}
