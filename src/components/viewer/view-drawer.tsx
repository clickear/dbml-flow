import { buildStructureTree, type StructureTreeItem } from "@/lib/views/structure-tree";
import useStore from "@/state/store";
import type { NodeType } from "@/types/nodes.types";
import type { Viewport } from "@xyflow/react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  FolderTree,
  Save,
  Table2,
} from "lucide-react";
import { useMemo, useState } from "react";

type ViewDrawerProps = {
  nodes: NodeType[];
  getViewport: () => Viewport;
  applyViewport: (viewport: Viewport) => void;
  focusNode: (nodeId: string) => void;
};

type TreeItemProps = {
  item: StructureTreeItem;
  hiddenNodeIds: Set<string>;
  hiddenRootNodeIds: Set<string>;
  onToggleHidden: (nodeId: string) => void;
  onFocusNode: (nodeId: string) => void;
};

function countVisibleChildren(
  item: StructureTreeItem,
  hiddenNodeIds: Set<string>,
) {
  let total = 0;
  let visible = 0;

  const visit = (child: StructureTreeItem) => {
    total += 1;
    if (!hiddenNodeIds.has(child.id)) visible += 1;
    child.children.forEach(visit);
  };

  item.children.forEach(visit);
  return { total, visible };
}

function TreeItem({
  item,
  hiddenNodeIds,
  hiddenRootNodeIds,
  onToggleHidden,
  onFocusNode,
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isHidden = hiddenNodeIds.has(item.id);
  const isRootHidden = hiddenRootNodeIds.has(item.id);
  const hasChildren = item.children.length > 0;
  const childCount = countVisibleChildren(item, hiddenNodeIds);
  const TypeIcon = item.type === "group" ? FolderTree : Table2;
  const handlePrimaryClick = () => {
    if (item.type === "group" && hasChildren) {
      setExpanded((value) => !value);
      return;
    }
    onFocusNode(item.id);
  };

  return (
    <li className="text-sm">
      <div
        className="group flex h-8 items-center gap-1 rounded px-2 hover:bg-accent"
        title={item.label}
      >
        {hasChildren && (
          <button
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-secondary"
            aria-label={expanded ? "Collapse tree item" : "Expand tree item"}
            title={expanded ? "Collapse" : "Expand"}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        {!hasChildren && <span className="h-6 w-6 shrink-0" />}
        <TypeIcon
          size={15}
          className={item.type === "group" ? "shrink-0 text-chart-2" : "shrink-0 text-chart-3"}
        />
        <button
          className="min-w-0 flex-1 truncate text-left"
          onClick={handlePrimaryClick}
        >
          <span className={isHidden ? "text-muted-foreground line-through" : ""}>
            {item.label}
          </span>
        </button>
        {hasChildren && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {childCount.visible}/{childCount.total}
          </span>
        )}
        <button
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-70 hover:bg-secondary hover:opacity-100 group-hover:opacity-100"
          aria-label={isRootHidden ? "Show node" : "Hide node"}
          title={isRootHidden ? "Show node" : "Hide node"}
          onClick={() => onToggleHidden(item.id)}
        >
          {isRootHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hasChildren && expanded && (
        <ul className="ml-4 border-l border-border pl-2">
          {item.children.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              hiddenNodeIds={hiddenNodeIds}
              hiddenRootNodeIds={hiddenRootNodeIds}
              onToggleHidden={onToggleHidden}
              onFocusNode={onFocusNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ViewDrawer({
  nodes,
  getViewport,
  applyViewport,
  focusNode,
}: ViewDrawerProps) {
  const [newViewName, setNewViewName] = useState("");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const {
    savedViews,
    activeViewId,
    applySavedView,
    saveActiveView,
    saveViewAs,
    viewDrawerOpen,
    setViewDrawerOpen,
    hiddenNodeIds,
    hiddenRootNodeIds,
    toggleNodeHidden,
  } = useStore();
  const tree = useMemo(() => buildStructureTree(nodes), [nodes]);
  const activeView = savedViews.find((view) => view.id === activeViewId);

  const applySelectedView = (viewId: string) => {
    const view = applySavedView(viewId);
    if (view) applyViewport(view.viewport);
    setViewMenuOpen(false);
  };

  if (!viewDrawerOpen) {
    return (
      <button
        className="absolute right-0 top-4 z-20 flex h-10 w-8 items-center justify-center rounded-l border border-r-0 bg-background shadow"
        aria-label="Open views drawer"
        title="Open views drawer"
        onClick={() => setViewDrawerOpen(true)}
      >
        <ChevronLeft size={16} />
      </button>
    );
  }

  return (
    <aside className="absolute bottom-0 right-0 top-0 z-20 flex w-72 flex-col border-l bg-background shadow-lg">
      <div className="flex h-11 items-center gap-2 border-b px-2">
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent"
          aria-label="Collapse views drawer"
          title="Collapse views drawer"
          onClick={() => setViewDrawerOpen(false)}
        >
          <ChevronRight size={16} />
        </button>
        <div className="relative min-w-0 flex-1">
          <button
            className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded border bg-background px-2 text-sm hover:bg-accent"
            aria-label="Saved view"
            aria-expanded={viewMenuOpen}
            onClick={() => setViewMenuOpen((value) => !value)}
          >
            <span className="min-w-0 truncate text-left">
              {activeView?.name ?? "Select view"}
            </span>
            <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
          </button>
          {viewMenuOpen && (
            <div className="absolute left-0 right-0 top-9 z-30 overflow-hidden rounded border bg-popover text-popover-foreground shadow-lg">
              {savedViews.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No saved views
                </div>
              ) : (
                savedViews.map((view) => (
                  <button
                    key={view.id}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => applySelectedView(view.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{view.name}</span>
                    {view.id === activeViewId && <Check size={14} />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent disabled:opacity-40"
          aria-label="Save current view"
          title="Save current view"
          disabled={!activeViewId}
          onClick={() => saveActiveView(getViewport())}
        >
          <Save size={15} />
        </button>
      </div>
      <div className="flex items-center gap-2 border-b p-2">
        <input
          className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm"
          value={newViewName}
          onChange={(event) => setNewViewName(event.target.value)}
          placeholder="New view name"
        />
        <button
          className="rounded border px-2 py-1 text-sm hover:bg-accent"
          onClick={() => {
            saveViewAs(newViewName, getViewport());
            setNewViewName("");
          }}
        >
          Save as
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <ul className="space-y-1">
          {tree.map((item) => (
            <TreeItem
              key={item.id}
              item={item}
              hiddenNodeIds={hiddenNodeIds}
              hiddenRootNodeIds={hiddenRootNodeIds}
              onToggleHidden={toggleNodeHidden}
              onFocusNode={focusNode}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}
