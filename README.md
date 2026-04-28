# ChatGPT / Gemini -> Obsidian Canvas Exporter

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](manifest.json)
[![MIT License](https://img.shields.io/badge/License-MIT-111111?style=flat-square)](LICENSE)
[![Obsidian Canvas](https://img.shields.io/badge/Obsidian-Canvas%20%2B%20Markdown-7C3AED?style=flat-square)](https://obsidian.md/)
[![Release](https://img.shields.io/github/v/release/lilinmadoka/chatgpt-gemini-obsidian-canvas-exporter?style=flat-square)](https://github.com/lilinmadoka/chatgpt-gemini-obsidian-canvas-exporter/releases/tag/v0.2.4)

把 ChatGPT 和 Google Gemini 的长对话，整理成可以长期保存、回看和关联的 Obsidian 知识库内容。

This Chrome extension turns ChatGPT and Google Gemini conversations into Obsidian-ready Markdown notes, Canvas maps, image assets, and an optional reading-style CSS snippet.

## 简单概述 / In One Line

选择你想保存的对话轮次，一次导出为 Markdown、JSON Canvas、图片附件和 Obsidian 样式，让 AI 对话从网页临时记录变成可维护的知识结构。

Select the rounds you care about and export them into structured Obsidian notes, a readable Canvas graph, local image assets, and a matching CSS snippet.

## 为什么需要它 / Why This Exists

AI 对话经常包含推理过程、方案讨论、代码解释、资料整理和图片上下文，但网页会话并不适合长期管理。这个扩展把对话拆成“每一轮一个笔记”，再用 Canvas 把上下文串起来，适合复盘、写作、学习和项目归档。

AI chats often contain real working context: reasoning, decisions, code, references, and images. This extension preserves that context in Obsidian instead of leaving it locked inside a browser tab.

## 核心能力 / Core Capabilities

| 能力 | 说明 |
| --- | --- |
| 轮次选择 | 自动识别“用户提问 + AI 回复”，在导出前选择需要保存的轮次。 |
| 单轮笔记 | 每一轮生成独立 `.md` 文件，标题和正文开头优先使用该轮用户问题。 |
| Canvas 画布 | 自动生成 `.canvas`，每个节点对应一轮对话，并按对话顺序连线。 |
| 图片附件 | 导出对话中的图片，保留在笔记中的出现位置，可尽量压缩为 WebP。 |
| Obsidian 样式 | 可生成 `chatgpt-export.css`，让阅读视图更接近 ChatGPT / Gemini 的消息块体验。 |
| 子文件夹路径 | 支持导入到 vault 根目录或目标子文件夹，并为 Canvas 写入正确的 vault-relative 路径。 |
| 常用路径 | 成功导出后记录常用 Obsidian 内路径，可快速选择，也可随时删除。 |

## 导出后得到什么 / What You Get

| 文件 | 用途 |
| --- | --- |
| `01 - question.md` | 每轮对话的可读笔记，适合搜索、链接和二次整理。 |
| `Conversation.canvas` | Obsidian Canvas 画布，按轮次展示完整对话结构。 |
| `assets/` | 图片附件目录，笔记会在原位置引用对应图片。 |
| `chatgpt-export.css` | 可选 CSS snippet，用于改善 Obsidian 阅读体验。 |

## 支持站点 / Supported Sites

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://gemini.google.com/*`

## 快速开始 / Quick Start

1. 下载最新版本：[v0.2.4 release](https://github.com/lilinmadoka/chatgpt-gemini-obsidian-canvas-exporter/releases/tag/v0.2.4)。
2. 打开 `chrome://extensions/`，启用“开发者模式”，点击“加载已解压的扩展程序”，选择本项目文件夹。
3. 打开 ChatGPT 或 Gemini 对话页，点击扩展图标，刷新轮次，选择导出位置，然后导出到 Obsidian。

English: download the release, load the folder as an unpacked Chrome extension, open a ChatGPT or Gemini conversation, refresh rounds, choose an Obsidian target, and export.

## 推荐工作流 / Recommended Workflow

### 1. 选择对话

打开一个具体的 ChatGPT 或 Gemini 对话页面，点击扩展图标进入导出面板。

### 2. 筛选轮次

点击“刷新轮次”，确认识别出的轮次数、底层消息数和图片数，只勾选需要归档的部分。

### 3. 导出到 Obsidian

选择仓库根目录或目标子文件夹。扩展会生成笔记、Canvas、图片目录和可选 CSS 样式文件。

## Obsidian 路径模式 / Obsidian Path Modes

Obsidian Canvas 的 `file` 字段使用 vault-relative path。浏览器出于隐私限制，通常不会把所选目录的完整本地路径暴露给扩展，所以本扩展会让你明确 Obsidian 内路径。

The Canvas `file` field is resolved relative to the Obsidian vault. Browsers usually do not expose the full local path, so the extension asks for the vault-relative path when needed.

| 模式 | 适合场景 | 实际写入 | Canvas 指向 |
| --- | --- | --- | --- |
| 选择仓库根目录 | 想让扩展同时写入 `.obsidian/snippets` | `目标子路径/对话目录/` | `目标子路径/对话目录/01 - xxx.md` |
| 选择目标子文件夹 | 想直接选中 `计算物理` 这类文件夹 | `对话目录/` | `计算物理/对话目录/01 - xxx.md` |

示例：

```text
vault root: English
target path: 计算物理
conversation folder: Config - 自动化脚本的配置说明 - Google Gemini

Canvas file path:
计算物理/Config - 自动化脚本的配置说明 - Google Gemini/01 - 你说 Config什么意思.md
```

嵌套目录可以填写 `课程/计算物理`。路径历史会保存在本地，下次可以直接选择。

## CSS Snippet

勾选“写入 Obsidian 样式文件”后，扩展会生成 `chatgpt-export.css`。

- 选择仓库根目录时：写入 `.obsidian/snippets/chatgpt-export.css`。
- 选择目标子文件夹时：不会在子目录里错误创建 `.obsidian`，而是把 CSS 和说明放入本次导出的对话目录。

在 Obsidian 中启用：

```text
设置 -> 外观 -> CSS 代码片段 -> chatgpt-export
```

## 隐私 / Privacy

- 对话提取、Markdown 生成、Canvas 生成和图片处理都在本地浏览器完成。
- 常用路径历史只保存 Obsidian vault 内相对路径，例如 `计算物理` 或 `课程/计算物理`。
- 路径历史保存在 `chrome.storage.local`，不会保存你的本机绝对路径。
- 扩展不会把导出的对话内容发送到第三方服务器。

All extraction and export work happens locally in the browser. The extension stores only vault-relative path history and does not upload your conversation content.

## 已知限制 / Known Limitations

- ChatGPT 和 Gemini 的网页 DOM 不是公开稳定接口，站点改版后可能需要更新提取逻辑。
- Gemini 主要通过页面 DOM 提取，折叠、动态加载或实验性界面可能需要刷新页面后再导出。
- 浏览器不会向扩展暴露完整本地路径，因此直接选择目标子文件夹时需要手动确认 Obsidian 内路径。
- 图片导出依赖浏览器能否访问原始图片资源；失败时会退回到原始链接或导出失败提示。

## 项目结构 / Project Structure

| 文件 | 职责 |
| --- | --- |
| `manifest.json` | Chrome Manifest V3 扩展清单。 |
| `popup.html` / `popup.js` / `popup.css` | 扩展弹窗入口。 |
| `panel.html` / `panel.js` / `panel.css` | 导出面板、配置、文件生成和写入逻辑。 |
| `content.js` | 注入 ChatGPT / Gemini 页面，提取对话轮次、Markdown 和图片信息。 |
| `obsidian-style.css` | 导出的 Obsidian CSS snippet。 |
| `icons/` | 扩展图标。 |

## 开发 / Development

本项目保持轻量，不需要构建步骤。修改脚本后可以运行：

```powershell
node --check panel.js
node --check content.js
```

发布包是普通 Chrome unpacked extension 源码目录，可以直接通过 Chrome 开发者模式加载。

## 更新记录 / Changelog

### 0.2.4

- 新增 Google Gemini 网页端对话导出支持。
- 修复目录写入过程中的 File System Access API 状态缓存错误，降低导出中断概率。
- 改进 Gemini 候选消息提取，减少只导出部分轮次的问题。
- 支持选择 Obsidian 仓库根目录或目标子文件夹，并为 Canvas 生成正确的 vault-relative 文件路径。
- 新增常用 Obsidian 内路径历史，成功导出后自动记录，可快速选择或删除。
- 继续支持 Markdown 笔记、JSON Canvas、图片附件、WebP 压缩和 Obsidian CSS snippet。

### 0.2.1

- 修复用户上传图片被包在按钮中时可能无法计数的问题。
- 修复纯图片提问更容易被误判为未识别起始轮次的问题。
- 调整正文根节点选择逻辑，优先保留同时包含文本和图片的完整消息容器。

## License

MIT License. See [LICENSE](LICENSE).
