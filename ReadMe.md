# Todo

## DBML 官方特性支持矩阵

> 对照官方文档整理：Core Syntax、Enrichment & Visualization、Module System  
> 官方文档：<https://dbml.dbdiagram.io/docs/>、<https://dbml.dbdiagram.io/syntax/enrichment-visualization>、<https://dbml.dbdiagram.io/syntax/module-system/>

| 特性 | 官方语法 | 支持情况 | 备注 |
| --- | --- | --- | --- |
| Project 定义 | `Project project_name { database_type: 'PostgreSQL' }` | ❌ | 当前没有 Project 级展示、跳转或设置消费。 |
| Project Note | `Project DBML { Note: '...' }` | ❌ | 当前没有 Project 级 note 展示。 |
| Schema 定义 / public 默认 schema | `Table core.user { ... }` / `Table user { ... }` | ✅ | 已支持 schema 名；未显式写 schema 时按 `public` 处理。 |
| Table 定义 | `Table users { ... }` | ✅ | 核心表渲染已支持。 |
| Table Alias | `Table users as U { ... }` | ✅ | 已支持 alias，并用于 Ref/source-map。 |
| Table Note | `Table users { Note: '...' }` | ✅ | 已支持表头提示展示。 |
| Table Settings | `Table users [headercolor: #3498DB] { ... }` | ✅ | 目前明确消费的是 `headercolor`；其他 table settings 未单独接入。 |
| Column 定义 | `id integer [pk, not null]` | ✅ | 基础字段渲染已支持。 |
| Column Settings | `id int [pk, unique, null, increment]` | ✅ | `pk/unique/not null/default/note/ref` 已基本可用；其余设置没有单独 UI 呈现。 |
| Default Value | `created_at timestamp [default: \`now()\`]` | ✅ | 已在字段 tooltip 中展示 `default`。 |
| Check 定义 | `checks { \`debt + wealth >= 0\` [name: 'chk'] }` | ❌ | 当前没有 check 渲染、tooltip 或 source-map 支持。 |
| Index 定义 | `indexes { (id, country) [pk] }` | ✅ | 已部分支持：会参与 `pk/unique` 判断；未提供 index 列表可视化。 |
| Index Settings | `created_at [name: 'idx', note: 'Date', type: hash]` | ✅ | 已部分支持：`pk/unique` 会生效；`name/type/note` 没有完整 UI 展示。 |
| Index Note | `indexes { created_at [note: 'Date'] }` | ❌ | 当前没有 index note 展示。 |
| Ref / Relationship 定义 | `Ref: posts.user_id > users.id` | ✅ | 已支持基础关系渲染、双向编辑器跳转、高亮。 |
| Inline Ref | `user_id int [ref: > users.id]` | ✅ | 已支持解析、渲染、source-map。 |
| Many-to-many Ref | `authors.id <> books.id` | ✅ | 基础关系类型可解析；实际展示仍按普通边呈现。 |
| Composite Foreign Keys | `Ref: merchant_periods.(merchant_id, country_code) > merchants.(id, country_code)` | ✅ | 已支持单条关系边、两侧组合关系行，以及多列 hover/跳转/高亮。 |
| Relationship Settings | `Ref: posts.user_id > users.id [delete: cascade, update: no action]` | ❌ | 当前没有消费 `delete/update` 等关系设置。 |
| Relationship Line Color | `Ref: posts.user_id > users.id [color: #79AD51]` | ❌ | 当前边颜色由应用交互态控制，不读取 ref 的 `color`。 |
| Enum 定义 | `enum job_status { created }` | ✅ | 已部分支持：字段 tooltip 可显示 enum 值；没有 enum 独立节点/跳转。 |
| Note 定义（结构注释） | `Note: '...'` / `Note { '...' }` | ✅ | 表 note、字段 note 已支持。 |
| Sticky Notes | `Note note_name { '...' }` | ✅ | 已支持浮动画布 note、attached-top note、编辑器双向跳转。 |
| TableGroup | `TableGroup e_commerce { merchants countries }` | ✅ | 已支持分组渲染、折叠、结构树。 |
| TableGroup Note | `TableGroup g [note: '...'] { ... }` / `Note: '...'` | ✅ | 已支持在分组头部显示 note 图标并通过 tooltip 展示内容。 |
| TableGroup Settings | `TableGroup g [color: #345] { ... }` | ✅ | 已支持 `color` 和 `note`。 |
| TablePartial | `TablePartial base { ... }` / `~base` | ❌ | 当前没有 TablePartial 注入后的可视化校验、source-map、编辑器完整支持。 |
| Records / Data Sample | `records users(id, name) { 1, 'Alice' }` | ❌ | 当前没有 records 渲染、跳转或高亮支持。 |
| Multi-line String | `''' multi line '''` | ✅ | note/sticky note 多行字符串已可用。 |
| Comments | `// comment` / `/* comment */` | ✅ | 编辑器和 source-map 对注释场景已有基础兼容。 |
| DiagramView | `DiagramView sales_view { Tables { users } }` | ❌ | 当前“saved views”是应用本地功能，不是 DBML `DiagramView`。 |
| Colors（Table / TableGroup） | `headercolor: #3498DB` / `TableGroup g [color: #345]` | ✅ | 表头色、分组色已支持。 |
| Module System | `use './shared/common.dbml'` / `reuse ...` | ❌ | 当前是单文件编辑/解析流程，没有模块导入系统。 |
| 官方未定义但项目扩展：嵌套 TableGroup | `TableGroup parent { child_group }` | ✅ | 这是项目自定义扩展，通过预处理支持；不属于官方标准语法。 |

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
- [x] Composite foreign keys

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
- Added attached-top sticky note bars for tables and table groups, with expand/collapse transitions to floating notes.
- Added detached sticky-note persistence so dragging a folded attached note makes it an independent floating note across reloads and saved views.
- Added a DBML official feature support matrix to this README, including unsupported and partial-coverage notes.

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
