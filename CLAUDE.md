# CLAUDE.md

## 做图表时：调用 diagram-design skill 作为辅助参考

以后凡是要画图表，都先用 `diagram-design` skill 作为辅助参考，再动手画。
范围包括架构图、流程图、时序图、状态机、ER、数据库 schema、泳道、象限、雷达、甘特、桑基、Wardley、组织架构、UML 类图等共 44 种类型，也包括把 `.drawio` / Mermaid / `.excalidraw` 重绘成可读的图。

使用方式：

1. 先确认 `~/.claude/skills/diagram-design/SKILL.md` 存在。不存在就按下面的"安装"自动装好，不用再问我。
2. 调用 `diagram-design` skill，按它的 SKILL.md 走：先选图表类型，再读对应的 `references/type-<类型>.md`，最后按 §9 检查清单自查。
3. 默认输出是单个自包含 `.html`（内联 SVG + CSS）。只有我要求时才导出 PNG / SVG，不要主动导出。
4. 用 `cd ~/.claude/skills/diagram-design && python3 scripts/self_check.py <文件>` 做自检。
5. 这个项目第一次出图时，它会问是否换成项目品牌样式（默认配色是 paper `#f5f5f5` / ink `#2d3142` / accent `#eb6c36`）。要如实问我，不要悄悄用默认样式。

## 安装 diagram-design skill（云端容器是临时的，每个新会话都要装一次）

来源是私有仓库 `jahsehchen/diagram-design-skill`，它是 [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)（MIT）的只读镜像。**不要修改仓库里的任何文件。**

1. 用 `add_repo` 把 `jahsehchen/diagram-design-skill` 加进会话范围（`access: read`）。它是私有仓库，不先加就拿不到。如果弹出确认，等我批准。
2. 克隆，只克隆一次，不要并行，命令超时设约 10 分钟：
   `mkdir -p ~/code && git clone --depth 1 https://github.com/jahsehchen/diagram-design-skill ~/code/diagram-design-skill`
   云端用 `git clone`，不用 `gh repo clone`（会话的 git 代理对该仓库限制并发）。遇到 HTTP 429 就等 10 秒再重试一次，不要循环重试。
3. 建立链接：
   `mkdir -p ~/.claude/skills && ln -sfn ~/code/diagram-design-skill/skills/diagram-design ~/.claude/skills/diagram-design`
4. 验证：`~/.claude/skills/diagram-design/SKILL.md` 可读，并且 `references/`、`assets/`、`scripts/` 三个目录都在。
5. 装完简要告诉我结果。

已知限制：

- `references/` 里提到的约 40 个 `verify-*.py` 和 `lint-skin.py` 是上游维护者工具，不在这个包里，调用会找不到文件。包里只有 5 个脚本：`self_check.py`、`export_svg.py`、`drawio_extract.py`、`mermaid_extract.py`、`excalidraw_extract.py`。
- 生成的 HTML 唯一的外部请求是 Google Fonts（Instrument Serif / Geist / Geist Mono）。
- 它的复杂度预算是每张图最多 9 个节点、12 条连线、2 处强调色。超了就拆成"总览 + 细节"，不要硬塞。

## 一键安装提示词（粘贴到任何新的云端会话）

```text
从私有仓库安装 diagram-design skill：
1. 用 add_repo 把 jahsehchen/diagram-design-skill 加进会话（只读）。
2. git clone --depth 1 https://github.com/jahsehchen/diagram-design-skill ~/code/diagram-design-skill
   （只克隆一次，超时设 10 分钟；遇到 429 等 10 秒重试一次）
3. mkdir -p ~/.claude/skills && ln -sfn ~/code/diagram-design-skill/skills/diagram-design ~/.claude/skills/diagram-design
4. 验证 ~/.claude/skills/diagram-design/SKILL.md 能读到，并确认 references/、assets/、scripts/ 三个目录都在。
装完告诉我支持哪些图表类型、生成什么格式。不要修改仓库里的任何文件。
```
