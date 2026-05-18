import { isHiddenByFoldedAncestors } from "@/lib/dbml/nested-group.parser";
import { cn } from "@/lib/utils";
import useStore from "@/state/store";
import { type GroupNodeType } from "@/types/nodes.types";
import { type NodeProps } from "@xyflow/react";
import { useMemo } from "react";
import { BaseNode } from "./base-node";
import { TableFoldHeader } from "./table-fold-header";

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
      <TableFoldHeader
        id={id}
        headerColor={data.color}
        label={data.label}
        selected={selected}
        data={data}
        folded={data.folded}
        className="pointer-events-auto"
      />
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
