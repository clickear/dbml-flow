import { hasFieldDetails, isUniqueFieldOrPK } from "@/lib/dbml/dbml.utils";
import { getFieldId } from "@/lib/dbml/node-dmbl.parser";
import { cn } from "@/lib/utils";
import useStore from "@/state/store";
import type { Field, Table } from "@dbml/core";
import { KeyRound, StickyNote } from "lucide-react";
import { LabeledHandle } from "./labeled-handle";
import { ICON_SIZE, FIELD_HEIGHT, FIELD_SPACING } from "./table-constants";
import { TableRow, TableCell } from "./ui/table";
import { Position } from "@xyflow/react";

export type TableFieldProps = {
  field: Field;
  table: Table;
  isRelationOnly: boolean;
} & React.HTMLProps<HTMLTableRowElement>;

export const TableField = ({
  field,
  table,
  isRelationOnly,
  children,
  ...props
}: TableFieldProps) => {
  const { unique, pk } = isUniqueFieldOrPK(field);
  const icons = getFieldIcons(field);
  const fieldId = getFieldId(field)!;
  const highlightedFieldId = useStore((s) => s.highlightedFieldId);
  const jumpToSource = useStore((s) => s.jumpToSource);

  const hidden = isRelationOnly && !field.endpoints.some((e) => e.ref);

  return (
    <TableRow
      {...props}
      hidden={hidden}
      onDoubleClick={(event) => {
        event.stopPropagation();
        jumpToSource({
          kind: "field",
          id: fieldId,
          tableId: `t-${field.table.schema.name}.${field.table.name}`,
        });
        props.onDoubleClick?.(event);
      }}
      className={cn(
        "relative text-sm whitespace-nowrap",
        highlightedFieldId === fieldId && "bg-primary/15 outline outline-1 outline-primary/40",
        props.className,
      )}
      style={{
        height: FIELD_HEIGHT,
        ...props.style,
      }}
    >
      <TableCell
        className={cn(
          "py-0.5 pl-0 flex items-center gap-1",
          unique ? "font-semibold" : "font-normal",
        )}
        style={{
          paddingRight: FIELD_SPACING,
        }}
      >
        <LabeledHandle
          id={fieldId}
          title={field.name}
          type="target"
          position={Position.Left}
          className="bold"
          labelClassName="p-0 pl-2"
        />
        <div className="flex justify-end gap-0.5">
          {icons}
        </div>
      </TableCell>

      <TableCell className="py-0.5 px-0 text-right font-light">
        <LabeledHandle
          id={fieldId}
          title={field.type.type_name}
          type="source"
          position={Position.Right}
          className="p-0"
          handleClassName="p-0"
          labelClassName="p-0 pr-2"
        />
      </TableCell>
      {children && <td>{children}</td>}
    </TableRow>
  );
};

function getFieldIcons(field: Field) {
  const { pk } = isUniqueFieldOrPK(field);
  const hasDetails = hasFieldDetails(field);
  
  const pkAttribute = pk ? <KeyRound size={ICON_SIZE} /> : null;
  const detailAttribute = hasDetails ? <StickyNote size={ICON_SIZE} /> : null;
  return (
    <>
      {pkAttribute}
      {detailAttribute}
    </>
  );
}
