import { exportFlowToPng } from "@/lib/export/export-image";
import useStore from "@/state/store";
import { ControlButton, useReactFlow } from "@xyflow/react";
import { Download } from "lucide-react";
import { useCallback, useState } from "react";

const title = "导出高清 PNG（2×）";

function ExportImageButton() {
  const { getNodes } = useReactFlow();
  const withExportRendering = useStore((s) => s.withExportRendering);
  const [exporting, setExporting] = useState(false);

  const handleClick = useCallback(async () => {
    const viewport = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;
    if (!viewport) {
      return;
    }

    setExporting(true);
    try {
      await withExportRendering(() =>
        exportFlowToPng(viewport, getNodes(), { pixelRatio: 2 }),
      );
    } catch (error) {
      console.error("Export failed:", error);
      window.alert(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }, [getNodes, withExportRendering]);

  return (
    <ControlButton
      onClick={handleClick}
      aria-label={title}
      title={title}
      disabled={exporting}
    >
      <Download className={exporting ? "opacity-50" : undefined} />
    </ControlButton>
  );
}

export default ExportImageButton;
