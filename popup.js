// 根据当前标签页地址判断是否属于已支持的对话平台。
function getSupportedProviderFromUrl(url) {
  // 把输入安全转换成字符串，避免空值导致后续判断报错。
  const safeUrl = typeof url === "string" ? url : "";

  // 如果地址属于 ChatGPT 域名，就返回 ChatGPT。
  if (safeUrl.startsWith("https://chatgpt.com/") || safeUrl.startsWith("https://chat.openai.com/")) {
    // 返回 ChatGPT 平台标记。
    return "chatgpt";
  }

  // 如果地址属于 Gemini 域名，就返回 Gemini。
  if (safeUrl.startsWith("https://gemini.google.com/")) {
    // 返回 Gemini 平台标记。
    return "gemini";
  }

  // 其余地址统一返回空字符串，表示当前页不受支持。
  return "";
}

// 把平台标记转换成更适合展示给用户的名称。
function getProviderDisplayName(provider) {
  // Gemini 对应展示名 Gemini。
  if (provider === "gemini") {
    // 返回 Gemini。
    return "Gemini";
  }

  // ChatGPT 对应展示名 ChatGPT。
  if (provider === "chatgpt") {
    // 返回 ChatGPT。
    return "ChatGPT";
  }

  // 其他未知情况回退为“当前对话页”。
  return "当前对话页";
}

// 等待弹窗文档渲染完成后再初始化逻辑。
document.addEventListener("DOMContentLoaded", () => {
  // 获取“打开导出面板”按钮。
  const openPanelButton = document.getElementById("open-panel-button");

  // 获取状态文本节点，用来回显当前执行状态。
  const statusText = document.getElementById("status-text");

  // 如果关键节点缺失，就不继续执行，避免后续空引用报错。
  if (!openPanelButton || !statusText) {
    // 直接结束初始化。
    return;
  }

  // 监听按钮点击事件，点击后打开完整导出面板。
  openPanelButton.addEventListener("click", async () => {
    // 先把按钮置为禁用，避免重复点击触发多次。
    openPanelButton.disabled = true;

    // 先更新状态文字，让用户知道当前正在检查页面。
    statusText.textContent = "正在检查当前标签页…";

    try {
      // 读取当前窗口中的激活标签页。
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

      // 取出当前活动标签页。
      const activeTab = tabs[0];

      // 如果没有拿到标签页，就抛出错误。
      if (!activeTab || typeof activeTab.id !== "number") {
        // 抛出明确错误信息，方便后续展示给用户。
        throw new Error("没有找到当前活动标签页。请先切到 ChatGPT 或 Gemini 的对话页面。");
      }

      // 读取当前标签页地址，后面要判断是不是已支持的对话页面。
      const currentUrl = activeTab.url || "";

      // 根据地址识别当前平台。
      const provider = getSupportedProviderFromUrl(currentUrl);

      // 如果不是支持的页面，就直接提示用户。
      if (!provider) {
        // 抛出错误信息，统一走下方的错误处理分支。
        throw new Error("当前标签页不是 ChatGPT 或 Gemini 的对话页面。请先打开具体对话。\n");
      }

      // 组装扩展内部面板地址，并带上来源标签页编号。
      const panelUrl = chrome.runtime.getURL(`panel.html?sourceTabId=${activeTab.id}`);

      // 在新标签页中打开完整导出面板。
      await chrome.tabs.create({ url: panelUrl });

      // 提示已经成功打开导出面板。
      statusText.textContent = "已打开导出面板。";

      // 主动关闭弹窗，让操作流程更顺滑。
      window.close();
    } catch (error) {
      // 把错误消息转成更安全的字符串。
      const message = error instanceof Error ? error.message : "打开导出面板失败。";

      // 在界面中显示错误原因。
      statusText.textContent = message.trim();

      // 重新启用按钮，允许用户再次尝试。
      openPanelButton.disabled = false;
    }
  });
});
