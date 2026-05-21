import { isHiddenByFoldedAncestors } from "@/lib/dbml/nested-group.parser";
import { cn } from "@/lib/utils";
import useStore from "@/state/store";
import { type GroupNodeType } from "@/types/nodes.types";
import { type NodeProps } from "@xyflow/react";
import { useMemo } from "react";
import { BaseNode } from "./base-node";
import { TableFoldHeader } from "./table-fold-header";
import { HeaderNoteAdornment } from "./table-tooltip/header-note-adornment";
import { GroupHeaderTooltipView } from "./table-tooltip/group-header-tooltip-view";
import {
  TableTooltipAnchor,
  TableTooltip,
  TableTooltipContent,
  TableTooltipTrigger,
} from "./table-tooltip/table-tooltip";

function GroupHeader({
  selected,
  data,
  id,
}: Pick<NodeProps<GroupNodeType>, "selected" | "data" | "id">) {
  const header = (
    <TableFoldHeader
      id={id}
      headerColor={data.color}
      label={data.label}
      selected={selected}
      data={data}
      folded={data.folded}
      className="pointer-events-auto"
      afterTitle={<HeaderNoteAdornment note={data.note} />}
    />
  );

  if (!data.note) {
    return header;
  }

  return (
    <TableTooltip>
      <TableTooltipTrigger>{header}</TableTooltipTrigger>
      <TableTooltipContent>
        <GroupHeaderTooltipView label={data.label} note={data.note} />
      </TableTooltipContent>
    </TableTooltip>
  );
}

type TableGroupNodeBodyProps = NodeProps<GroupNodeType> & {
  hidden: boolean;
};

function TableGroupNodeBody({
  selected,
  data,
  id,
  hidden,
}: TableGroupNodeBodyProps) {
  const { width, height } = data.dimensions;

  return (
    <TableTooltipAnchor>
      <BaseNode
        id={id}
        className={cn("p-0", data.folded ? "" : "flex flex-col h-full")}
        selected={selected}
        hidden={hidden}
        style={{
          borderColor: data.color,
          width,
          minWidth: width,
        }}
      >
        <GroupHeader selected={selected} data={data} id={id} />
        <div
          hidden={data.folded}
          className="flex-auto overflow-visible pointer-events-none"
          style={{
            backgroundColor: data.color,
            opacity: selected ? 0.4 : 0.25,
            width,
            minWidth: width,
            height,
            minHeight: height,
          }}
        />
      </BaseNode>
    </TableTooltipAnchor>
  );
}

function TableGroupNodeInParent({
  parentGroupId,
  ...props
}: NodeProps<GroupNodeType> & { parentGroupId: string }) {
  const nodes = useStore((s) => s.nodes);
  const foldedIds = useStore((s) => s.foldedIds);
  const hidden = useMemo(
    () => isHiddenByFoldedAncestors(parentGroupId, nodes, foldedIds),
    [parentGroupId, nodes, foldedIds],
  );
  return <TableGroupNodeBody {...props} hidden={hidden} />;
}

export const TableGroupNode = (props: NodeProps<GroupNodeType>) => {
  if (props.data.parentGroupId) {
    return (
      <TableGroupNodeInParent
        {...props}
        parentGroupId={props.data.parentGroupId}
      />
    );
  }
  return <TableGroupNodeBody {...props} hidden={false} />;
};
