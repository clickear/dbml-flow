import type { CompositeRelationRow } from "@/lib/dbml/composite-relations";
import { cn } from "@/lib/utils";
import { Position } from "@xyflow/react";
import type { ReactNode } from "react";
import { HiddenHandle } from "./hidden-handle";

type TableCompositeRelationsViewProps = {
  rows: CompositeRelationRow[];
  hoveredEdgeId: string | null;
  onEdgeMouseEnter: (edgeId: string) => void;
  onEdgeMouseLeave: (edgeId: string) => void;
  onRowDoubleClick: (row: CompositeRelationRow) => void;
  renderHandle?: (
    row: CompositeRelationRow,
    side: "left" | "right",
  ) => ReactNode;
};

export function TableCompositeRelationsView({
  rows,
  hoveredEdgeId,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onRowDoubleClick,
  renderHandle,
}: TableCompositeRelationsViewProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border/60">
      {rows.map((row) => {
        const active = hoveredEdgeId === row.edgeId;

        return (
          <div
            key={row.id}
            className={cn(
              "relative px-2 py-1 text-sm text-muted-foreground transition-colors",
              active
                ? "bg-[#e0f2fe] text-[#075985]"
                : "hover:bg-[#e0f2fe] hover:text-[#075985]",
            )}
            onMouseEnter={() => onEdgeMouseEnter(row.edgeId)}
            onMouseLeave={() => onEdgeMouseLeave(row.edgeId)}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onRowDoubleClick(row);
            }}
          >
            {renderHandle ? (
              renderHandle(row, "left")
            ) : (
              <HiddenHandle
                id={row.handleId}
                type="target"
                position={Position.Left}
              />
            )}
            <span>{row.label}</span>
            {renderHandle ? (
              renderHandle(row, "right")
            ) : (
              <HiddenHandle
                id={row.handleId}
                type="source"
                position={Position.Right}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
