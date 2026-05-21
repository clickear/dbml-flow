# Changelog

## Unreleased

### Added
- Added attached-top sticky notes for tables and table groups, with expand/collapse transitions between owner bars and floating notes.
- Added detached sticky-note persistence so dragging an attached folded note turns it into an independent floating note across reloads and saved views.
- Added a DBML feature support matrix to `ReadMe.md`, comparing official syntax coverage against the current app behavior.
- Added `TableGroup` header note icons and tooltips for DBML group notes.
- Table field rows now reuse the shared highlight colors for direct hover, related table hover, and ref hover.
- Hovering a ref now highlights both endpoint fields with the same field hover treatment.

### Changed
- Attached sticky notes now default to collapsed top bars above their owners instead of the previous docked fallback behavior.
- Table-group attached note bars now cap their folded width while table-attached bars match the owner table width.
- Field highlight matching now treats the field's own table as a valid ref target during table hover.
- Ref endpoint schema matching now falls back to the field's own schema when DBML omits the schema name.

## 2026-05-21

### Recent commits
- `09d9c16` `feat: improve minimap navigation and add changelog`
  - Added root `CHANGELOG.md`.
  - Enabled minimap drag, zoom, horizontal wheel panning, and `Shift + wheel` horizontal panning.
  - Moved minimap horizontal wheel handling to an outer capture layer because `MiniMap` does not forward `onWheel` to its internal `svg`.

## 2026-05-20

### Recent commits
- `d835b81` `feat: highlight relations on table and ref hover`
  - Reused the shared highlight color for relation edges.
  - Unified edge highlighting across table selection, table hover, and ref hover.
  - Added edge interaction and visual-state tests.
- `7fe5c1a` `feat: add layout mode picker`
  - Added inline layout mode selection in the control row.
  - Added tests for the layout mode control visual state.
  - Added a layout mode implementation plan document.
- `07d7131` `docs: add layout mode picker design`
  - Added the layout mode picker design spec under `docs/superpowers/specs/`.
- `2b6cb80` `Change default layout mode to 'compact'`
  - Switched the default layout mode from the previous setting to `compact`.
- `cd48667` `chore: remove legacy layout utilities`
  - Removed old layout utility code no longer used by the orchestrated layout path.
- `571f98f` `feat: integrate async layout orchestration`
  - Moved layout execution into an async orchestration flow in the store.
  - Updated rearrange behavior to work with the async layout path.
- `f6f3387` `feat: orchestrate layout strategies`
  - Added the layout orchestrator and its dedicated test coverage.
- `d0cc2a8` `feat: add elk layout strategy`
  - Added ELK-based layout strategy implementation and tests.

## 2026-05-19

### Documentation
- Added layout algorithm refactor design and implementation plan documents under `docs/superpowers/`.
