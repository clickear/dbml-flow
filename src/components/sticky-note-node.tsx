import { type MouseEvent, useCallback, useMemo } from "react";

import { BaseNode } from "@/components/base-node";
import { HEADER_HEIGHT } from "@/components/table-constants";
import { cn } from "@/lib/utils";
import { isHiddenByFoldedAncestors } from "@/lib/dbml/nested-group.parser";
import useStore from "@/state/store";
import { NodeTypes, type NoteNodeType, type NodeType } from "@/types/nodes.types";
import { type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronUp } from "lucide-react";

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

function isOwnerHiddenByFold(
  node: NodeType | undefined,
  nodes: NodeType[],
  foldedIds: Set<string>,
) {
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

function NoteHeader({
  label,
  color,
  isExpanded,
  onToggle,
  attachedTop,
}: {
  label: string;
  color?: string;
  isExpanded: boolean;
  onToggle: (event: MouseEvent<HTMLElement>) => void;
  attachedTop: boolean;
}) {
  const Icon = isExpanded ? ChevronUp : ChevronDown;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 text-xs font-medium text-zinc-900",
        isExpanded ? "border-b border-black/10" : "",
        attachedTop ? "rounded-t-[inherit]" : "",
      )}
      style={{
        backgroundColor: color,
        height: HEADER_HEIGHT,
      }}
      title={label}
    >
      <button
        type="button"
        onClick={onToggle}
        className="cursor-pointer shrink-0"
      >
        <Icon size="0.8rem" />
      </button>
      <span className="truncate">{label}</span>
    </div>
  );
}

export function StickyNoteNode({ id, data, selected }: NodeProps<NoteNodeType>) {
  const nodes = useStore((state) => state.nodes);
  const foldedIds = useStore((state) => state.foldedIds);
  const foldNode = useStore((state) => state.foldNode);

  const hidden = useMemo(() => {
    if (!data.ownerNodeId || data.detached) {
      return false;
    }
    const owner = nodes.find((node) => node.id === data.ownerNodeId);
    return isOwnerHiddenByFold(owner, nodes, foldedIds);
  }, [data.detached, data.ownerNodeId, foldedIds, nodes]);

  const onToggle = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      foldNode(id, !data.folded);
    },
    [data.folded, foldNode, id],
  );

  const isAttachedTop = data.displayMode === "folded-attached-top";
  const isExpanded = data.displayMode === "expanded-floating";

  return (
    <BaseNode
      id={id}
      selected={selected}
      hidden={hidden}
      className={cn(
        "border-0 p-0 shadow-md",
        isAttachedTop ? "rounded-xs shadow-sm" : "rounded-xs",
      )}
      style={{
        width: isAttachedTop
          ? data.dockedWidth ?? 18
          : data.guessedDimensions?.width ?? 280,
        minWidth: isAttachedTop
          ? data.dockedWidth ?? 18
          : data.guessedDimensions?.width ?? 280,
        backgroundColor: data.color,
      }}
    >
      <NoteHeader
        label={data.label}
        color={data.color}
        isExpanded={isExpanded}
        onToggle={onToggle}
        attachedTop={isAttachedTop}
      />
      {!isAttachedTop && isExpanded && (
        <div className="space-y-1 px-3 py-3 text-zinc-900">
          {data.lines.map(renderLine)}
        </div>
      )}
    </BaseNode>
  );
}
