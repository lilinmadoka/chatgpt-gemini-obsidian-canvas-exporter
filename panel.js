// 使用立即执行函数隔离当前页面逻辑，避免污染全局命名空间。
(() => {
  // 保存常用 Obsidian 路径的 storage key。
  const VAULT_PATH_HISTORY_STORAGE_KEY = "vaultPathHistory";

  // 限制常用路径数量，避免面板过长。
  const MAX_VAULT_PATH_HISTORY_ITEMS = 12;

  // 保存当前面板的全部运行状态，便于多个函数共享数据。
  const state = {
    // 保存来源对话标签页编号。
    sourceTabId: 0,
    // 保存当前提取到的完整对话对象。
    conversation: null,
    // 保存当前被用户勾选的轮次编号集合。
    selectedRoundIndexes: new Set(),
    // 保存用户使用过的 Obsidian 仓库内路径。
    vaultPathHistory: [],
    // 标记当前是否处于执行中，避免重复触发导出。
    busy: false
  };

  // 把页面上需要反复访问的节点集中缓存起来，减少重复查询。
  const elements = {
    // 缓存标题节点。
    conversationTitle: null,
    // 缓存元信息节点。
    conversationMeta: null,
    // 缓存状态横幅节点。
    statusBanner: null,
    // 缓存轮次列表容器。
    roundList: null,
    // 缓存轮次卡片模板。
    roundCardTemplate: null,
    // 缓存导出目录输入框。
    folderNameInput: null,
    // 缓存导出位置模式控件。
    exportLocationModeInputs: [],
    // 缓存 Obsidian 仓库内路径输入框。
    vaultPathInput: null,
    // 缓存 Obsidian 仓库内路径标签。
    vaultPathLabel: null,
    // 缓存 Obsidian 仓库内路径说明。
    vaultPathHelp: null,
    // 缓存常用路径历史容器。
    vaultPathHistory: null,
    // 缓存总览笔记选项。
    includeOverviewCheckbox: null,
    // 缓存画布选项。
    includeCanvasCheckbox: null,
    // 缓存样式选项。
    includeStyleCheckbox: null,
    // 缓存图片导出选项。
    includeImagesCheckbox: null,
    // 缓存图片压缩选项。
    compressImagesCheckbox: null,
    // 缓存刷新按钮。
    refreshButton: null,
    // 缓存目录导出按钮。
    exportFolderButton: null,
    // 缓存下载按钮。
    downloadButton: null,
    // 缓存全选按钮。
    selectAllButton: null,
    // 缓存清空按钮。
    clearAllButton: null,
    // 缓存反选按钮。
    invertSelectionButton: null,
    // 缓存轮次数值节点。
    roundCount: null,
    // 缓存已选数量节点。
    selectedCount: null,
    // 缓存消息数量节点。
    messageCount: null,
    // 缓存图片数量节点。
    imageCount: null
  };

  // 等待文档完成渲染后再启动整个面板逻辑。
  document.addEventListener("DOMContentLoaded", async () => {
    // 把页面上的关键节点全部抓出来。
    cacheElements();

    // 给按钮和复选框绑定交互事件。
    bindEvents();

    // 加载常用 Obsidian 路径历史。
    await loadVaultPathHistory();

    // 从地址栏中解析来源标签页编号。
    state.sourceTabId = getSourceTabIdFromLocation();

    // 如果来源标签页编号无效，就直接提示并停止。
    if (!state.sourceTabId) {
      // 更新状态横幅内容，提示用户重新从扩展弹窗进入。
      setStatus("没有找到来源对话标签页。请返回扩展弹窗，重新打开导出面板。", true);

      // 结束初始化流程。
      return;
    }

    // 立即尝试加载当前对话，提升进入面板后的连贯性。
    await refreshConversation();
  });

  // 缓存页面中会反复使用到的全部节点。
  function cacheElements() {
    // 缓存对话标题节点。
    elements.conversationTitle = document.getElementById("conversation-title");

    // 缓存对话元信息节点。
    elements.conversationMeta = document.getElementById("conversation-meta");

    // 缓存状态横幅节点。
    elements.statusBanner = document.getElementById("status-banner");

    // 缓存轮次列表节点。
    elements.roundList = document.getElementById("round-list");

    // 缓存轮次卡片模板节点。
    elements.roundCardTemplate = document.getElementById("round-card-template");

    // 缓存目录名输入框节点。
    elements.folderNameInput = document.getElementById("folder-name-input");

    // 缓存导出位置模式单选控件。
    elements.exportLocationModeInputs = Array.from(document.querySelectorAll("input[name='export-location-mode']"));

    // 缓存 Obsidian 仓库内路径输入框节点。
    elements.vaultPathInput = document.getElementById("vault-path-input");

    // 缓存 Obsidian 仓库内路径标签节点。
    elements.vaultPathLabel = document.getElementById("vault-path-label");

    // 缓存 Obsidian 仓库内路径说明节点。
    elements.vaultPathHelp = document.getElementById("vault-path-help");

    // 缓存常用路径历史容器。
    elements.vaultPathHistory = document.getElementById("vault-path-history");

    // 缓存生成总览复选框节点。
    elements.includeOverviewCheckbox = document.getElementById("include-overview-checkbox");

    // 缓存生成画布复选框节点。
    elements.includeCanvasCheckbox = document.getElementById("include-canvas-checkbox");

    // 缓存写入样式复选框节点。
    elements.includeStyleCheckbox = document.getElementById("include-style-checkbox");

    // 缓存导出图片复选框节点。
    elements.includeImagesCheckbox = document.getElementById("include-images-checkbox");

    // 缓存压缩图片复选框节点。
    elements.compressImagesCheckbox = document.getElementById("compress-images-checkbox");

    // 缓存刷新按钮节点。
    elements.refreshButton = document.getElementById("refresh-button");

    // 缓存写入目录按钮节点。
    elements.exportFolderButton = document.getElementById("export-folder-button");

    // 缓存下载按钮节点。
    elements.downloadButton = document.getElementById("download-button");

    // 缓存全选按钮节点。
    elements.selectAllButton = document.getElementById("select-all-button");

    // 缓存清空按钮节点。
    elements.clearAllButton = document.getElementById("clear-all-button");

    // 缓存反选按钮节点。
    elements.invertSelectionButton = document.getElementById("invert-selection-button");

    // 缓存轮次数值节点。
    elements.roundCount = document.getElementById("round-count");

    // 缓存已选数量节点。
    elements.selectedCount = document.getElementById("selected-count");

    // 缓存消息数量节点。
    elements.messageCount = document.getElementById("message-count");

    // 缓存图片数量节点。
    elements.imageCount = document.getElementById("image-count");
  }

  // 为界面上的按钮和输入控件绑定事件。
  function bindEvents() {
    // 如果刷新按钮存在，就绑定刷新逻辑。
    if (elements.refreshButton) {
      // 点击时重新从来源对话页面抓取最新轮次。
      elements.refreshButton.addEventListener("click", () => {
        // 调用刷新函数并忽略事件返回值。
        void refreshConversation();
      });
    }

    // 如果目录导出按钮存在，就绑定目录导出逻辑。
    if (elements.exportFolderButton) {
      // 点击时触发导出到本地文件夹。
      elements.exportFolderButton.addEventListener("click", () => {
        // 启动文件夹导出流程。
        void exportConversation("folder");
      });
    }

    // 如果下载按钮存在，就绑定下载导出逻辑。
    if (elements.downloadButton) {
      // 点击时触发下载模式导出。
      elements.downloadButton.addEventListener("click", () => {
        // 启动下载导出流程。
        void exportConversation("download");
      });
    }

    // 如果全选按钮存在，就绑定全选逻辑。
    if (elements.selectAllButton) {
      // 点击时把所有轮次都勾上。
      elements.selectAllButton.addEventListener("click", () => {
        // 选中所有轮次。
        selectAllRounds();
      });
    }

    // 如果清空按钮存在，就绑定清空逻辑。
    if (elements.clearAllButton) {
      // 点击时清除全部勾选。
      elements.clearAllButton.addEventListener("click", () => {
        // 取消全部轮次选择。
        clearAllSelections();
      });
    }

    // 如果反选按钮存在，就绑定反选逻辑。
    if (elements.invertSelectionButton) {
      // 点击时对当前选择状态做反转。
      elements.invertSelectionButton.addEventListener("click", () => {
        // 执行反选。
        invertSelections();
      });
    }

    // 导出位置模式切换时，同步路径输入框的文案。
    elements.exportLocationModeInputs.forEach((input) => {
      // 只给单选控件绑定 change 事件。
      input.addEventListener("change", () => {
        // 更新路径字段说明。
        renderExportLocationControls();
      });
    });

    // 初始化导出位置控件文案。
    renderExportLocationControls();
  }

  // 读取当前选择的导出位置模式。
  function getExportLocationMode() {
    // 找出被选中的单选控件。
    const checkedInput = elements.exportLocationModeInputs.find((input) => input.checked);

    // 只允许两种已知模式，避免异常值进入路径逻辑。
    return checkedInput && checkedInput.value === "target-folder" ? "target-folder" : "vault-root";
  }

  // 根据导出位置模式刷新路径输入框的标签、占位和说明。
  function renderExportLocationControls() {
    // 读取当前导出位置模式。
    const mode = getExportLocationMode();

    // 如果路径标签存在，就同步展示文案。
    if (elements.vaultPathLabel) {
      // 目标子文件夹模式下，这里描述的是用户所选文件夹在仓库内的路径。
      elements.vaultPathLabel.textContent = mode === "target-folder" ? "该文件夹在 Obsidian 中的路径" : "目标子路径";
    }

    // 如果路径输入框存在，就同步占位提示。
    if (elements.vaultPathInput) {
      // 目标子文件夹模式下可在选择目录后自动填入目录名，嵌套路径仍可手动改。
      elements.vaultPathInput.placeholder = mode === "target-folder"
        ? "例如：计算物理；嵌套目录可填 课程/计算物理"
        : "例如：计算物理；留空表示仓库根目录";
    }

    // 如果说明文字存在，就同步说明。
    if (elements.vaultPathHelp) {
      // 写入当前模式对应说明。
      elements.vaultPathHelp.textContent = mode === "target-folder"
        ? "直接选择目标子文件夹时，浏览器不会提供它在仓库内的完整路径；这里用于修正 Canvas 节点路径。"
        : "选择 Obsidian 仓库根目录时，这里填写导出到仓库内的哪个子路径。";
    }
  }

  // 从扩展本地存储中读取常用路径历史。
  async function loadVaultPathHistory() {
    try {
      // 读取 storage 中保存的历史。
      const result = await chromeStorageGet(VAULT_PATH_HISTORY_STORAGE_KEY);

      // 只接受字符串数组。
      const rawHistory = Array.isArray(result[VAULT_PATH_HISTORY_STORAGE_KEY]) ? result[VAULT_PATH_HISTORY_STORAGE_KEY] : [];

      // 规范化并去重。
      state.vaultPathHistory = normalizeVaultPathHistory(rawHistory);
    } catch (_error) {
      // 历史读取失败不影响导出功能。
      state.vaultPathHistory = [];
    }

    // 渲染历史列表。
    renderVaultPathHistory();
  }

  // 把当前路径保存进常用路径历史。
  async function rememberVaultPath(path) {
    // 规范化路径，空路径不记录。
    const normalizedPath = normalizeVaultPath(path, true);

    // 空路径代表仓库根目录，不作为常用子路径记录。
    if (!normalizedPath) {
      // 直接结束。
      return;
    }

    // 新路径放到最前面，旧重复项移除。
    state.vaultPathHistory = normalizeVaultPathHistory([
      normalizedPath,
      ...state.vaultPathHistory.filter((item) => item !== normalizedPath)
    ]);

    // 持久化历史。
    await saveVaultPathHistory();

    // 重新渲染。
    renderVaultPathHistory();
  }

  // 删除一个常用路径。
  async function forgetVaultPath(path) {
    // 规范化待删除路径。
    const normalizedPath = normalizeVaultPath(path, true);

    // 从历史中移除。
    state.vaultPathHistory = state.vaultPathHistory.filter((item) => item !== normalizedPath);

    // 持久化历史。
    await saveVaultPathHistory();

    // 重新渲染。
    renderVaultPathHistory();
  }

  // 保存常用路径历史到扩展本地存储。
  async function saveVaultPathHistory() {
    // 写入 storage。
    await chromeStorageSet({
      [VAULT_PATH_HISTORY_STORAGE_KEY]: state.vaultPathHistory
    });
  }

  // 清洗历史数组并限制数量。
  function normalizeVaultPathHistory(history) {
    // 初始化结果与去重集合。
    const result = [];
    const seen = new Set();

    // 遍历原始历史。
    history.forEach((item) => {
      try {
        // 规范化路径。
        const normalizedPath = normalizeVaultPath(item, true);

        // 跳过空路径和重复路径。
        if (!normalizedPath || seen.has(normalizedPath)) {
          // 结束当前项。
          return;
        }

        // 记录去重信息。
        seen.add(normalizedPath);

        // 加入结果。
        result.push(normalizedPath);
      } catch (_error) {
        // 忽略历史中的坏数据。
      }
    });

    // 限制最多保存数量。
    return result.slice(0, MAX_VAULT_PATH_HISTORY_ITEMS);
  }

  // 渲染常用路径历史列表。
  function renderVaultPathHistory() {
    // 如果容器不存在就跳过。
    if (!elements.vaultPathHistory) {
      // 结束函数。
      return;
    }

    // 清空旧内容。
    elements.vaultPathHistory.innerHTML = "";

    // 遍历历史路径。
    state.vaultPathHistory.forEach((path) => {
      // 创建历史项容器。
      const item = document.createElement("span");
      item.className = "path-history-item";

      // 创建填入按钮。
      const useButton = document.createElement("button");
      useButton.className = "path-history-use";
      useButton.type = "button";
      useButton.textContent = path;
      useButton.title = `使用路径：${path}`;
      useButton.addEventListener("click", () => {
        // 点击后填入当前路径。
        if (elements.vaultPathInput) {
          // 写入输入框。
          elements.vaultPathInput.value = path;
          // 聚焦输入框方便继续编辑。
          elements.vaultPathInput.focus();
        }
      });

      // 创建删除按钮。
      const deleteButton = document.createElement("button");
      deleteButton.className = "path-history-delete";
      deleteButton.type = "button";
      deleteButton.textContent = "×";
      deleteButton.title = `删除路径：${path}`;
      deleteButton.setAttribute("aria-label", `删除常用路径 ${path}`);
      deleteButton.addEventListener("click", () => {
        // 删除当前历史项。
        void forgetVaultPath(path);
      });

      // 组装历史项。
      item.appendChild(useButton);
      item.appendChild(deleteButton);

      // 加入容器。
      elements.vaultPathHistory.appendChild(item);
    });
  }

  // Promise 化 chrome.storage.local.get。
  function chromeStorageGet(key) {
    // 返回 Promise，便于 await。
    return new Promise((resolve) => {
      // 如果 storage 不可用就返回空对象。
      if (!chrome.storage || !chrome.storage.local) {
        // 返回空值。
        resolve({});
        return;
      }

      // 读取本地存储。
      chrome.storage.local.get(key, (result) => {
        // 出错时也返回空对象，避免影响主流程。
        resolve(chrome.runtime.lastError ? {} : result || {});
      });
    });
  }

  // Promise 化 chrome.storage.local.set。
  function chromeStorageSet(value) {
    // 返回 Promise，便于 await。
    return new Promise((resolve, reject) => {
      // 如果 storage 不可用就直接完成。
      if (!chrome.storage || !chrome.storage.local) {
        // 直接完成。
        resolve();
        return;
      }

      // 写入本地存储。
      chrome.storage.local.set(value, () => {
        // 如果发生错误就抛出。
        if (chrome.runtime.lastError) {
          // 抛出错误。
          reject(new Error(chrome.runtime.lastError.message || "保存常用路径失败。"));
          return;
        }

        // 标记完成。
        resolve();
      });
    });
  }

  // 从当前面板地址中解析来源标签页编号。
  function getSourceTabIdFromLocation() {
    // 构造当前页面地址对象，便于读取查询参数。
    const url = new URL(window.location.href);

    // 读取查询参数中的 sourceTabId 值。
    const rawValue = url.searchParams.get("sourceTabId") || "0";

    // 把字符串安全转换为数字。
    const numericValue = Number(rawValue);

    // 如果数字不合法，就返回 0。
    if (!Number.isInteger(numericValue) || numericValue <= 0) {
      // 返回无效标记值。
      return 0;
    }

    // 返回合法的标签页编号。
    return numericValue;
  }

  // 根据来源地址推断当前对话来自哪个平台。
  function inferProviderKeyFromUrl(url) {
    // 把输入统一转换成字符串，避免空值参与判断。
    const safeUrl = typeof url === "string" ? url : "";

    // Gemini 对话页运行在 gemini.google.com 下。
    if (safeUrl.startsWith("https://gemini.google.com/")) {
      // 返回 Gemini 平台标记。
      return "gemini";
    }

    // ChatGPT 对话页运行在 chatgpt.com 与 chat.openai.com 下。
    if (safeUrl.startsWith("https://chatgpt.com/") || safeUrl.startsWith("https://chat.openai.com/")) {
      // 返回 ChatGPT 平台标记。
      return "chatgpt";
    }

    // 其余来源统一标记为 unknown。
    return "unknown";
  }

  // 把平台标记转换成当前面板和导出文本所需的展示信息。
  function getProviderInfo(conversation = state.conversation) {
    // 优先读取对话对象里已经提取好的平台标记。
    const providerKey = conversation && typeof conversation.provider === "string" && conversation.provider
      ? conversation.provider.toLowerCase()
      : inferProviderKeyFromUrl(conversation && conversation.sourceUrl ? conversation.sourceUrl : "");

    // Gemini 的展示信息。
    if (providerKey === "gemini") {
      // 返回 Gemini 相关展示字段。
      return {
        key: "gemini",
        displayName: "Gemini",
        assistantLabel: "Gemini",
        sourceLinkLabel: "Gemini 原对话"
      };
    }

    // ChatGPT 的展示信息。
    if (providerKey === "chatgpt") {
      // 返回 ChatGPT 相关展示字段。
      return {
        key: "chatgpt",
        displayName: "ChatGPT",
        assistantLabel: "ChatGPT",
        sourceLinkLabel: "ChatGPT 原对话"
      };
    }

    // 未知平台时给出更中性的兜底展示。
    return {
      key: "unknown",
      displayName: conversation && typeof conversation.providerDisplayName === "string" && conversation.providerDisplayName ? conversation.providerDisplayName : "AI 对话",
      assistantLabel: conversation && typeof conversation.providerDisplayName === "string" && conversation.providerDisplayName ? conversation.providerDisplayName : "AI",
      sourceLinkLabel: "原对话"
    };
  }

  // 统一更新忙碌状态，并同步禁用相关按钮。
  function setBusy(busy) {
    // 把忙碌标记写入共享状态。
    state.busy = Boolean(busy);

    // 统一取出当前要设置的禁用态。
    const disabled = state.busy;

    // 如果刷新按钮存在，就同步禁用态。
    if (elements.refreshButton) {
      // 应用禁用态到刷新按钮。
      elements.refreshButton.disabled = disabled;
    }

    // 如果文件夹导出按钮存在，就同步禁用态。
    if (elements.exportFolderButton) {
      // 应用禁用态到目录导出按钮。
      elements.exportFolderButton.disabled = disabled;
    }

    // 如果下载按钮存在，就同步禁用态。
    if (elements.downloadButton) {
      // 应用禁用态到下载按钮。
      elements.downloadButton.disabled = disabled;
    }

    // 如果全选按钮存在，就同步禁用态。
    if (elements.selectAllButton) {
      // 应用禁用态到全选按钮。
      elements.selectAllButton.disabled = disabled;
    }

    // 如果清空按钮存在，就同步禁用态。
    if (elements.clearAllButton) {
      // 应用禁用态到清空按钮。
      elements.clearAllButton.disabled = disabled;
    }

    // 如果反选按钮存在，就同步禁用态。
    if (elements.invertSelectionButton) {
      // 应用禁用态到反选按钮。
      elements.invertSelectionButton.disabled = disabled;
    }

    // 如果目录名输入框存在，就同步禁用态。
    if (elements.folderNameInput) {
      // 导出中不允许改目录名，避免路径和已生成文件包不一致。
      elements.folderNameInput.disabled = disabled;
    }

    // 如果 Obsidian 内路径输入框存在，就同步禁用态。
    if (elements.vaultPathInput) {
      // 导出中不允许改 Obsidian 内路径。
      elements.vaultPathInput.disabled = disabled;
    }

    // 如果导出位置单选控件存在，就同步禁用态。
    elements.exportLocationModeInputs.forEach((input) => {
      // 应用禁用态到单选控件。
      input.disabled = disabled;
    });

    // 如果常用路径区域存在，就同步按钮禁用态。
    if (elements.vaultPathHistory) {
      // 禁用或启用历史项按钮。
      elements.vaultPathHistory.querySelectorAll("button").forEach((button) => {
        // 应用禁用态。
        button.disabled = disabled;
      });
    }
  }

  // 统一更新状态横幅内容。
  function setStatus(message, isError = false) {
    // 如果状态横幅不存在，就直接跳过。
    if (!elements.statusBanner) {
      // 直接结束函数。
      return;
    }

    // 把状态文本写入页面。
    elements.statusBanner.textContent = message;

    // 根据是否错误切换样式类。
    elements.statusBanner.classList.toggle("is-error", Boolean(isError));
  }

  // 统一更新统计区中的数字显示。
  function renderStats() {
    // 读取当前对话对象，便于书写更短。
    const conversation = state.conversation;

    // 计算轮次数量。
    const roundCount = conversation && Array.isArray(conversation.rounds) ? conversation.rounds.length : 0;

    // 计算底层消息数量。
    const messageCount = conversation && Array.isArray(conversation.messages) ? conversation.messages.length : 0;

    // 计算总图片数量。
    const imageCount = conversation && Array.isArray(conversation.rounds)
      ? conversation.rounds.reduce((sum, round) => sum + getRoundImageCount(round), 0)
      : 0;

    // 如果轮次数值节点存在，就更新它。
    if (elements.roundCount) {
      // 写入轮次数值。
      elements.roundCount.textContent = String(roundCount);
    }

    // 如果已选数量节点存在，就更新它。
    if (elements.selectedCount) {
      // 写入当前已选轮次数值。
      elements.selectedCount.textContent = String(state.selectedRoundIndexes.size);
    }

    // 如果消息数量节点存在，就更新它。
    if (elements.messageCount) {
      // 写入底层消息数量。
      elements.messageCount.textContent = String(messageCount);
    }

    // 如果图片数量节点存在，就更新它。
    if (elements.imageCount) {
      // 写入图片附件数量。
      elements.imageCount.textContent = String(imageCount);
    }
  }

  // 重新抓取当前对话并刷新整个界面。
  async function refreshConversation() {
    // 如果当前已经在执行，就直接跳过，避免并发操作。
    if (state.busy) {
      // 结束本次刷新。
      return;
    }

    // 进入忙碌状态。
    setBusy(true);

    // 提示用户当前正在抓取对话。
    setStatus("正在从当前对话页面提取轮次、Markdown 与图片信息…");

    try {
      // 先确保内容脚本已经注入到来源标签页，避免“接收端不存在”报错。
      await ensureContentScriptInjected(state.sourceTabId);

      // 向来源标签页发送提取请求。
      const response = await sendMessageToTab(state.sourceTabId, { type: "EXPORTER_EXTRACT_CONVERSATION" });

      // 如果响应为空或失败，就抛出明确错误。
      if (!response || !response.ok || !response.conversation) {
        // 抛出错误供统一错误处理分支接管。
        throw new Error(response && response.error ? response.error : "没有拿到可用的对话内容。请先刷新对话页面后重试。");
      }

      // 把提取到的对话写入状态中。
      state.conversation = response.conversation;

      // 默认选中全部轮次，方便首次导出。
      state.selectedRoundIndexes = new Set((state.conversation.rounds || []).map((round) => round.roundIndex));

      // 如果目录名输入框为空，就自动填一个更自然的默认名。
      if (elements.folderNameInput && !elements.folderNameInput.value.trim()) {
        // 写入根据当前对话标题生成的默认目录名。
        elements.folderNameInput.value = makeDefaultFolderName(state.conversation.title || "未命名对话");
      }

      // 刷新顶部标题和元信息区域。
      renderConversationHeader();

      // 刷新轮次列表区域。
      renderRoundList();

      // 刷新统计数字区域。
      renderStats();

      // 汇报成功状态。
      setStatus(`已提取 ${state.conversation.rounds.length} 轮内容，可直接勾选后导出。`);
    } catch (error) {
      // 把未知错误统一转换为用户可读文本。
      const message = error instanceof Error ? error.message : "提取对话失败。";

      // 清空当前对话状态，避免界面残留旧数据。
      state.conversation = null;

      // 清空已选集合。
      state.selectedRoundIndexes = new Set();

      // 重新渲染头部与列表，让界面回到空状态。
      renderConversationHeader();

      // 重新渲染轮次列表为空状态。
      renderRoundList();

      // 重新渲染统计信息。
      renderStats();

      // 把错误展示到状态栏。
      setStatus(message, true);
    } finally {
      // 不管成功失败，都退出忙碌状态。
      setBusy(false);
    }
  }

  // 让内容脚本在目标标签页中处于可用状态。
  async function ensureContentScriptInjected(tabId) {
    // 如果标签页编号无效，就直接抛错。
    if (!tabId) {
      // 抛出错误，提醒调用方来源页不存在。
      throw new Error("来源标签页不存在。无法注入内容脚本。");
    }

    // 主动执行一次内容脚本注入，已注入过时脚本会用内部守卫自动跳过重复初始化。
    await chrome.scripting.executeScript({
      // 指定执行目标标签页。
      target: { tabId },
      // 指定要执行的脚本文件。
      files: ["content.js"]
    });
  }

  // 通过 Promise 方式向标签页发送消息，简化异步代码写法。
  function sendMessageToTab(tabId, payload) {
    // 返回一个新的 Promise，等待内容脚本回包。
    return new Promise((resolve, reject) => {
      // 向指定标签页发送消息。
      chrome.tabs.sendMessage(tabId, payload, (response) => {
        // 如果 Chrome 侧有运行时错误，就直接 reject。
        if (chrome.runtime.lastError) {
          // 用更明确的错误文本包装底层消息。
          reject(new Error(chrome.runtime.lastError.message || "向页面发送消息失败。"));

          // 结束回调，不再继续处理。
          return;
        }

        // 把响应对象交给 resolve。
        resolve(response);
      });
    });
  }

  // 渲染顶部标题与元信息区域。
  function renderConversationHeader() {
    // 读取当前对话对象。
    const conversation = state.conversation;

    // 如果还没有对话数据，就显示空状态标题。
    if (!conversation) {
      // 如果标题节点存在，就写入默认文本。
      if (elements.conversationTitle) {
        // 写入空状态标题。
        elements.conversationTitle.textContent = "暂时没有可导出的对话";
      }

      // 如果元信息节点存在，就写入空状态说明。
      if (elements.conversationMeta) {
        // 写入空状态说明文本。
        elements.conversationMeta.textContent = "请确认当前标签页是 ChatGPT 或 Gemini 的具体对话页面，并点击“刷新轮次”。";
      }

      // 结束函数。
      return;
    }

    // 读取对话标题。
    const title = conversation.title || "未命名对话";

    // 读取导出来源地址。
    const sourceUrl = conversation.sourceUrl || "";

    // 计算轮次数量。
    const roundCount = Array.isArray(conversation.rounds) ? conversation.rounds.length : 0;

    // 计算图片总量。
    const imageCount = Array.isArray(conversation.rounds)
      ? conversation.rounds.reduce((sum, round) => sum + getRoundImageCount(round), 0)
      : 0;

    // 如果标题节点存在，就更新标题文本。
    if (elements.conversationTitle) {
      // 写入当前对话标题。
      elements.conversationTitle.textContent = title;
    }

    // 如果元信息节点存在，就写入更完整的摘要信息。
    if (elements.conversationMeta) {
      // 拼接顶部摘要文本，方便用户快速确认抓取对象。
      elements.conversationMeta.textContent = `共识别 ${roundCount} 轮、${conversation.messages.length} 条底层消息、${imageCount} 张图片。来源：${sourceUrl}`;
    }
  }

  // 渲染轮次列表区域。
  function renderRoundList() {
    // 如果列表容器不存在，就直接结束。
    if (!elements.roundList) {
      // 结束函数。
      return;
    }

    // 先清空旧的卡片内容。
    elements.roundList.innerHTML = "";

    // 读取当前对话对象。
    const conversation = state.conversation;

    // 如果没有对话或没有轮次，就渲染空状态说明。
    if (!conversation || !Array.isArray(conversation.rounds) || conversation.rounds.length === 0) {
      // 创建一个空状态占位节点。
      const emptyState = document.createElement("div");

      // 给空状态节点添加样式类。
      emptyState.className = "empty-state";

      // 写入空状态文案。
      emptyState.textContent = "这里还没有可选择的轮次。";

      // 把空状态节点插入列表容器。
      elements.roundList.appendChild(emptyState);

      // 结束函数。
      return;
    }

    // 遍历每一轮并生成对应卡片。
    conversation.rounds.forEach((round) => {
      // 使用模板创建卡片节点。
      const card = createRoundCard(round);

      // 把卡片插入列表容器。
      elements.roundList.appendChild(card);
    });
  }

  // 为某一轮创建对应的可交互卡片。
  function createRoundCard(round) {
    // 如果模板或模板内容不存在，就退化为直接创建普通节点。
    if (!(elements.roundCardTemplate instanceof HTMLTemplateElement) || !elements.roundCardTemplate.content.firstElementChild) {
      // 创建一个简单的 article 节点作为兜底容器。
      const fallback = document.createElement("article");

      // 为兜底卡片设置样式类。
      fallback.className = "round-card";

      // 写入基础文本内容。
      fallback.textContent = `${round.roundIndex}. ${round.title}`;

      // 返回兜底卡片。
      return fallback;
    }

    // 深拷贝模板内容，生成独立卡片实例。
    const fragment = elements.roundCardTemplate.content.cloneNode(true);

    // 取出克隆后的卡片根节点。
    const card = fragment.querySelector(".round-card");

    // 取出复选框节点。
    const checkbox = fragment.querySelector(".round-checkbox");

    // 取出轮次序号节点。
    const roundIndexNode = fragment.querySelector(".round-index");

    // 取出轮次标题节点。
    const roundTitleNode = fragment.querySelector(".round-title");

    // 取出问题摘要节点。
    const promptNode = fragment.querySelector(".round-prompt");

    // 取出回答摘要节点。
    const answerNode = fragment.querySelector(".round-answer");

    // 取出元信息节点。
    const metaNode = fragment.querySelector(".round-meta");

    // 计算当前轮次是否处于勾选状态。
    const checked = state.selectedRoundIndexes.has(round.roundIndex);

    // 如果卡片根节点存在，就根据勾选状态切换高亮样式。
    if (card) {
      // 同步选中态类名。
      card.classList.toggle("is-selected", checked);
    }

    // 如果复选框存在，就写入当前勾选状态。
    if (checkbox instanceof HTMLInputElement) {
      // 设置复选框选中态。
      checkbox.checked = checked;

      // 给复选框绑定变更事件。
      checkbox.addEventListener("change", () => {
        // 如果复选框被选中，就把当前轮次加入集合。
        if (checkbox.checked) {
          // 写入选中集合。
          state.selectedRoundIndexes.add(round.roundIndex);
        } else {
          // 否则从集合中移除当前轮次。
          state.selectedRoundIndexes.delete(round.roundIndex);
        }

        // 如果卡片根节点存在，就同步切换高亮样式。
        if (card) {
          // 根据复选框状态切换类名。
          card.classList.toggle("is-selected", checkbox.checked);
        }

        // 重新渲染统计数字。
        renderStats();
      });
    }

    // 如果轮次编号节点存在，就写入轮次文本。
    if (roundIndexNode) {
      // 写入从 1 开始的轮次编号。
      roundIndexNode.textContent = `第 ${round.roundIndex} 轮`;
    }

    // 如果标题节点存在，就写入轮次标题。
    if (roundTitleNode) {
      // 写入问题标题文本。
      roundTitleNode.textContent = round.title || `第 ${round.roundIndex} 轮`;
    }

    // 如果问题摘要节点存在，就写入提问摘要。
    if (promptNode) {
      // 写入用户问题摘要文本。
      promptNode.textContent = `用户：${round.promptText || "（未识别到提问内容）"}`;
    }

    // 如果回答摘要节点存在，就写入回答摘要。
    if (answerNode) {
      // 写入回答摘要文本，并截断到更易浏览的长度。
      answerNode.textContent = `回复：${makePreview(round.responseText || "（这一轮没有抓到回复内容）", 180)}`;
    }

    // 如果元信息节点存在，就写入本轮统计信息。
    if (metaNode) {
      // 计算本轮图片数量。
      const imageCount = getRoundImageCount(round);

      // 拼接元信息条目。
      const parts = [
        `回复消息 ${round.responseMessageCount || 0} 条`,
        `图片 ${imageCount} 张`
      ];

      // 写入元信息文本。
      metaNode.textContent = parts.join(" · ");
    }

    // 返回生成好的卡片根节点。
    return card || document.createElement("article");
  }

  // 把所有轮次统一选中。
  function selectAllRounds() {
    // 如果当前没有对话数据，就直接结束。
    if (!state.conversation || !Array.isArray(state.conversation.rounds)) {
      // 结束函数。
      return;
    }

    // 把所有轮次编号写入集合。
    state.selectedRoundIndexes = new Set(state.conversation.rounds.map((round) => round.roundIndex));

    // 重新渲染列表以同步勾选框状态。
    renderRoundList();

    // 重新渲染统计数字。
    renderStats();
  }

  // 清空所有轮次选择。
  function clearAllSelections() {
    // 把已选集合直接清空。
    state.selectedRoundIndexes = new Set();

    // 重新渲染列表以同步勾选框状态。
    renderRoundList();

    // 重新渲染统计数字。
    renderStats();
  }

  // 反转当前所有轮次的勾选状态。
  function invertSelections() {
    // 如果没有有效对话数据，就直接结束。
    if (!state.conversation || !Array.isArray(state.conversation.rounds)) {
      // 结束函数。
      return;
    }

    // 创建一个新的选择集合，准备写入反选结果。
    const nextSelection = new Set();

    // 遍历所有轮次，未选中的加入，已选中的跳过。
    state.conversation.rounds.forEach((round) => {
      // 如果当前轮次还没有被选中，就把它加入新集合。
      if (!state.selectedRoundIndexes.has(round.roundIndex)) {
        // 把该轮次编号加入新集合。
        nextSelection.add(round.roundIndex);
      }
    });

    // 用新集合覆盖旧的选中状态。
    state.selectedRoundIndexes = nextSelection;

    // 重新渲染列表以同步勾选状态。
    renderRoundList();

    // 重新渲染统计数字。
    renderStats();
  }

  // 触发对话导出流程。
  async function exportConversation(mode) {
    // 如果当前正在执行其他操作，就直接跳过。
    if (state.busy) {
      // 结束函数。
      return;
    }

    // 如果当前没有可导出的对话数据，就报错。
    if (!state.conversation || !Array.isArray(state.conversation.rounds) || state.conversation.rounds.length === 0) {
      // 设置错误提示。
      setStatus("当前没有可导出的对话，请先刷新轮次。", true);

      // 结束函数。
      return;
    }

    // 把当前选中的轮次过滤出来。
    const selectedRounds = state.conversation.rounds.filter((round) => state.selectedRoundIndexes.has(round.roundIndex));

    // 如果一轮也没选，就直接提示。
    if (selectedRounds.length === 0) {
      // 更新状态提示用户先勾选轮次。
      setStatus("请至少勾选一轮再导出。", true);

      // 结束函数。
      return;
    }

    // 如果是目录导出，但当前浏览器环境不支持目录选择，就直接提示用户改用下载模式。
    if (mode === "folder" && typeof window.showDirectoryPicker !== "function") {
      // 给出明确说明，减少用户困惑。
      setStatus("当前浏览器环境不支持直接写入文件夹，请改用“下载导出文件”。", true);

      // 结束函数。
      return;
    }

    // 进入忙碌状态，避免重复点击。
    setBusy(true);

    // 开始展示导出中的提示。
    setStatus("正在整理导出文件、下载图片并压缩体积…");

    try {
      // 文件夹导出需要先拿到用户选中的目录，才能确定 Canvas 应该写入的 Obsidian 内路径。
      let rootHandle = null;

      // 根据目标模式先执行目录选择。
      if (mode === "folder") {
        // 让用户选择一个要写入的目录。
        rootHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      }

      // 读取当前导出选项。
      let exportOptions = getExportOptions();

      // 如果是文件夹导出，就把所选目录信息整合进路径选项。
      if (mode === "folder") {
        // 补齐实际写入路径和 Obsidian 仓库内路径。
        exportOptions = prepareFolderExportOptions(exportOptions, rootHandle);
      }

      // 构建完整导出包，包括笔记、画布、图片与样式文件。
      const exportBundle = await buildExportBundle(state.conversation, selectedRounds, exportOptions);

      // 根据目标模式执行不同的输出方式。
      if (mode === "folder") {
        // 把所有文件写入该目录中。
        await writeBundleToDirectory(rootHandle, exportBundle.files);

        // 成功导出后记录本次使用的 Obsidian 内路径，便于下次快速选择。
        await rememberVaultPath(exportOptions.vaultTargetPath);
      } else {
        // 否则走下载模式，把文件逐个下载到浏览器下载目录。
        await downloadBundle(exportBundle.files);
      }

      // 导出成功后更新状态提示。
      setStatus(`导出完成：共写出 ${exportBundle.files.length} 个文件，包含 ${exportBundle.stats.noteCount} 个笔记、${exportBundle.stats.imageCount} 张图片。`);
    } catch (error) {
      // 把未知错误转换为更稳定的文本。
      let message = error instanceof Error ? error.message : "导出失败。";

      // 对目录直写场景下的浏览器文件系统状态错误给出更明确的说明。
      if (mode === "folder" && isRetryableDirectoryWriteError(error)) {
        // 换成更贴近当前问题的中文提示。
        message = "写入 Obsidian 文件夹时遇到了浏览器文件系统状态刷新冲突。本次已中止，通常重新点一次“导出到 Obsidian 文件夹”即可；若仍复现，可先用“下载导出文件”。";
      }

      // 把错误文本显示在状态栏中。
      setStatus(message, true);
    } finally {
      // 操作结束后退出忙碌状态。
      setBusy(false);
    }
  }

  // 读取当前界面上的所有导出选项。
  function getExportOptions() {
    // 读取目录名输入框的内容。
    const requestedFolderName = elements.folderNameInput ? elements.folderNameInput.value.trim() : "";

    // 生成最终对话目录名。
    const folderName = sanitizePathSegment(requestedFolderName || makeDefaultFolderName(state.conversation ? state.conversation.title : "未命名对话"), "未命名对话");

    // 读取导出位置模式。
    const exportLocationMode = getExportLocationMode();

    // 读取并校验用户填写的 Obsidian 仓库内路径。
    const vaultTargetPath = normalizeVaultPath(elements.vaultPathInput ? elements.vaultPathInput.value : "", true);

    // 默认写入路径和仓库内路径保持原有行为，下载模式也继续使用这套路径。
    const defaultBasePath = joinPathSegments(folderName);

    // 返回整理好的选项对象。
    return {
      // 返回最终目录名。
      folderName,
      // 返回导出位置模式。
      exportLocationMode,
      // 返回目标文件夹在 Obsidian 仓库内的相对路径。
      vaultTargetPath,
      // 返回实际写入到用户选择目录下的基础路径。
      writeBasePath: defaultBasePath,
      // 返回 Obsidian 仓库内用于 Canvas 和链接的基础路径。
      vaultBasePath: defaultBasePath,
      // 返回是否生成总览。
      includeOverview: Boolean(elements.includeOverviewCheckbox && elements.includeOverviewCheckbox.checked),
      // 返回是否生成画布。
      includeCanvas: Boolean(elements.includeCanvasCheckbox && elements.includeCanvasCheckbox.checked),
      // 返回是否生成样式文件。
      includeStyle: Boolean(elements.includeStyleCheckbox && elements.includeStyleCheckbox.checked),
      // 返回是否导出图片。
      includeImages: Boolean(elements.includeImagesCheckbox && elements.includeImagesCheckbox.checked),
      // 返回是否压缩图片。
      compressImages: Boolean(elements.compressImagesCheckbox && elements.compressImagesCheckbox.checked)
    };
  }

  // 根据用户选择的目录句柄，补齐文件夹导出需要的写入路径与 Canvas 路径。
  function prepareFolderExportOptions(exportOptions, rootHandle) {
    // 读取所选目录名，浏览器通常只能提供这一级名称。
    const selectedDirectoryName = rootHandle && typeof rootHandle.name === "string" ? rootHandle.name : "";

    // 目标子文件夹模式下，如果用户没填路径，就用所选目录名作为仓库内路径的默认值。
    const targetFolderVaultPath = exportOptions.exportLocationMode === "target-folder" && !exportOptions.vaultTargetPath
      ? normalizeVaultPath(selectedDirectoryName, true)
      : exportOptions.vaultTargetPath;

    // 如果自动填入了默认路径，也同步回界面，便于用户看到最终路径。
    if (exportOptions.exportLocationMode === "target-folder" && !exportOptions.vaultTargetPath && elements.vaultPathInput && targetFolderVaultPath) {
      // 写回输入框。
      elements.vaultPathInput.value = targetFolderVaultPath;
    }

    // 仓库根目录模式：实际写入路径和 Obsidian 内路径一致。
    if (exportOptions.exportLocationMode === "vault-root") {
      // 生成在所选仓库根目录下的基础路径。
      const basePath = joinPathSegments(exportOptions.vaultTargetPath, exportOptions.folderName);

      // 返回补齐后的选项。
      return {
        ...exportOptions,
        writeBasePath: basePath,
        vaultBasePath: basePath,
        vaultTargetPath: exportOptions.vaultTargetPath
      };
    }

    // 目标子文件夹模式：实际写入到所选目录下，Canvas 使用用户确认的仓库内路径。
    return {
      ...exportOptions,
      vaultTargetPath: targetFolderVaultPath,
      writeBasePath: joinPathSegments(exportOptions.folderName),
      vaultBasePath: joinPathSegments(targetFolderVaultPath, exportOptions.folderName)
    };
  }

  // 构建完整导出包。
  async function buildExportBundle(conversation, selectedRounds, exportOptions) {
    // 初始化最终文件列表。
    const files = [];

    // 初始化占位符到资源路径的映射表。
    const imageReplacementMap = new Map();

    // 初始化资源缓存，避免同一张图片被重复下载和压缩。
    const assetCache = new Map();

    // 初始化导出统计对象。
    const stats = {
      // 记录笔记数量。
      noteCount: 0,
      // 记录图片数量。
      imageCount: 0
    };

    // 如果启用了图片导出，就先处理图片资源。
    if (exportOptions.includeImages) {
      // 提前收集所有被选轮次内的图片记录。
      const images = collectRoundImages(selectedRounds);

      // 如果图片数量大于 0，就进入图片导出流程。
      if (images.length > 0) {
        // 逐张处理图片，确保每张图片都能得到稳定的本地路径。
        for (let index = 0; index < images.length; index += 1) {
          // 读取当前图片元数据。
          const image = images[index];

          // 更新状态提示，让用户知道当前处理进度。
          setStatus(`正在处理图片 ${index + 1}/${images.length}…`);

          // 解析当前图片最终要替换成的本地路径和嵌入语法。
          const resolvedAsset = await resolveImageAsset(image, exportOptions, assetCache, stats);

          // 如果拿到了真实文件数据，就把该文件加入导出列表。
          if (resolvedAsset.file) {
            // 追加资源文件到导出结果中。
            files.push(resolvedAsset.file);
          }

          // 把该图片占位符映射到最终的 Obsidian 嵌入语法。
          imageReplacementMap.set(image.imageId, resolvedAsset.embedSyntax);
        }
      }
    }

    // 遍历每一个被选中的轮次，生成对应 Markdown 笔记。
    const noteDescriptors = selectedRounds.map((round) => {
      // 为当前轮次生成一个稳定、易读的文件名。
      const fileName = makeRoundFileName(round.roundIndex, round.title || round.promptText || `第 ${round.roundIndex} 轮`);

      // 构造当前笔记实际写入磁盘的相对路径。
      const diskPath = joinPathSegments(exportOptions.writeBasePath, fileName);

      // 构造当前笔记在 Obsidian 仓库内的相对路径，供 Canvas 与链接使用。
      const vaultPath = joinPathSegments(exportOptions.vaultBasePath, fileName);

      // 生成当前轮次的 Markdown 正文。
      const noteMarkdown = buildRoundNoteMarkdown(conversation, round, imageReplacementMap, exportOptions);

      // 返回笔记描述对象，后续还会给 Canvas 使用。
      return {
        // 保存轮次编号。
        roundIndex: round.roundIndex,
        // 保存轮次标题。
        title: round.title || round.promptText || `第 ${round.roundIndex} 轮`,
        // 保存实际写入路径。
        diskPath,
        // 保存 Obsidian 仓库内路径。
        vaultPath,
        // 保留旧字段供少量内部逻辑兜底。
        relativePath: vaultPath,
        // 保存 Markdown 正文。
        markdown: noteMarkdown,
        // 保存文本长度，方便画布计算节点高度。
        previewLength: (round.promptText || "").length + (round.responseText || "").length,
        // 保存图片数量，方便画布计算节点高度。
        imageCount: getRoundImageCount(round)
      };
    });

    // 把所有轮次笔记加入最终文件列表。
    noteDescriptors.forEach((note) => {
      // 把每个 Markdown 笔记压入文件列表。
      files.push({
        // 写入文件相对路径。
        path: note.diskPath,
        // 写入文本内容。
        content: note.markdown,
        // 标记 MIME 类型为 Markdown 文本。
        mimeType: "text/markdown;charset=utf-8"
      });

      // 笔记数量加一。
      stats.noteCount += 1;
    });

    // 如果启用了总览笔记，就额外生成一份总览文档。
    if (exportOptions.includeOverview) {
      // 生成总览笔记内容。
      const overviewMarkdown = buildOverviewMarkdown(conversation, noteDescriptors, exportOptions, stats);

      // 把总览笔记加入文件列表。
      files.push({
        // 设置总览笔记路径。
        path: joinPathSegments(exportOptions.writeBasePath, "00 - 对话总览.md"),
        // 写入总览正文。
        content: overviewMarkdown,
        // 标记文本类型。
        mimeType: "text/markdown;charset=utf-8"
      });

      // 笔记数量额外加一。
      stats.noteCount += 1;
    }

    // 如果启用了 Canvas 画布，就生成一份 .canvas 文件。
    if (exportOptions.includeCanvas) {
      // 生成 JSON Canvas 内容对象。
      const canvasObject = buildCanvasObject(conversation, noteDescriptors, exportOptions);

      // 把画布文件加入导出列表。
      files.push({
        // 设置画布文件路径。
        path: joinPathSegments(exportOptions.writeBasePath, `${sanitizePathSegment(conversation.title || exportOptions.folderName, exportOptions.folderName)}.canvas`),
        // 写入格式化后的 JSON 字符串。
        content: `${JSON.stringify(canvasObject, null, 2)}\n`,
        // 标记 JSON 类型。
        mimeType: "application/json;charset=utf-8"
      });
    }

    // 如果启用了样式文件，就把样式片段一并写入导出列表。
    if (exportOptions.includeStyle) {
      // 读取扩展内置的 Obsidian 样式片段内容。
      const snippetContent = await fetch(chrome.runtime.getURL("obsidian-style.css")).then((response) => response.text());

      // 目标子文件夹模式不能可靠写入仓库根目录下的 .obsidian，因此样式文件放在导出目录内供手动移动。
      const styleFilePath = exportOptions.exportLocationMode === "target-folder"
        ? joinPathSegments(exportOptions.writeBasePath, "chatgpt-export.css")
        : ".obsidian/snippets/chatgpt-export.css";

      // 把样式文件加入导出列表。
      files.push({
        // 指向 Obsidian 的 snippets 目录，或目标子文件夹模式下的导出目录。
        path: styleFilePath,
        // 写入 CSS 文本。
        content: snippetContent,
        // 标记为 CSS 文本。
        mimeType: "text/css;charset=utf-8"
      });

      // 再补一份启用说明，减少用户第一次使用时的困惑。
      files.push({
        // 设置说明文件路径。
        path: joinPathSegments(exportOptions.writeBasePath, "README - 启用 Obsidian 样式.md"),
        // 写入说明内容。
        content: buildSnippetInstructionMarkdown(exportOptions),
        // 标记为 Markdown 文本。
        mimeType: "text/markdown;charset=utf-8"
      });

      // 说明文件同样计入笔记数量。
      stats.noteCount += 1;
    }

    // 返回完整导出包对象。
    return {
      // 返回所有待输出文件。
      files,
      // 返回统计信息。
      stats
    };
  }

  // 收集所有被选轮次中的图片记录。
  function collectRoundImages(rounds) {
    // 初始化结果数组。
    const images = [];

    // 遍历每一轮，把提问图片和回复图片都收集起来。
    rounds.forEach((round) => {
      // 取出当前轮次的提问图片数组。
      const promptImages = Array.isArray(round.promptImages) ? round.promptImages : [];

      // 取出当前轮次的回复图片数组。
      const responseImages = Array.isArray(round.responseImages) ? round.responseImages : [];

      // 把当前轮次的图片全部追加到结果数组。
      images.push(...promptImages, ...responseImages);
    });

    // 返回收集后的图片数组。
    return images;
  }

  // 解析单张图片，生成本地文件与最终嵌入语法。
  async function resolveImageAsset(image, exportOptions, assetCache, stats) {
    // 生成图片缓存键，优先使用便携数据源，其次使用远程地址。
    const cacheKey = image.portableSourceUrl || image.sourceUrl || image.imageId;

    // 如果缓存中已经处理过这张图，就直接复用结果。
    if (assetCache.has(cacheKey)) {
      // 读取缓存结果。
      const cached = assetCache.get(cacheKey);

      // 返回新的替换语法，但不重复输出文件。
      return {
        // 不再重复生成文件对象。
        file: null,
        // 返回缓存中的嵌入语法。
        embedSyntax: buildImageEmbedSyntax(cached.vaultAssetPath || cached.relativeAssetPath, image)
      };
    }

    // 先尝试把图片源下载成 Blob。
    const originalBlob = await fetchImageBlob(image);

    // 如果仍然拿不到图片数据，就退化为远程引用语法。
    if (!originalBlob) {
      // 构建退化模式下的远程图片语法。
      const fallbackEmbed = image.sourceUrl
        ? `![](${image.sourceUrl})`
        : `图片导出失败：${image.alt || "未命名图片"}`;

      // 返回退化结果。
      return {
        // 没有本地文件。
        file: null,
        // 使用退化语法。
        embedSyntax: fallbackEmbed
      };
    }

    // 决定是否对图片进行压缩与转码。
    const optimized = exportOptions.compressImages
      ? await optimizeImageBlob(originalBlob, image)
      : await keepOriginalImageBlob(originalBlob);

    // 为当前图片生成最终导出的文件名。
    const assetFileName = makeImageFileName(image, optimized.extension);

    // 构造当前图片实际写入磁盘的相对资源路径。
    const diskAssetPath = joinPathSegments(exportOptions.writeBasePath, "assets", assetFileName);

    // 构造当前图片在 Obsidian 仓库内的相对资源路径。
    const vaultAssetPath = joinPathSegments(exportOptions.vaultBasePath, "assets", assetFileName);

    // 把当前图片写入缓存，方便后续复用。
    assetCache.set(cacheKey, {
      // 保存实际写入路径。
      diskAssetPath,
      // 保存 Obsidian 仓库内路径。
      vaultAssetPath,
      // 保留旧字段作为兼容兜底。
      relativeAssetPath: vaultAssetPath
    });

    // 图片数量累计加一。
    stats.imageCount += 1;

    // 返回完整资源描述。
    return {
      // 返回用于写入磁盘的文件对象。
      file: {
        // 写入图片文件路径。
        path: diskAssetPath,
        // 写入 Blob 数据。
        content: optimized.blob,
        // 写入 Blob 的 MIME 类型。
        mimeType: optimized.blob.type || "application/octet-stream"
      },
      // 返回该图片在当前笔记中的嵌入语法。
      embedSyntax: buildImageEmbedSyntax(vaultAssetPath, image)
    };
  }

  // 根据本地资源路径与图片元数据，生成 Obsidian 可读的嵌入语法。
  function buildImageEmbedSyntax(relativeAssetPath, image) {
    // 根据图片在网页中的展示宽度计算一个更接近原网页的嵌入宽度。
    const width = clampNumber(Math.round(Number(image.displayWidth) || Number(image.naturalWidth) || 640), 220, 900);

    // 生成 Obsidian 的 wiki 图片嵌入语法。
    return `![[${relativeAssetPath}|${width}]]`;
  }

  // 尽量保留原始图片数据，用于关闭压缩时的分支。
  async function keepOriginalImageBlob(blob) {
    // 猜测当前 Blob 对应的扩展名。
    const extension = extensionFromMimeType(blob.type || "") || "bin";

    // 返回原始 Blob 与扩展名。
    return {
      // 直接复用原始二进制数据。
      blob,
      // 返回扩展名。
      extension
    };
  }

  // 对图片做尺寸压缩与格式优化，优先得到更小且足够清晰的结果。
  async function optimizeImageBlob(blob, image) {
    // 如果图片本身不是常规可绘制位图，就直接保留原始内容。
    if (!/^image\/(png|jpe?g|webp|bmp)$/i.test(blob.type || "")) {
      // 直接返回原图结果。
      return keepOriginalImageBlob(blob);
    }

    // 尝试把 Blob 解码成位图，便于后续缩放与转码。
    const bitmap = await createImageBitmap(blob);

    // 计算压缩后允许的最大边长，尽量平衡清晰度与文件体积。
    const maxDimension = 1800;

    // 计算缩放比例，超过上限时才缩小，避免无意义放大。
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    // 根据比例计算目标宽度。
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));

    // 根据比例计算目标高度。
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    // 创建离屏画布元素，用于把图片重新编码。
    const canvas = document.createElement("canvas");

    // 设置画布宽度。
    canvas.width = targetWidth;

    // 设置画布高度。
    canvas.height = targetHeight;

    // 获取 2D 绘图上下文。
    const context = canvas.getContext("2d", { alpha: true });

    // 如果上下文不可用，就退回原图。
    if (!context) {
      // 关闭位图资源，释放内存。
      bitmap.close();

      // 返回原始结果。
      return keepOriginalImageBlob(blob);
    }

    // 在画布上绘制缩放后的图片。
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    // 在位图已经绘制完成后释放位图资源。
    bitmap.close();

    // 尝试导出为 WebP，以获得更好的体积表现。
    const webpBlob = await canvasToBlob(canvas, "image/webp", 0.82);

    // 如果 WebP 转码成功且比原图明显更小，就优先使用 WebP。
    if (webpBlob && webpBlob.size > 0 && webpBlob.size <= blob.size * 1.05) {
      // 返回 WebP 结果。
      return {
        // 返回压缩后的 Blob。
        blob: webpBlob,
        // 指定扩展名为 webp。
        extension: "webp"
      };
    }

    // 如果 WebP 没有变小太多，就保留原图，避免不必要的再次编码损失。
    return keepOriginalImageBlob(blob);
  }

  // 把 canvas 导出成 Blob，便于统一 await 调用。
  function canvasToBlob(canvas, type, quality) {
    // 返回一个 Promise，等待浏览器异步完成编码。
    return new Promise((resolve) => {
      // 调用原生 toBlob，把编码后的结果交回 Promise。
      canvas.toBlob((blob) => {
        // 解析 Promise。
        resolve(blob || null);
      }, type, quality);
    });
  }

  // 尝试根据图片记录拿到真实 Blob 数据。
  async function fetchImageBlob(image) {
    // 如果已经有便携 data URL，就优先直接转成 Blob。
    if (image.portableSourceUrl && image.portableSourceUrl.startsWith("data:")) {
      // 直接把 data URL 解码为 Blob。
      return dataUrlToBlob(image.portableSourceUrl);
    }

    // 如果原始地址本身就是 data URL，也可以直接解码。
    if (image.sourceUrl && image.sourceUrl.startsWith("data:")) {
      // 直接解码 data URL。
      return dataUrlToBlob(image.sourceUrl);
    }

    // 如果没有任何可用地址，就直接返回 null。
    if (!image.sourceUrl) {
      // 返回空值表示失败。
      return null;
    }

    // 定义可能尝试的地址列表，避免重复请求同一地址。
    const urlsToTry = Array.from(new Set([image.sourceUrl].filter(Boolean)));

    // 按顺序尝试每一个地址。
    for (const url of urlsToTry) {
      try {
        // 使用扩展页上下文发起跨域请求，尽量获取真实二进制内容。
        const response = await fetch(url, {
          // 在可能有用时附带凭据。
          credentials: "include",
          // 尽量绕开缓存，优先拿到当前真实资源。
          cache: "no-store"
        });

        // 如果响应不是成功状态，就继续尝试下一个地址。
        if (!response.ok) {
          // 继续下一次循环。
          continue;
        }

        // 把响应体读成 Blob。
        const blob = await response.blob();

        // 如果 Blob 有有效大小，就返回它。
        if (blob && blob.size > 0) {
          // 返回成功拿到的 Blob。
          return blob;
        }
      } catch (_error) {
        // 当前地址请求失败时静默忽略，继续尝试其他来源。
      }
    }

    // 全部尝试后仍失败，则返回 null。
    return null;
  }

  // 把 data URL 解码为 Blob 对象。
  function dataUrlToBlob(dataUrl) {
    // 使用正则拆出 MIME 与 Base64 数据段。
    const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);

    // 如果格式无法识别，就返回 null。
    if (!match) {
      // 返回空值。
      return null;
    }

    // 读取 MIME 类型，缺省时回退到八位字节流。
    const mimeType = match[1] || "application/octet-stream";

    // 判断当前是否是 Base64 编码。
    const isBase64 = Boolean(match[2]);

    // 读取数据正文部分。
    const rawData = match[3] || "";

    // 根据编码方式把字符串还原为二进制字符串。
    const decodedString = isBase64 ? atob(rawData) : decodeURIComponent(rawData);

    // 创建一个与字符串长度相同的字节数组。
    const bytes = new Uint8Array(decodedString.length);

    // 遍历每一个字符并写入对应字节值。
    for (let index = 0; index < decodedString.length; index += 1) {
      // 把当前字符编码写入数组。
      bytes[index] = decodedString.charCodeAt(index);
    }

    // 根据 MIME 类型构造最终 Blob。
    return new Blob([bytes], { type: mimeType });
  }

  // 把整个导出包直接写入用户选中的文件夹。
  async function writeBundleToDirectory(rootHandle, files) {
    // 逐个处理每一个导出文件。
    for (const file of files) {
      // 更新状态提示，让用户知道当前写入进度。
      setStatus(`正在写入：${file.path}`);

      // 把当前文件真正写入目录结构中。
      await writeSingleFile(rootHandle, file.path, file.content);
    }
  }

  // 把单个文件写入目录结构中的相对路径位置。
  async function writeSingleFile(rootHandle, relativePath, content) {
    // 把相对路径拆分为逐级目录与文件名片段。
    const segments = relativePath.split("/").filter(Boolean);

    // 如果路径片段为空，就直接结束。
    if (segments.length === 0) {
      // 结束函数。
      return;
    }

    // 目录写入偶尔会遇到浏览器的句柄状态缓存错误，这里做少量重试，尽量避免半途只写出一部分文件。
    const maxAttempts = 3;
    let lastError = null;

    // 逐次尝试写入同一个目标文件。
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // 每次重试都重新获取一遍目录与文件句柄，避免复用失效句柄。
      let writable = null;

      try {
        // 从根目录重新走到目标文件所在目录。
        const targetDirectoryHandle = await getDirectoryHandleForPath(rootHandle, segments.slice(0, -1));

        // 读取最终文件名。
        const fileName = segments[segments.length - 1];

        // 获取或创建最终文件句柄。
        const fileHandle = await targetDirectoryHandle.getFileHandle(fileName, { create: true });

        // 创建可写入流；显式关闭旧内容保留，避免与已有文件状态纠缠。
        writable = await fileHandle.createWritable({ keepExistingData: false });

        // 把文本或 Blob 内容写入文件。
        await writable.write(content);

        // 关闭流并真正提交写入。
        await writable.close();

        // 当前文件写入成功，直接结束。
        return;
      } catch (error) {
        // 记录最后一次错误，便于最终抛出。
        lastError = error;

        // 如果写入流已经创建出来了，就尽量中止，避免把半成品留在临时写入态里。
        if (writable && typeof writable.abort === "function") {
          try {
            // 主流程已经失败，这里的清理失败不再继续向外抛。
            await writable.abort();
          } catch (_abortError) {
            // 忽略 abort 清理错误。
          }
        }

        // 非重试型错误，或已经达到最大尝试次数时，直接抛出更明确的路径级错误。
        if (!isRetryableDirectoryWriteError(error) || attempt >= maxAttempts) {
          const errorMessage = error instanceof Error ? error.message : "未知错误";
          throw new Error(`写入文件失败：${relativePath}。${errorMessage}`);
        }

        // 稍等一个很短的时间，再重新获取句柄继续重试。
        await wait(160 * attempt);
      }
    }

    // 理论上不会走到这里；仅作为兜底抛出。
    const finalMessage = lastError instanceof Error ? lastError.message : "未知错误";
    throw new Error(`写入文件失败：${relativePath}。${finalMessage}`);
  }

  // 从根目录句柄出发，逐级获取相对路径上的目标目录句柄。
  async function getDirectoryHandleForPath(rootHandle, directorySegments) {
    // 初始化当前目录句柄为根目录。
    let currentDirectoryHandle = rootHandle;

    // 逐级创建或获取中间目录。
    for (const directoryName of directorySegments) {
      // 获取或创建该级目录。
      currentDirectoryHandle = await currentDirectoryHandle.getDirectoryHandle(directoryName, { create: true });
    }

    // 返回最终目录句柄。
    return currentDirectoryHandle;
  }

  // 判断当前写入失败是否属于浏览器文件系统状态缓存类错误。
  function isRetryableDirectoryWriteError(error) {
    // 读取错误名与错误消息，便于兼容不同浏览器实现。
    const errorName = error instanceof Error ? error.name : "";
    const errorMessage = error instanceof Error ? error.message : String(error || "");

    // Chrome 在文件夹直接写入时，偶发会抛出这类状态缓存失效错误，重试通常能恢复。
    return errorName === "InvalidStateError"
      || /state cached in an interface object/i.test(errorMessage)
      || /state had changed since it was read from disk/i.test(errorMessage);
  }

  // 简单等待一小段时间，给浏览器文件系统状态刷新留出机会。
  function wait(milliseconds) {
    // 返回一个可 await 的 Promise。
    return new Promise((resolve) => {
      // 按指定时长完成等待。
      window.setTimeout(resolve, Math.max(0, Number(milliseconds) || 0));
    });
  }

  // 把导出包通过浏览器下载 API 逐个输出到下载目录。
  async function downloadBundle(files) {
    // 保存所有创建出来的对象 URL，便于最后统一释放。
    const objectUrls = [];

    try {
      // 逐个下载每一个文件。
      for (const file of files) {
        // 更新当前状态提示。
        setStatus(`正在下载：${file.path}`);

        // 把字符串内容转换为 Blob；Blob 内容则直接复用。
        const blob = file.content instanceof Blob
          ? file.content
          : new Blob([file.content], { type: file.mimeType || "application/octet-stream" });

        // 为当前 Blob 创建一个临时对象 URL。
        const objectUrl = URL.createObjectURL(blob);

        // 记录对象 URL，稍后统一释放。
        objectUrls.push(objectUrl);

        // 触发浏览器下载当前文件。
        await chrome.downloads.download({
          // 指向当前对象 URL。
          url: objectUrl,
          // 指定下载后的相对路径与文件名。
          filename: file.path,
          // 不强制弹出另存为窗口，保持批量导出的流畅性。
          saveAs: false,
          // 如文件同名，则由浏览器自动处理为唯一文件名。
          conflictAction: "uniquify"
        });
      }
    } finally {
      // 在一次事件循环之后再释放对象 URL，避免下载尚未启动时被提前回收。
      window.setTimeout(() => {
        // 遍历全部对象 URL 并逐个释放。
        objectUrls.forEach((url) => {
          // 释放当前对象 URL。
          URL.revokeObjectURL(url);
        });
      }, 5000);
    }
  }

  // 构建单轮笔记的 Markdown 文本。
  function buildRoundNoteMarkdown(conversation, round, imageReplacementMap, exportOptions) {
    // 读取当前对话所属平台的展示信息。
    const providerInfo = getProviderInfo(conversation);

    // 构建 YAML frontmatter，用于保存元数据。
    const frontmatter = [
      "---",
      `chat-export: true`,
      ...(providerInfo.key === "chatgpt" ? [`chatgpt-export: true`] : []),
      `conversation-provider: ${escapeYamlScalar(providerInfo.key)}`,
      `conversation-title: ${escapeYamlScalar(conversation.title || "未命名对话")}`,
      `conversation-id: ${escapeYamlScalar(conversation.conversationId || "")}`,
      `round-index: ${round.roundIndex}`,
      `exported-at: ${escapeYamlScalar(new Date().toISOString())}`,
      `source-url: ${escapeYamlScalar(conversation.sourceUrl || "")}`,
      `image-count: ${getRoundImageCount(round)}`,
      "---",
      ""
    ].join("\n");

    // 先把图片占位符替换为最终的 Obsidian 图片嵌入语法。
    const promptMarkdown = replaceImagePlaceholders(round.promptMarkdown || "", imageReplacementMap, exportOptions.includeImages);

    // 对提问部分做图片行归并，尽量让多图在 Obsidian 里并排显示。
    const normalizedPromptMarkdown = normalizeStandaloneImageRuns(promptMarkdown);

    // 同样处理回复部分的图片占位符替换。
    const responseMarkdown = replaceImagePlaceholders(round.responseMarkdown || "", imageReplacementMap, exportOptions.includeImages);

    // 对回复部分做图片行归并。
    const normalizedResponseMarkdown = normalizeStandaloneImageRuns(responseMarkdown || "");

    // 生成问题 callout 内容。
    const promptCallout = [
      "> [!user] 用户提问",
      ">",
      prefixLines(normalizedPromptMarkdown || "（这一轮没有识别到用户提问内容。）", "> ")
    ].join("\n");

    // 生成回答 callout 内容。
    const responseCallout = [
      `> [!assistant] ${providerInfo.assistantLabel} 回复`,
      ">",
      prefixLines(normalizedResponseMarkdown || `（这一轮没有抓取到 ${providerInfo.assistantLabel} 回复内容。）`, "> ")
    ].join("\n");

    // 组装一个简洁但信息完整的笔记正文。
    return [
      frontmatter,
      `# ${round.title || round.promptText || `第 ${round.roundIndex} 轮`}`,
      "",
      promptCallout,
      "",
      responseCallout,
      "",
      `> [!quote] 来源`,
      `> 原对话：${conversation.sourceUrl ? `[点击打开原始 ${providerInfo.displayName} 对话](${conversation.sourceUrl})` : "（没有捕获到来源链接）"}`,
      `> `,
      `> 导出时间：${new Date().toLocaleString()}`,
      ""
    ].join("\n");
  }

  // 构建总览笔记内容。
  function buildOverviewMarkdown(conversation, noteDescriptors, exportOptions, stats) {
    // 读取当前对话所属平台的展示信息。
    const providerInfo = getProviderInfo(conversation);

    // 统计总图片数量。
    const imageCount = noteDescriptors.reduce((sum, note) => sum + note.imageCount, 0);

    // 生成轮次目录列表。
    const roundLinks = noteDescriptors
      .map((note) => `- [[${note.vaultPath || note.relativePath}]]`)
      .join("\n");

    // 返回总览笔记 Markdown。
    return [
      `# ${conversation.title || exportOptions.folderName}`,
      "",
      `- 导出时间：${new Date().toLocaleString()}`,
      `- 来源链接：${conversation.sourceUrl ? `[${providerInfo.sourceLinkLabel}](${conversation.sourceUrl})` : "（未捕获）"}`,
      `- 选中轮次：${noteDescriptors.length}`,
      `- 图片数量：${imageCount}`,
      `- Canvas 文件：${exportOptions.includeCanvas ? "已生成" : "未生成"}`,
      "",
      "## 轮次目录",
      "",
      roundLinks || "- （没有可列出的轮次）",
      "",
      "## 使用说明",
      "",
      `1. 直接打开每一轮笔记即可按“用户提问 → ${providerInfo.assistantLabel} 回复”的形式回看细节。`,
      `2. 如果你一并导出了样式文件，请在 Obsidian 的外观设置中启用 chatgpt-export.css，这样阅读效果会更接近 ${providerInfo.displayName} 网页。`,
      "3. `.canvas` 文件会把每一轮放成一个较大的文件节点，并按对话顺序自动连线。",
      ""
    ].join("\n");
  }

  // 构建样式启用说明。
  function buildSnippetInstructionMarkdown(exportOptions) {
    // 判断当前是否是直接选择目标子文件夹模式。
    const isTargetFolderMode = exportOptions.exportLocationMode === "target-folder";

    // 根据模式生成样式文件说明。
    const styleLocationLine = isTargetFolderMode
      ? "样式文件已放在本次导出的对话目录中：`chatgpt-export.css`。请手动移动或复制到仓库根目录的 `.obsidian/snippets/chatgpt-export.css`。"
      : "已导出样式文件到：`.obsidian/snippets/chatgpt-export.css`。";

    // 返回说明文件内容。
    return [
      `# 启用对话导出样式`,
      "",
      styleLocationLine,
      "",
      "为避免改动你已有的 Obsidian 配置，样式文件名仍保持为 `chatgpt-export.css`。",
      "",
      "在 Obsidian 中启用路径：设置 → 外观 → CSS 代码片段 → 打开 `chatgpt-export`。",
      "",
      `导出的对话目录在 Obsidian 中的位置为：`,
      `- ${exportOptions.vaultBasePath}`,
      ""
    ].join("\n");
  }

  // 构建 JSON Canvas 对象。
  function buildCanvasObject(conversation, noteDescriptors, exportOptions) {
    // 根据轮次数量估算列数，少量轮次单行，较多轮次自动换为双列或三列。
    const columnCount = noteDescriptors.length <= 4 ? noteDescriptors.length || 1 : noteDescriptors.length <= 10 ? 2 : 3;

    // 设置每个节点的基础宽度，确保预览足够大而不会难读。
    const nodeWidth = 820;

    // 设置列间距，避免节点过于拥挤。
    const columnGap = 220;

    // 设置行间距，给连接线与节点预览留出足够空间。
    const rowGap = 240;

    // 初始化节点数组。
    const nodes = [];

    // 初始化边数组。
    const edges = [];

    // 初始化每一行的最大高度数组。
    const rowHeights = [];

    // 先预计算每个节点的高度。
    const heights = noteDescriptors.map((note) => estimateCanvasNodeHeight(note.previewLength, note.imageCount));

    // 遍历所有节点，先统计每一行最高值。
    heights.forEach((height, index) => {
      // 计算当前节点所在行号。
      const rowIndex = Math.floor(index / columnCount);

      // 用当前高度刷新该行的最大高度。
      rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] || 0, height);
    });

    // 记录每一行顶部 y 坐标的累计值。
    const rowTopPositions = [];

    // 初始化累计 y 值。
    let accumulatedY = 0;

    // 遍历每一行，计算该行起始 y 位置。
    rowHeights.forEach((height, rowIndex) => {
      // 当前行顶部位置等于当前累计值。
      rowTopPositions[rowIndex] = accumulatedY;

      // 把累计值推进到下一行顶部。
      accumulatedY += height + rowGap;
    });

    // 按顺序为每一轮创建文件节点。
    noteDescriptors.forEach((note, index) => {
      // 计算当前节点所在列号。
      const columnIndex = index % columnCount;

      // 计算当前节点所在行号。
      const rowIndex = Math.floor(index / columnCount);

      // 读取当前节点高度。
      const height = heights[index];

      // 计算节点 x 坐标。
      const x = columnIndex * (nodeWidth + columnGap);

      // 计算节点 y 坐标。
      const y = rowTopPositions[rowIndex];

      // 生成节点唯一编号。
      const nodeId = `round-${note.roundIndex}`;

      // 创建文件节点对象。
      nodes.push({
        // 写入节点编号。
        id: nodeId,
        // 指定节点类型为文件。
        type: "file",
        // 写入节点左上角 x 坐标。
        x,
        // 写入节点左上角 y 坐标。
        y,
        // 写入节点宽度。
        width: nodeWidth,
        // 写入节点高度。
        height,
        // 指向该轮次对应的 Markdown 文件。
        file: note.vaultPath || note.relativePath,
        // 使用绿色系预设色，让文件卡片更醒目。
        color: note.roundIndex % 2 === 0 ? "4" : "6"
      });

      // 如果不是第一轮，就为它和前一轮之间连一条边。
      if (index > 0) {
        // 生成边唯一编号。
        const edgeId = `edge-${noteDescriptors[index - 1].roundIndex}-${note.roundIndex}`;

        // 创建边对象并加入边数组。
        edges.push({
          // 写入边编号。
          id: edgeId,
          // 指定起点节点。
          fromNode: `round-${noteDescriptors[index - 1].roundIndex}`,
          // 指定起点优先从右侧发出。
          fromSide: "right",
          // 指定终点节点。
          toNode: nodeId,
          // 指定终点优先接到左侧。
          toSide: "left",
          // 给终点保留箭头。
          toEnd: "arrow",
          // 让线条颜色更偏青色。
          color: "5"
        });
      }
    });

    // 返回符合 JSON Canvas 结构的对象。
    return {
      // 写入节点数组。
      nodes,
      // 写入边数组。
      edges
    };
  }

  // 根据内容长度与图片数量估算画布节点高度。
  function estimateCanvasNodeHeight(textLength, imageCount) {
    // 根据文本长度估算附加高度。
    const textHeight = Math.round((Number(textLength) || 0) * 0.22);

    // 根据图片数量估算附加高度，让带图轮次更容易预览。
    const imageHeight = (Number(imageCount) || 0) * 120;

    // 把基础高度、文本高度和图片高度叠加后再限制范围。
    return clampNumber(420 + textHeight + imageHeight, 420, 920);
  }

  // 用映射表替换 Markdown 中的图片占位符。
  function replaceImagePlaceholders(markdown, imageReplacementMap, enableImages) {
    // 如果没启用图片导出，就把占位符整体移除掉。
    if (!enableImages) {
      // 直接删除所有图片占位符。
      return String(markdown || "").replace(/\[\[\[CHATGPT_EXPORT_IMAGE:[^\]]+\]\]\]/g, "");
    }

    // 对全部占位符做逐个替换。
    return String(markdown || "").replace(/\[\[\[CHATGPT_EXPORT_IMAGE:([^\]]+)\]\]\]/g, (_match, imageId) => {
      // 如果映射表中存在对应图片，就替换成最终嵌入语法。
      if (imageReplacementMap.has(imageId)) {
        // 返回映射后的嵌入语法。
        return imageReplacementMap.get(imageId) || "";
      }

      // 否则返回空字符串，避免保留占位符原文。
      return "";
    });
  }

  // 把连续单独成行的图片嵌入合并到同一行，提升多图并排显示的概率。
  function normalizeStandaloneImageRuns(markdown) {
    // 把输入拆成逐行数组。
    const lines = String(markdown || "").split("\n");

    // 初始化输出行数组。
    const output = [];

    // 初始化当前缓存的图片行数组。
    let imageRun = [];

    // 定义识别“这一行只有图片嵌入”的正则。
    const imageOnlyPattern = /^\s*!\[\[[^\]]+\]\](?:\s*!\[\[[^\]]+\]\])*\s*$/;

    // 遍历每一行，尝试归并相邻图片块。
    lines.forEach((line) => {
      // 取当前行的首尾裁剪版本，便于判断。
      const trimmed = line.trim();

      // 如果当前行只包含图片嵌入语法，就把它并入缓存。
      if (imageOnlyPattern.test(trimmed)) {
        // 把当前图片行加入缓存数组。
        imageRun.push(trimmed);

        // 继续处理下一行。
        return;
      }

      // 如果当前行是空行，并且前面正处于图片缓存区，就先跳过，让图片继续向后归并。
      if (!trimmed && imageRun.length > 0) {
        // 直接继续，不把空行写出。
        return;
      }

      // 如果缓存中已经有图片行，就先把它们合并为一行再输出。
      if (imageRun.length > 0) {
        // 把多行图片合并到同一行中。
        output.push(imageRun.join(" "));

        // 清空图片缓存。
        imageRun = [];
      }

      // 把当前普通文本行写入输出。
      output.push(line);
    });

    // 循环结束后，如果仍有缓存图片行，要再补写一次。
    if (imageRun.length > 0) {
      // 把剩余图片缓存写入输出数组。
      output.push(imageRun.join(" "));
    }

    // 对最终结果做基础清洗。
    return cleanupMarkdown(output.join("\n"));
  }

  // 拼接多个 Obsidian / 文件写入相对路径片段。
  function joinPathSegments(...segments) {
    // 去掉空片段并统一使用正斜杠。
    return segments
      .flatMap((segment) => String(segment || "").split("/"))
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join("/");
  }

  // 校验并规范化用户填写的 Obsidian 仓库内路径。
  function normalizeVaultPath(value, allowEmpty) {
    // 读取原始输入。
    const rawValue = String(value || "").trim();

    // 空值是否允许由调用方决定。
    if (!rawValue) {
      // 不允许空值时直接报错。
      if (!allowEmpty) {
        // 抛出可读错误。
        throw new Error("Obsidian 内路径不能为空。");
      }

      // 空路径表示仓库根目录。
      return "";
    }

    // 不允许 Windows 盘符、绝对路径或反斜杠。
    if (/^[a-zA-Z]:/.test(rawValue) || rawValue.startsWith("/") || rawValue.startsWith("\\") || rawValue.includes("\\")) {
      // 抛出可读错误。
      throw new Error("Obsidian 内路径必须是仓库内的相对路径，并使用 / 作为分隔符。");
    }

    // 不允许文件系统不安全字符。
    if (/[\\:*?"<>|#^\[\]]/.test(rawValue)) {
      // 抛出可读错误。
      throw new Error("Obsidian 内路径包含不支持的字符，请只使用普通文件夹名并用 / 分隔。");
    }

    // 拆分并清理每一级路径。
    const segments = rawValue.split("/").map((segment) => segment.trim()).filter(Boolean);

    // 路径不能包含当前目录或上级目录跳转。
    if (segments.some((segment) => segment === "." || segment === "..")) {
      // 抛出可读错误。
      throw new Error("Obsidian 内路径不能包含 . 或 ..。");
    }

    // 校验每一级路径片段都能作为安全文件夹名使用。
    segments.forEach((segment) => {
      // 使用现有文件名清洗逻辑做一致性校验。
      if (sanitizePathSegment(segment, "") !== segment) {
        // 抛出可读错误。
        throw new Error(`Obsidian 内路径片段不可用：${segment}`);
      }
    });

    // 返回标准化后的路径。
    return segments.join("/");
  }

  // 生成更适合做默认导出目录名的文本。
  function makeDefaultFolderName(title) {
    // 生成只保留适合路径使用的目录名。
    return sanitizePathSegment(makePreview(title || "未命名对话", 48), "未命名对话");
  }

  // 为单轮笔记生成稳定可读的文件名。
  function makeRoundFileName(roundIndex, title) {
    // 生成两位补零的轮次编号文本。
    const orderText = String(roundIndex).padStart(2, "0");

    // 清洗标题，使其可安全用于文件名。
    const safeTitle = sanitizePathSegment(makePreview(title || `第 ${roundIndex} 轮`, 48), `第 ${roundIndex} 轮`);

    // 返回最终 Markdown 文件名。
    return `${orderText} - ${safeTitle}.md`;
  }

  // 为图片文件生成可读文件名。
  function makeImageFileName(image, extension) {
    // 读取轮次编号并补零。
    const roundText = String(image.roundIndex || 0).padStart(2, "0");

    // 读取该图在轮次中的序号并补零。
    const imageText = String(image.imageIndex || 0).padStart(2, "0");

    // 清洗图片替代文本，便于识别来源。
    const safeAlt = sanitizePathSegment(makePreview(image.alt || "image", 24), "image");

    // 拼接最终文件名。
    return `r${roundText}-${image.role || "message"}-${imageText}-${safeAlt}.${extension || "bin"}`;
  }

  // 统计单轮中的图片数量。
  function getRoundImageCount(round) {
    // 读取提问图片数量。
    const promptCount = Array.isArray(round && round.promptImages) ? round.promptImages.length : 0;

    // 读取回复图片数量。
    const responseCount = Array.isArray(round && round.responseImages) ? round.responseImages.length : 0;

    // 返回两部分之和。
    return promptCount + responseCount;
  }

  // 生成更短、更适合作为预览文本的摘要。
  function makePreview(text, maxLength = 72) {
    // 先把空白统一压缩为更稳定的形式。
    const normalized = normalizeWhitespace(text || "");

    // 如果长度本来就够短，就直接返回。
    if (normalized.length <= maxLength) {
      // 返回原始摘要。
      return normalized;
    }

    // 否则截断并补一个省略号。
    return `${normalized.slice(0, maxLength).trim()}…`;
  }

  // 压缩文本中的多余空白。
  function normalizeWhitespace(text) {
    // 把输入安全转成字符串。
    const safeText = typeof text === "string" ? text : "";

    // 清理零宽字符并压缩连续空白。
    return safeText.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
  }

  // 对 Markdown 文本做统一清洗，避免空行过多。
  function cleanupMarkdown(markdown) {
    // 把输入转成字符串，避免出现非字符串报错。
    const safeMarkdown = typeof markdown === "string" ? markdown : "";

    // 统一换行符并去掉行尾空白。
    const normalized = safeMarkdown.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");

    // 把三行以上空行压缩成双空行。
    return normalized.replace(/\n{3,}/g, "\n\n").trim();
  }

  // 给多行文本逐行加前缀，用于生成 callout 与 blockquote。
  function prefixLines(text, prefix) {
    // 把输入稳定转成字符串。
    const safeText = typeof text === "string" ? text : "";

    // 逐行拼接前缀并返回。
    return safeText.split("\n").map((line) => `${prefix}${line}`).join("\n");
  }

  // 把任意字符串清洗成可安全用于路径片段的文本。
  function sanitizePathSegment(value, fallback) {
    // 先把输入转成字符串。
    const raw = String(value || "");

    // 替换掉文件系统不允许的特殊字符。
    const cleaned = raw
      .replace(/[\\/:*?"<>|#^\[\]]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^\.+/, "")
      .replace(/[. ]+$/g, "")
      .trim();

    // Windows 保留设备名不能直接作为文件名或目录名使用。
    const reservedNamePattern = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

    // 如果清洗后为空，或命中了保留名，就回退到备用文本。
    if (!cleaned || reservedNamePattern.test(cleaned)) {
      // 返回备用文本或默认名。
      return fallback || "untitled";
    }

    // 返回清洗后的安全路径片段。
    return cleaned;
  }

  // 把数字限制到给定范围内。
  function clampNumber(value, min, max) {
    // 先把值转成数字。
    const numericValue = Number(value);

    // 如果不是有限数字，就回退到最小值。
    if (!Number.isFinite(numericValue)) {
      // 返回下界。
      return min;
    }

    // 夹紧数值到合法区间后返回。
    return Math.min(max, Math.max(min, numericValue));
  }

  // 转义 YAML 中的标量文本，避免冒号与引号破坏结构。
  function escapeYamlScalar(value) {
    // 把输入转成稳定字符串。
    const text = String(value || "");

    // 使用 JSON 风格双引号字符串，简单可靠。
    return JSON.stringify(text);
  }

  // 根据 MIME 类型猜测更适合的扩展名。
  function extensionFromMimeType(mimeType) {
    // 把 MIME 转为小写，便于后续判断。
    const normalized = String(mimeType || "").toLowerCase();

    // 如果是 PNG，就返回 png。
    if (normalized === "image/png") {
      // 返回 png 扩展名。
      return "png";
    }

    // 如果是 JPEG，就返回 jpg。
    if (normalized === "image/jpeg" || normalized === "image/jpg") {
      // 返回 jpg 扩展名。
      return "jpg";
    }

    // 如果是 WebP，就返回 webp。
    if (normalized === "image/webp") {
      // 返回 webp 扩展名。
      return "webp";
    }

    // 如果是 GIF，就返回 gif。
    if (normalized === "image/gif") {
      // 返回 gif 扩展名。
      return "gif";
    }

    // 如果是 SVG，就返回 svg。
    if (normalized === "image/svg+xml") {
      // 返回 svg 扩展名。
      return "svg";
    }

    // 如果是 BMP，就返回 bmp。
    if (normalized === "image/bmp") {
      // 返回 bmp 扩展名。
      return "bmp";
    }

    // 否则返回空字符串，表示无法判断。
    return "";
  }
})();
