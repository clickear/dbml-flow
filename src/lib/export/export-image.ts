import { minZoomLevel } from "@/components/viewer/viewer";
import {
  getNodesBounds,
  getViewportForBounds,
  type Node,
} from "@xyflow/react";
import { getFontEmbedCSS, toBlob } from "html-to-image";

/** Flow-space padding around nodes so edge labels are not clipped */
const EXPORT_PADDING = 48;
const DEFAULT_PIXEL_RATIO = 2;
const MAX_OUTPUT_PX = 8192;
const LAYOUT_SETTLE_MS = 50;

export type ExportImageOptions = {
  pixelRatio?: number;
  fileName?: string;
  backgroundColor?: string;
};

type StrokePatch = {
  path: SVGPathElement;
  stroke: string | null;
  strokeWidth: string | null;
  styleStroke: string;
  styleStrokeWidth: string;
};

function shouldIncludeCloneNode(domNode: globalThis.Node): boolean {
  if (!(domNode instanceof Element)) {
    return true;
  }
  if (domNode.classList.contains("react-flow__edge-interaction")) {
    return false;
  }
  if (domNode.classList.contains("react-flow__handle")) {
    return false;
  }
  return true;
}

function getExportBackground(): string {
  const flow = document.querySelector(".react-flow");
  if (flow) {
    const bg = getComputedStyle(flow).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)") {
      return bg;
    }
  }
  return getComputedStyle(document.body).backgroundColor || "#ffffff";
}

function resolvePixelRatio(
  imageWidth: number,
  imageHeight: number,
  requested?: number,
): number {
  const preferred = requested ?? DEFAULT_PIXEL_RATIO;
  const maxSide = Math.max(imageWidth, imageHeight) * preferred;
  if (maxSide <= MAX_OUTPUT_PX) {
    return preferred;
  }
  return Math.max(1, Math.floor(MAX_OUTPUT_PX / Math.max(imageWidth, imageHeight)));
}

async function waitForLayoutSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise((resolve) => setTimeout(resolve, LAYOUT_SETTLE_MS));
}

function patchEdgePaths(viewport: HTMLElement): StrokePatch[] {
  const patches: StrokePatch[] = [];

  viewport.querySelectorAll<SVGPathElement>(".react-flow__edge-path").forEach((path) => {
    patches.push({
      path,
      stroke: path.getAttribute("stroke"),
      strokeWidth: path.getAttribute("stroke-width"),
      styleStroke: path.style.stroke,
      styleStrokeWidth: path.style.strokeWidth,
    });

    const computed = getComputedStyle(path);
    path.setAttribute("stroke", computed.stroke);
    path.setAttribute("stroke-width", computed.strokeWidth);
    path.style.stroke = computed.stroke;
    path.style.strokeWidth = computed.strokeWidth;
    path.setAttribute("fill", "none");
  });

  return patches;
}

function restoreEdgePaths(patches: StrokePatch[]) {
  for (const { path, stroke, strokeWidth, styleStroke, styleStrokeWidth } of patches) {
    if (stroke === null) {
      path.removeAttribute("stroke");
    } else {
      path.setAttribute("stroke", stroke);
    }
    if (strokeWidth === null) {
      path.removeAttribute("stroke-width");
    } else {
      path.setAttribute("stroke-width", strokeWidth);
    }
    path.style.stroke = styleStroke;
    path.style.strokeWidth = styleStrokeWidth;
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = fileName;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Renders the React Flow viewport to a PNG and triggers download.
 */
export async function exportFlowToPng(
  viewportElement: HTMLElement,
  nodes: Node[],
  options: ExportImageOptions = {},
): Promise<void> {
  const visibleNodes = nodes.filter((n) => !n.hidden);
  if (visibleNodes.length === 0) {
    throw new Error("没有可导出的节点");
  }

  const nodeBounds = getNodesBounds(visibleNodes);
  const bounds = {
    x: nodeBounds.x - EXPORT_PADDING,
    y: nodeBounds.y - EXPORT_PADDING,
    width: nodeBounds.width + EXPORT_PADDING * 2,
    height: nodeBounds.height + EXPORT_PADDING * 2,
  };
  const imageWidth = Math.max(1, Math.ceil(bounds.width));
  const imageHeight = Math.max(1, Math.ceil(bounds.height));

  const pixelRatio = resolvePixelRatio(
    imageWidth,
    imageHeight,
    options.pixelRatio,
  );

  const viewport = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    minZoomLevel,
    2,
    0,
  );

  const strokePatches = patchEdgePaths(viewportElement);
  const fontEmbedCSS = await getFontEmbedCSS(viewportElement);
  await waitForLayoutSettle();

  try {
    const blob = await toBlob(viewportElement, {
      backgroundColor: options.backgroundColor ?? getExportBackground(),
      width: imageWidth,
      height: imageHeight,
      pixelRatio,
      skipFonts: false,
      fontEmbedCSS,
      filter: shouldIncludeCloneNode,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        overflow: "visible",
      },
    });
    if (!blob) {
      throw new Error("导出失败");
    }

    const fileName =
      options.fileName ??
      `dbml-flow-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    downloadBlob(blob, fileName);
  } finally {
    restoreEdgePaths(strokePatches);
  }
}
