# Todo

## Viewer
- [x] Floating edges 
- [x] Edge labels
- [ ] Edge hover
- [x] Edge heads distribution
- [x] Edge heads (one-optionnal, one, many) + label
- [x] Groups 
- [x] Groups folding 
- [x] Show relation fields only
- [x] Show table header only
- [x] Enums 
- [ ] Composite foreign keys

## Notes 
- [x] Floating Notes 
  - [ ] Automatic layout participation
  - [ ] Rich text editor / toolbar
  - [ ] Drag coupling to table/group owners
- [x] Table Notes
- [x] Field Notes

## Editor 
- [x] Color picker
- [x] Focus on double click node/fields
- [x] Focus on double click edge
- [x] Focus on double click group

## Misc
- [ ] Generate svg, png
- [ ] Download image from url (server side)
- [x] Hide editor 
- [x] Viewer mode
- [ ] Download dbml file from url (add warning when try to modify code)

## Bugs / to investigate
- [ ] Function getTextWidth() returns wrong value on startup (8 instead of 7)
- [x] Scroll bar missing on editor
- [ ] Could group size and bounds be calculated inside component instead of state store ?

# Changelog

## 2026-05-21
- Added floating DBML `Note` nodes on the canvas with saved positions and minimap support.
- Added editor/canvas bidirectional navigation for `Note` declarations.
- Added note attachment metadata via `@attach table:...` and `@attach group:...`, with attached notes hiding alongside hidden owners.

## 2026-05-18
- Added bidirectional double-click navigation between the DBML editor and canvas for tables, fields, TableGroups, and refs.
- Added Unicode, quoted identifier, table alias, TableGroup, nested group, and commented ref support for navigation source mapping.
- Kept editor-to-canvas navigation pan-only at the current zoom, auto-expanding folded tables/groups when focusing targets.

# Sources 

- Edge : https://codesandbox.io/p/devbox/stoic-rgb-rycpgy
- Inspiration : https://github.com/kiranojhanp/schemaflow
