import { cn } from "@/lib/utils";
import useStore from "@/state/store";
import type { LayoutMode } from "@/lib/layout/layout.types";
import { ControlButton, useReactFlow } from "@xyflow/react";
import { Snowflake, Table2, WandSparkles } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { getLayoutOptionButtonVisualState } from "./rearrange-button.helpers";

const title = "rearrange nodes";
const layoutOptions: Array<{
  mode: LayoutMode;
  label: string;
  title: string;
  icon?: ReactNode;
}> = [
  {
    mode: "leftright",
    label: "LR",
    title: "Apply left-right layout",
  },
  {
    mode: "snowflake",
    label: "Snowflake",
    title: "Apply snowflake layout",
    icon: <Snowflake size={16} />,
  },
  {
    mode: "compact",
    label: "Compact",
    title: "Apply compact layout",
    icon: <Table2 size={16} />,
  },
];

function RearrangeButton() {
  const { layoutMode, onLayout, setLayoutMode } = useStore();
  const { fitView } = useReactFlow();
  const [expanded, setExpanded] = useState(false);

  const handleClick = useCallback(() => {
    setExpanded((value) => !value);
  }, []);

  const applyLayout = useCallback(
    (mode: LayoutMode) => {
      setLayoutMode(mode);
      onLayout(fitView, mode);
      setExpanded(false);
    },
    [fitView, onLayout, setLayoutMode],
  );

  return (
    <div className="flex">
      <ControlButton onClick={handleClick} aria-label={title} title={title}>
        <WandSparkles />
      </ControlButton>
      {expanded &&
        layoutOptions.map((option) => {
          const active = option.mode === layoutMode;
          const visualState = getLayoutOptionButtonVisualState(active);
          return (
            <ControlButton
              key={option.mode}
              onClick={() => applyLayout(option.mode)}
              aria-label={option.title}
              aria-pressed={visualState["aria-pressed"]}
              title={option.title}
              style={visualState.style}
              className={cn(
                "w-auto min-w-10 px-2 text-xs font-medium",
                active && "font-semibold",
              )}
            >
              {option.icon ?? option.label}
            </ControlButton>
          );
        })}
    </div>
  );
}

export default RearrangeButton;
