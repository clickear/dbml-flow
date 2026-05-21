import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GroupHeaderTooltipView } from "./group-header-tooltip-view";
import { HeaderNoteAdornment } from "./header-note-adornment";

test("renders group header tooltip with label and note", () => {
  const html = renderToStaticMarkup(
    <GroupHeaderTooltipView label="ecommerce" note="Group summary" />,
  );

  assert.match(html, /ecommerce/);
  assert.match(html, /Group summary/);
});

test("renders note adornment only when note exists", () => {
  const withNote = renderToStaticMarkup(
    <>{HeaderNoteAdornment({ note: "Group summary" })}</>,
  );
  const withoutNote = renderToStaticMarkup(
    <>{HeaderNoteAdornment({ note: undefined })}</>,
  );

  assert.match(withNote, /svg/);
  assert.equal(withoutNote, "");
});
