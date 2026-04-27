# ChatGPT / Gemini to Obsidian Canvas Exporter

把当前 ChatGPT 或 Google Gemini 对话按轮次导出到 Obsidian，生成 Markdown 笔记、JSON Canvas 画布、图片附件和可选的 Obsidian CSS 样式片段。

Export the current ChatGPT or Google Gemini conversation into Obsidian as per-round Markdown notes, a JSON Canvas file, image attachments, and an optional Obsidian CSS snippet.

## 功能特性 / Features

- 按“用户提问 + AI 回复”识别每一轮对话，并支持在导出面板中选择要保存的轮次。
- 为每一轮生成独立 Markdown 笔记，标题和正文开头优先使用该轮用户问题。
- 自动生成 Obsidian `.canvas` 文件，每个节点对应一轮对话，并按对话顺序连线。
- 导出对话中的图片附件，保留图片在笔记中的出现位置，并可尽量压缩为 WebP。
- 可写入 `chatgpt-export.css`，让 Obsidian 阅读视图更接近 ChatGPT / Gemini 网页对话风格。
- 支持直接导出到 Obsidian 仓库根目录或某个目标子文件夹，并修正 Canvas 节点中的 vault-relative 路径。
- 自动记录常用 Obsidian 内路径，使用过一次后可快速选择，也可随时删除。

## 支持站点 / Supported Sites

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://gemini.google.com/*`

## 安装方式 / Installation

1. 下载或克隆本仓库。
2. 打开 Chrome / Chromium 浏览器的扩展管理页面：`chrome://extensions/`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本仓库目录。

English:

1. Download or clone this repository.
2. Open `chrome://extensions/` in Chrome or another Chromium browser.
3. Enable Developer mode.
4. Click "Load unpacked".
5. Select this repository folder.

## 使用方式 / Usage

1. 打开一个 ChatGPT 或 Gemini 具体对话页面。
2. 点击浏览器扩展图标，打开导出面板。
3. 点击“刷新轮次”，确认识别出的轮次数、消息数和图片数。
4. 勾选需要导出的轮次。
5. 选择导出位置模式：
   - 选择仓库根目录：选择 Obsidian vault 根目录，可在“目标子路径”中填写 `计算物理`、`课程/计算物理` 等子路径。
   - 选择目标子文件夹：直接选择 `计算物理` 这类目标文件夹，并填写它在 Obsidian vault 内的相对路径。
6. 点击“导出到 Obsidian 文件夹”或“下载导出文件”。

English:

1. Open a specific ChatGPT or Gemini conversation page.
2. Click the extension icon to open the export panel.
3. Click Refresh to extract rounds, messages, and images.
4. Select the rounds you want to export.
5. Choose an export location mode:
   - Select vault root: choose the Obsidian vault root and optionally enter a target path such as `Physics` or `Courses/Physics`.
   - Select target subfolder: choose the target folder directly and enter its vault-relative path.
6. Click "Export to Obsidian folder" or "Download export files".

## Obsidian 路径模式 / Obsidian Path Modes

Obsidian Canvas 的 `file` 字段使用 vault-relative path。浏览器的 File System Access API 通常不能提供用户所选文件夹在本机或 Obsidian vault 中的完整路径，所以扩展需要你提供 Obsidian 内路径。

The `file` field in Obsidian Canvas uses vault-relative paths. Browsers usually do not expose the full local path or vault-relative path of the selected folder, so the extension needs the Obsidian path from you.

示例：

- 选择仓库根目录，目标子路径填 `计算物理`：实际写入 `计算物理/对话目录/`，Canvas 节点指向 `计算物理/对话目录/01 - xxx.md`。
- 直接选择 `计算物理` 文件夹，路径填 `计算物理`：实际写入所选文件夹下的 `对话目录/`，Canvas 节点仍指向 `计算物理/对话目录/01 - xxx.md`。
- 嵌套目录可填写 `课程/计算物理`。

## 样式片段 / CSS Snippet

如果勾选“写入 Obsidian 样式文件”，扩展会生成 `chatgpt-export.css`。

- 选择仓库根目录时，样式文件会写入 `.obsidian/snippets/chatgpt-export.css`。
- 直接选择目标子文件夹时，浏览器无法可靠写入仓库根目录下的 `.obsidian`，因此样式文件会放在本次导出的对话目录里，并附带启用说明。

在 Obsidian 中启用路径：

设置 -> 外观 -> CSS 代码片段 -> 启用 `chatgpt-export`

## 隐私说明 / Privacy

- 对话提取、Markdown 生成、Canvas 生成和图片处理都在本地浏览器中完成。
- 常用路径历史只保存 Obsidian vault 内的相对路径，例如 `计算物理` 或 `课程/计算物理`。
- 常用路径历史保存在 `chrome.storage.local`，不会保存你的本机绝对路径。
- 扩展不会把导出的对话内容发送到第三方服务器。

## 已知限制 / Known Limitations

- ChatGPT 和 Gemini 的网页 DOM 结构不是公开稳定接口，站点改版后可能需要更新 `content.js` 中的提取逻辑。
- Gemini 当前主要通过页面 DOM 提取，部分折叠、动态加载或实验性界面可能需要刷新页面后再导出。
- 浏览器不会向扩展暴露完整本地路径，因此直接选择目标子文件夹时需要手动确认 Obsidian 内路径。
- 图片导出依赖浏览器能否访问原始图片资源；失败时会退回到原始链接或导出失败提示。

## 项目结构 / Project Structure

- `manifest.json`：Chrome Manifest V3 扩展清单。
- `popup.html` / `popup.js` / `popup.css`：扩展弹窗入口。
- `panel.html` / `panel.js` / `panel.css`：导出面板、导出配置、文件生成和写入逻辑。
- `content.js`：注入 ChatGPT / Gemini 页面，提取对话轮次、Markdown 和图片信息。
- `obsidian-style.css`：导出的 Obsidian CSS snippet。
- `icons/`：扩展图标。

## 开发检查 / Development Checks

本项目不需要构建步骤。修改脚本后可以运行：

```powershell
node --check panel.js
node --check content.js
```

## 更新记录 / Changelog

### 0.2.4

- 新增 Google Gemini 网页端对话导出支持。
- 修复目录写入过程中的 File System Access API 状态缓存错误，降低导出到一半中断的概率。
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
