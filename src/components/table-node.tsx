import { hasFieldDetails } from "@/lib/dbml/dbml.utils";
import { isHiddenByFoldedAncestors } from "@/lib/dbml/nested-group.parser";
import { cn } from "@/lib/utils";
import useStore from "@/state/store";
import { type TableNodeType } from "@/types/nodes.types";
import type { Field, Table } from "@dbml/core";
import { type NodeProps, useUpdateNodeInternals } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import { BaseNode } from "./base-node";
import { TableFoldHeader } from "./table-fold-header";
import { TableField } from "./table-node-field";
import { TableFieldTooltipView } from "./table-tooltip/table-field-tooltip-view";
import { HeaderNoteAdornment } from "./table-tooltip/header-note-adornment";
import { TableHeaderTooltipView } from "./table-tooltip/table-header-tooltip-view";
import {
  TableTooltip,
  TableTooltipAnchor,
  TableTooltipContent,
  TableTooltipTrigger,
} from "./table-tooltip/table-tooltip";
import { TableBody } from "./ui/table";
function buildField(field: Field, table: Table, isRelationOnly: boolean) {
  const hasDetails = hasFieldDetails(field);
  if (!hasDetails)
    return (
      <TableField
        key={field.name}
        field={field}
        table={table}
        isRelationOnly={isRelationOnly}
      />
    );

  return (
    <TableTooltip key={field.name}>
      <TableTooltipTrigger>
        <TableField
          field={field}
          table={table}
          isRelationOnly={isRelationOnly}
        ></TableField>
      </TableTooltipTrigger>
      <TableTooltipContent>
        <TableFieldTooltipView field={field} />
      </TableTooltipContent>
    </TableTooltip>
  );
}

function Header({
  selected,
  data,
  id,
}: Pick<NodeProps<TableNodeType>, "selected" | "data" | "id">) {
  const hasNote = !!data.table.note;
  const sharedProps = {
    id,
    data,
    selected,
    headerColor: data.color,
    label: data.label,
    folded: data.folded,
  };

  if (!hasNote) {
    return <TableFoldHeader {...sharedProps} />;
  }

  return (
    <TableTooltip>
      <TableTooltipTrigger>
        <TableFoldHeader
          {...sharedProps}
          afterTitle={<HeaderNoteAdornment note={data.table.note} />}
        />
      </TableTooltipTrigger>
      <TableTooltipContent>
        <TableHeaderTooltipView table={data.table} />
      </TableTooltipContent>
    </TableTooltip>
  );
}

type TableNodeBodyProps = NodeProps<TableNodeType> & {
  hidden: boolean;
};

function TableNodeBody({
  selected,
  data,
  id,
  hidden,
}: TableNodeBodyProps) {
  const { relationOnly, overrideRelationOnly, relationOnlyOverrides } =
    useStore();
  const updateNodeInternals = useUpdateNodeInternals();
  const isRelationOnly = relationOnly && !relationOnlyOverrides.has(id);

  const relationOnlyCallback = useCallback(() => {
    overrideRelationOnly(id, isRelationOnly);
    updateNodeInternals(id);
  }, [id, isRelationOnly, overrideRelationOnly, updateNodeInternals]);

  return (
    <TableTooltipAnchor>
      <BaseNode
        id={id}
        className="p-0 flex flex-col overflow-hidden"
        style={{
          width: data.guessedDimensions?.width,
          minWidth: data.guessedDimensions?.width,
          maxWidth: data.guessedDimensions?.width,
          boxSizing: "border-box",
        }}
        selected={selected}
        hidden={hidden}
      >
        <Header selected={selected} data={data} id={id} />

        {/* shadcn Table cannot be used because of hardcoded overflow-auto */}

        <table
          className={cn(
            "border-spacing-10",
            data.folded ? "hidden" : "", // avoid this warning
            // Couldn't create edge for source handle id: "f-ecommerce.product_tags.id", edge id: 7. Help: https://reactflow.dev/error#008
          )}
        >
          <TableBody>
            {data.table.fields.map((field) =>
              buildField(field, data.table, isRelationOnly),
            )}
          </TableBody>
        </table>
        {relationOnly && !data.folded && (
          <div
            className="hover:bg-accent flex items-center justify-center cursor-pointer"
            onClick={relationOnlyCallback}
            title={
              isRelationOnly ? "Show all fields" : "Show only relations fields"
            }
          >
            <p>...</p>
          </div>
        )}
      </BaseNode>
    </TableTooltipAnchor>
  );
}

function TableNodeInGroup({
  groupId,
  ...props
}: NodeProps<TableNodeType> & { groupId: string }) {
  const nodes = useStore((s) => s.nodes);
  const foldedIds = useStore((s) => s.foldedIds);
  const hidden = useMemo(
    () => isHiddenByFoldedAncestors(groupId, nodes, foldedIds),
    [groupId, nodes, foldedIds],
  );
  return <TableNodeBody {...props} hidden={hidden} />;
}

export const TableNode = (props: NodeProps<TableNodeType>) => {
  if (props.data.groupId) {
    return <TableNodeInGroup {...props} groupId={props.data.groupId} />;
  }
  return <TableNodeBody {...props} hidden={false} />;
};
