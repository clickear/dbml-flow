import { useMemo } from "react";

import { BaseNode } from "@/components/base-node";
import { cn } from "@/lib/utils";
import { isHiddenByFoldedAncestors } from "@/lib/dbml/nested-group.parser";
import useStore from "@/state/store";
import { NodeTypes, type NoteNodeType, type NodeType } from "@/types/nodes.types";
import { type NodeProps } from "@xyflow/react";

function renderLine(line: string, index: number) {
  const trimmed = line.trim();
  if (!trimmed) {
    return <div key={index} className="h-2" />;
  }

  if (trimmed.startsWith("# ")) {
    return (
      <h3 key={index} className="text-sm font-semibold leading-5">
        {trimmed.slice(2)}
      </h3>
    );
  }

  if (trimmed.startsWith("- ")) {
    return (
      <p key={index} className="flex gap-2 text-sm leading-5">
        <span>&bull;</span>
        <span>{trimmed.slice(2)}</span>
      </p>
    );
  }

  return (
    <p key={index} className="text-sm leading-5 whitespace-pre-wrap">
      {line}
    </p>
  );
}

function isOwnerHiddenByFold(node: NodeType | undefined, nodes: NodeType[], foldedIds: Set<string>) {
  if (!node) {
    return false;
  }

  if (node.type === NodeTypes.TableGroup) {
    return (
      foldedIds.has(node.id) ||
      node.data.folded ||
      isHiddenByFoldedAncestors(node.data.parentGroupId, nodes, foldedIds)
    );
  }

  if (node.type === NodeTypes.Table) {
    return isHiddenByFoldedAncestors(node.data.groupId, nodes, foldedIds);
  }

  return false;
}

export function StickyNoteNode({ id, data, selected }: NodeProps<NoteNodeType>) {
  const nodes = useStore((state) => state.nodes);
  const foldedIds = useStore((state) => state.foldedIds);

  const hidden = useMemo(() => {
    if (!data.ownerNodeId) {
      return false;
    }
    const owner = nodes.find((node) => node.id === data.ownerNodeId);
    return isOwnerHiddenByFold(owner, nodes, foldedIds);
  }, [data.ownerNodeId, foldedIds, nodes]);

  return (
    <BaseNode
      id={id}
      selected={selected}
      hidden={hidden}
      className={cn("max-w-[280px] border-0 p-0 shadow-md")}
      style={{
        width: data.guessedDimensions?.width ?? 280,
        minWidth: data.guessedDimensions?.width ?? 280,
        backgroundColor: data.color,
      }}
    >
      <div className="border-b border-black/10 px-3 py-2 text-xs font-medium text-zinc-900">
        {data.label}
      </div>
      <div className="space-y-1 px-3 py-3 text-zinc-900">
        {data.lines.map(renderLine)}
      </div>
    </BaseNode>
  );
}
