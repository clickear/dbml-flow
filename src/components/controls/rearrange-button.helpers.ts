import type { CSSProperties } from "react";

type ControlButtonStyle = CSSProperties & Record<`--${string}`, string>;

const layoutOptionHoverStyle = {
  "--xy-controls-button-background-color-hover-props": "#e0f2fe",
  "--xy-controls-button-color-hover-props": "#075985",
} satisfies ControlButtonStyle;

export function getLayoutOptionButtonVisualState(active: boolean): {
  "aria-pressed": boolean;
  style: ControlButtonStyle;
} {
  if (!active) {
    return {
      "aria-pressed": false,
      style: layoutOptionHoverStyle,
    };
  }

  return {
    "aria-pressed": true,
    style: {
      ...layoutOptionHoverStyle,
      background: "#e0f2fe",
      color: "#075985",
    },
  };
}
