import type { CompositeRelationRow } from "@/lib/dbml/composite-relations";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import {
  TableTooltip,
  TableTooltipContent,
  TableTooltipTrigger,
} from "./table-tooltip/table-tooltip";

type TableCompositeRelationsViewProps = {
  rows: CompositeRelationRow[];
  hoveredEdgeId: string | null;
  onEdgeMouseEnter: (edgeId: string) => void;
  onEdgeMouseLeave: (edgeId: string) => void;
  onRowDoubleClick: (row: CompositeRelationRow) => void;
  renderTooltip?: (row: CompositeRelationRow) => ReactNode;
};

export function TableCompositeRelationsView({
  rows,
  hoveredEdgeId,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  onRowDoubleClick,
  renderTooltip,
}: TableCompositeRelationsViewProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border/60">
      {rows.map((row) => {
        const active = hoveredEdgeId === row.edgeId;

        return (
          <TableTooltip key={row.id}>
            <TableTooltipTrigger>
              <div
                className={cn(
                  "px-2 py-1 text-sm text-muted-foreground transition-colors",
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
                {row.label}
              </div>
            </TableTooltipTrigger>
            <TableTooltipContent>
              {renderTooltip?.(row)}
            </TableTooltipContent>
          </TableTooltip>
        );
      })}
    </div>
  );
}
