import assert from "node:assert/strict";
import test from "node:test";

import { getLayoutOptionButtonVisualState } from "./rearrange-button.helpers";

test("active layout option uses a strong inline visual state", () => {
  const state = getLayoutOptionButtonVisualState(true);

  assert.equal(state["aria-pressed"], true);
  assert.equal(state.style.background, "#e0f2fe");
  assert.equal(state.style.color, "#075985");
  assert.equal(
    state.style["--xy-controls-button-background-color-hover-props"],
    "#e0f2fe",
  );
  assert.equal(
    state.style["--xy-controls-button-color-hover-props"],
    "#075985",
  );
  assert.equal(state.style.boxShadow, undefined);
});

test("inactive layout option has no active inline visual override", () => {
  const state = getLayoutOptionButtonVisualState(false);

  assert.equal(state["aria-pressed"], false);
  assert.equal(
    state.style["--xy-controls-button-background-color-hover-props"],
    "#e0f2fe",
  );
  assert.equal(
    state.style["--xy-controls-button-color-hover-props"],
    "#075985",
  );
  assert.equal(state.style.background, undefined);
});
