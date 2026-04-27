// 使用立即执行函数隔离作用域，避免污染页面环境。
(() => {
  // 如果当前页面已经注入过本脚本，就直接结束，避免重复注册监听器。
  if (window.__chatgptObsidianExporterInjected) {
    // 结束本次注入。
    return;
  }

  // 在页面上打一个注入标记，后续重复执行时可安全跳过。
  window.__chatgptObsidianExporterInjected = true;

  // 根据当前域名判断这次提取来自哪个对话平台。
  const CURRENT_PROVIDER = detectConversationProvider();

  // 定义本脚本支持识别的角色集合。
  const SUPPORTED_ROLES = new Set(["user", "assistant", "system", "tool"]);

  // 定义图片占位符前缀，后面会用于把图片嵌回 Markdown。
  const IMAGE_PLACEHOLDER_PREFIX = "[[[CHATGPT_EXPORT_IMAGE:";

  // 定义图片占位符后缀。
  const IMAGE_PLACEHOLDER_SUFFIX = "]]]";


  // 根据当前页面域名识别对话平台，便于后续走不同的轻量适配逻辑。
  function detectConversationProvider() {
    // 读取当前页面主机名，并统一转换成小写。
    const hostname = (window.location.hostname || "").toLowerCase();

    // Gemini 的网页端当前运行在 gemini.google.com 下。
    if (hostname === "gemini.google.com") {
      // 返回 Gemini 平台标记。
      return "gemini";
    }

    // ChatGPT 的网页端当前运行在 chatgpt.com 或旧域名 chat.openai.com 下。
    if (hostname === "chatgpt.com" || hostname === "chat.openai.com") {
      // 返回 ChatGPT 平台标记。
      return "chatgpt";
    }

    // 其他未知站点一律标记为 unknown，方便后续兜底。
    return "unknown";
  }

  // 把平台标记转换成更适合展示给用户的名称。
  function getProviderDisplayName(provider) {
    // 如果当前平台是 Gemini，就返回 Gemini。
    if (provider === "gemini") {
      // 返回 Gemini 展示名。
      return "Gemini";
    }

    // 如果当前平台是 ChatGPT，就返回 ChatGPT。
    if (provider === "chatgpt") {
      // 返回 ChatGPT 展示名。
      return "ChatGPT";
    }

    // 未知平台时给一个更中性的保底名称。
    return "AI 对话";
  }

  // 把元素 className 安全转换成普通字符串，避免 SVGAnimatedString 等特殊类型影响判断。
  function getSafeClassText(element) {
    // 如果元素无效，就直接返回空字符串。
    if (!(element instanceof Element)) {
      // 返回空字符串。
      return "";
    }

    // 读取 className 原始值。
    const rawClassName = element.className;

    // 如果本身就是字符串，就直接返回它。
    if (typeof rawClassName === "string") {
      // 返回字符串类名。
      return rawClassName;
    }

    // 如果类名对象上带有 baseVal，也尝试读取它。
    if (rawClassName && typeof rawClassName.baseVal === "string") {
      // 返回 SVG 等对象上的 baseVal 字段。
      return rawClassName.baseVal;
    }

    // 其余情况统一回退为空字符串。
    return "";
  }

  // 判断元素是否真实可见，避免把隐藏节点误当成正文。
  function isElementVisible(element) {
    // 如果元素无效，就直接返回不可见。
    if (!(element instanceof HTMLElement)) {
      // 返回不可见结果。
      return false;
    }

    // 读取当前元素的计算样式。
    const style = window.getComputedStyle(element);

    // 如果元素没有布局矩形或被 display/visibility 隐藏，则视为不可见。
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
  }

  // 统一压缩文本中的多余空白。
  function normalizeWhitespace(text) {
    // 把输入安全转成字符串。
    const safeText = typeof text === "string" ? text : "";

    // 去掉零宽字符，再把连续空白压缩成单个空格。
    return safeText.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
  }

  // 对 Markdown 文本做统一清洗，减少无意义空行。
  function cleanupMarkdown(markdown) {
    // 把输入安全转成字符串。
    const safeMarkdown = typeof markdown === "string" ? markdown : "";

    // 先统一换行并去掉行尾空白。
    const normalized = safeMarkdown.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");

    // 再把过多空行压缩到双空行。
    return normalized.replace(/\n{3,}/g, "\n\n").trim();
  }

  // 生成更适合作为标题预览的短文本。
  function makeTitlePreview(text, maxLength = 72) {
    // 先压缩空白，得到更稳定的文本。
    const normalized = normalizeWhitespace(text);

    // 如果长度已经足够短，就直接返回。
    if (normalized.length <= maxLength) {
      // 返回原始短文本。
      return normalized;
    }

    // 否则截断并补省略号。
    return `${normalized.slice(0, maxLength).trim()}…`;
  }

  // 对内联代码文本做安全包裹，避免内容里已有反引号时破坏 Markdown。
  function wrapInlineCode(text) {
    // 把输入安全转成字符串。
    const safeText = typeof text === "string" ? text : "";

    // 找出文本中连续反引号的最长长度。
    const matches = safeText.match(/`+/g) || [];

    // 计算所需包装反引号数量。
    const wrapperLength = Math.max(1, ...matches.map((item) => item.length)) + 1;

    // 生成对应数量的包装反引号。
    const wrapper = "`".repeat(wrapperLength);

    // 返回包裹后的代码文本。
    return `${wrapper}${safeText}${wrapper}`;
  }

  // 给每一行添加前缀，用于生成 blockquote 等结构。
  function prefixLines(text, prefix) {
    // 把输入统一转成字符串。
    const safeText = typeof text === "string" ? text : "";

    // 逐行拼接前缀。
    return safeText.split("\n").map((line) => `${prefix}${line}`).join("\n");
  }

  // 尝试从页面标题或正文中提取当前对话标题。
  function getConversationTitle() {
    // 先读取文档标题。
    const documentTitle = normalizeWhitespace(document.title || "");

    // 去掉常见的站点后缀。
    const strippedTitle = documentTitle.replace(/\s*[|-]\s*(ChatGPT|Gemini)\s*$/i, "").trim();

    // 如果清洗后的标题可用，就优先返回。
    if (strippedTitle) {
      // 返回清洗后的标题。
      return strippedTitle;
    }

    // 再尝试从正文 h1 中读取标题。
    const h1 = document.querySelector("main h1, [role='main'] h1, h1");

    // 读取 h1 文本。
    const h1Text = normalizeWhitespace(h1 ? h1.textContent || "" : "");

    // 如果 h1 文本存在，就返回它。
    if (h1Text) {
      // 返回 h1 标题。
      return h1Text;
    }

    // 兜底返回未命名标题。
    return "未命名对话";
  }

  // 从 URL 中解析对话编号。
  function getConversationId() {
    // 读取当前路径名。
    const pathname = window.location.pathname || "";

    // 准备一组常见的会话路径匹配规则，依次覆盖 ChatGPT、Gemini 和分享页。
    const pathPatterns = [/\/c\/([^/?#]+)/i, /\/app\/([^/?#]+)/i, /\/share\/([^/?#]+)/i];

    // 依次尝试这些路径规则。
    for (const pattern of pathPatterns) {
      // 用当前规则匹配路径。
      const match = pathname.match(pattern);

      // 如果匹配成功，就返回捕获到的编号。
      if (match && match[1]) {
        // 返回当前会话编号。
        return match[1];
      }
    }

    // 如果路径里没有编号，就继续尝试从查询参数中读取。
    const url = new URL(window.location.href);

    // 定义一组常见的查询参数名。
    const queryKeys = ["conversationId", "conversation", "chat", "id"];

    // 依次读取这些参数。
    for (const key of queryKeys) {
      // 读取当前参数值。
      const value = normalizeWhitespace(url.searchParams.get(key) || "");

      // 如果当前参数值存在，就直接返回。
      if (value) {
        // 返回查询参数中的会话编号。
        return value;
      }
    }

    // 否则返回空字符串。
    return "";
  }

  // 过滤掉被其他候选包含的子节点，只保留最高层候选。
  function keepTopLevelNodes(nodes) {
    // 把输入统一转成数组。
    const nodeList = Array.isArray(nodes) ? nodes : Array.from(nodes || []);

    // 只保留真正的 HTMLElement。
    const elementList = nodeList.filter((node) => node instanceof HTMLElement);

    // 过滤掉被同组其他节点包含的候选。
    return elementList.filter((candidate) => !elementList.some((other) => other !== candidate && other.contains(candidate)));
  }

  // 按文档中的真实先后顺序排列一组节点，避免多组选择器合并后顺序错乱。
  function sortNodesInDocumentOrder(nodes) {
    // 把输入统一压成 HTMLElement 数组。
    const elementList = (Array.isArray(nodes) ? nodes : Array.from(nodes || [])).filter((node) => node instanceof HTMLElement);

    // 按文档位置排序，前面的节点先输出。
    return elementList.sort((left, right) => {
      // 同一节点不需要交换位置。
      if (left === right) {
        // 直接返回相等。
        return 0;
      }

      // 读取两个节点的文档相对位置。
      const relation = left.compareDocumentPosition(right);

      // 如果 left 在 right 前面，就让 left 排在前面。
      if (relation & Node.DOCUMENT_POSITION_FOLLOWING) {
        // 返回负值表示 left 更靠前。
        return -1;
      }

      // 如果 left 在 right 后面，就让 left 排在后面。
      if (relation & Node.DOCUMENT_POSITION_PRECEDING) {
        // 返回正值表示 left 更靠后。
        return 1;
      }

      // 其余情况保持原状。
      return 0;
    });
  }

  // 判断某个候选节点是否包含足够的正文内容或图片内容。
  function nodeHasMeaningfulContent(node) {
    // 如果节点无效，就直接返回假值。
    if (!(node instanceof HTMLElement)) {
      // 返回假值。
      return false;
    }

    // 如果有可见文本，就认为是有效内容。
    if (normalizeWhitespace(node.innerText || node.textContent || "").length > 0) {
      // 返回真值。
      return true;
    }

    // 如果节点内存在图片，也认为这是有效内容。
    if (node.querySelector("img, picture, figure")) {
      // 返回真值。
      return true;
    }

    // 否则认为内容不足。
    return false;
  }

  // 获取页面中最可能代表对话消息的一组候选节点。
  function getMessageCandidates() {
    // 先读取主内容区域，并兼容部分站点使用 role='main' 的情况。
    const main = document.querySelector("main, [role='main']") || document.body;

    // 如果主区域不存在，就直接返回空数组。
    if (!(main instanceof HTMLElement)) {
      // 返回空数组。
      return [];
    }

    // 根据不同平台准备不同的高优先级候选选择器。
    const selectorGroups = CURRENT_PROVIDER === "gemini"
      ? [
          "user-query, model-response",
          "message-content",
          "[data-testid*='user-query'], [data-testid*='model-response']",
          "[data-test-id*='user-query'], [data-test-id*='model-response']",
          "[class*='user-query'], [class*='model-response']",
          "[data-message-author-role]",
          "article[data-testid*='conversation-turn']",
          "article[data-testid*='turn']",
          "article",
          "[data-testid*='turn']"
        ]
      : [
          "[data-message-author-role]",
          "article[data-testid*='conversation-turn']",
          "article[data-testid*='turn']",
          "article",
          "[data-testid*='turn']"
        ];

    // 保存所有可用候选集合，最后挑最完整的一组。
    const candidateSets = [];

    // 逐组尝试寻找可用候选节点。
    for (const selector of selectorGroups) {
      // 收集 main 下所有匹配节点。
      const rawNodes = Array.from(main.querySelectorAll(selector));

      // 去掉父子重复。
      const topLevelNodes = keepTopLevelNodes(rawNodes);

      // 只保留可见且文本不为空的节点。
      const visibleNodes = sortNodesInDocumentOrder(topLevelNodes.filter((node) => isElementVisible(node) && nodeHasMeaningfulContent(node)));

      // 只记录非空结果，后续统一评分。
      if (visibleNodes.length > 0) {
        // 收集这组候选。
        candidateSets.push(visibleNodes);
      }
    }

    // Gemini 页面有时会混用多种消息节点标签；额外合并一组更具体的选择器，减少“只命中前几轮”的情况。
    if (CURRENT_PROVIDER === "gemini") {
      // 这组选择器尽量避开过于宽泛的 article 包裹层，优先合并更像真实消息根节点的元素。
      const mergedGeminiSelector = [
        "user-query",
        "model-response",
        "message-content",
        "[data-testid*='user-query']",
        "[data-testid*='model-response']",
        "[data-test-id*='user-query']",
        "[data-test-id*='model-response']",
        "[class*='user-query']",
        "[class*='model-response']",
        "[data-message-author-role]"
      ].join(", ");

      // 收集合并选择器下的全部候选。
      const mergedGeminiNodes = sortNodesInDocumentOrder(
        keepTopLevelNodes(Array.from(main.querySelectorAll(mergedGeminiSelector)))
          .filter((node) => isElementVisible(node) && nodeHasMeaningfulContent(node))
      );

      // 如果合并结果非空，也纳入评分。
      if (mergedGeminiNodes.length > 0) {
        // 保存 Gemini 合并候选集。
        candidateSets.push(mergedGeminiNodes);
      }
    }

    // 如果已经收集到可用候选集合，就挑分数最高的一组返回。
    if (candidateSets.length > 0) {
      // 逐组评分，优先选择“轮次更多、角色更平衡、正文更完整”的候选集。
      const bestCandidateSet = candidateSets.reduce((best, current) => {
        // 如果当前还没有最优结果，就先把当前组设为最优。
        if (!best) {
          // 返回当前组作为初始最优。
          return current;
        }

        // 计算当前最优组的分数。
        const bestScore = scoreMessageCandidateSet(best);

        // 计算当前组的分数。
        const currentScore = scoreMessageCandidateSet(current);

        // 更高分的候选集直接替换。
        if (currentScore > bestScore) {
          // 当前组更优。
          return current;
        }

        // 分数持平时，优先保留节点更多的那组。
        if (currentScore === bestScore && current.length > best.length) {
          // 当前组覆盖更多节点。
          return current;
        }

        // 否则保持原最优组不变。
        return best;
      }, null);

      // 如果评分成功拿到结果，就返回它。
      if (Array.isArray(bestCandidateSet) && bestCandidateSet.length > 0) {
        // 返回最优候选集合。
        return bestCandidateSet;
      }
    }

    // 如果上面的选择器都没有成功，就退回 main 的直接子块。
    return sortNodesInDocumentOrder(Array.from(main.children).filter((node) => node instanceof HTMLElement && isElementVisible(node) && nodeHasMeaningfulContent(node)));
  }

  // 给一组消息候选打分，优先选择更像“完整对话流”的集合。
  function scoreMessageCandidateSet(candidates) {
    // 把输入统一收敛成数组，避免空值参与计算。
    const nodes = Array.isArray(candidates) ? candidates : [];

    // 如果没有候选节点，就直接给最低分。
    if (nodes.length === 0) {
      // 返回极低分。
      return Number.NEGATIVE_INFINITY;
    }

    // 初始化统计量。
    let alternatingFallbackRole = "user";
    let userCount = 0;
    let assistantCount = 0;
    let meaningfulRoleCount = 0;
    let totalTextLength = 0;
    let totalImageCount = 0;

    // 遍历所有候选节点，估算这一组的完整度。
    nodes.forEach((node) => {
      // 猜测当前节点角色。
      const role = guessRoleFromElement(node, alternatingFallbackRole);

      // 统计 user / assistant 的数量。
      if (role === "user") {
        // 用户消息加一。
        userCount += 1;
        meaningfulRoleCount += 1;
        alternatingFallbackRole = "assistant";
      } else if (role === "assistant") {
        // 助手消息加一。
        assistantCount += 1;
        meaningfulRoleCount += 1;
        alternatingFallbackRole = "user";
      }

      // 累加文本体量，避免选到只有几个空壳节点的集合。
      totalTextLength += normalizeWhitespace(node.innerText || node.textContent || "").length;

      // 累加图片数量，带图消息的集合更可能是完整对话。
      totalImageCount += countMeaningfulImages(node);
    });

    // 组合成一个偏向“节点更多、角色更平衡、正文更完整”的总分。
    return nodes.length * 10000
      + Math.min(userCount, assistantCount) * 2000
      + meaningfulRoleCount * 400
      + Math.min(totalTextLength, 120000) * 0.02
      + totalImageCount * 35;
  }

  // 在真正提取前，给动态对话页面一个很短的稳定窗口，减少 Gemini 切页后只抓到部分节点的概率。
  async function waitForConversationDomToSettle() {
    // 读取主内容区域。
    const main = document.querySelector("main, [role='main']") || document.body;

    // 如果主区域不可用，就简单等待一个很短的时间后返回。
    if (!(main instanceof HTMLElement)) {
      // 直接等待固定时长。
      await new Promise((resolve) => window.setTimeout(resolve, 240));
      return;
    }

    // 等待 DOM 在一个短时间窗口内不再继续突变。
    await new Promise((resolve) => {
      // 设置一个最长等待时间，避免页面持续更新时无限阻塞。
      const hardTimeoutId = window.setTimeout(finish, CURRENT_PROVIDER === "gemini" ? 1200 : 700);

      // 准备一个“静默窗口”定时器，期间没有突变就认为页面基本稳定。
      let quietTimerId = window.setTimeout(finish, 260);

      // 监听主区域变化。
      const observer = new MutationObserver(() => {
        // 每次变化都重新开始计时，等页面安静下来。
        window.clearTimeout(quietTimerId);
        quietTimerId = window.setTimeout(finish, 260);
      });

      // 标记是否已经结束，避免重复 resolve。
      let settled = false;

      // 真正结束等待的统一出口。
      function finish() {
        // 如果已经结束过，就直接跳过。
        if (settled) {
          // 结束当前调用。
          return;
        }

        // 标记已结束。
        settled = true;

        // 停止监听并清理定时器。
        observer.disconnect();
        window.clearTimeout(hardTimeoutId);
        window.clearTimeout(quietTimerId);

        // 通知外层继续执行。
        resolve();
      }

      // 启动监听。
      observer.observe(main, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });
  }

  // 根据属性、测试标记和按钮特征猜测当前候选节点的角色。
  function guessRoleFromElement(element, fallbackRole) {
    // 如果元素无效，就直接使用回退角色。
    if (!(element instanceof HTMLElement)) {
      // 返回回退角色。
      return fallbackRole || "";
    }

    // 先读取当前元素的小写标签名。
    const tagName = element.tagName.toLowerCase();

    // Gemini 页面里 user-query 一般就是用户消息根节点。
    if (tagName === "user-query") {
      // 返回 user 角色。
      return "user";
    }

    // Gemini 页面里 model-response 一般就是模型回复根节点。
    if (tagName === "model-response") {
      // 返回 assistant 角色。
      return "assistant";
    }

    // 如果当前节点本身不是根标签，也尝试从最近的 Gemini 消息祖先推断角色。
    const closestGeminiRoleRoot = element.closest("user-query, model-response");

    // 如果找到了 Gemini 角色祖先，就按祖先标签名判断。
    if (closestGeminiRoleRoot instanceof HTMLElement) {
      // 读取祖先标签名。
      const ancestorTagName = closestGeminiRoleRoot.tagName.toLowerCase();

      // user-query 祖先对应 user。
      if (ancestorTagName === "user-query") {
        // 返回 user。
        return "user";
      }

      // model-response 祖先对应 assistant。
      if (ancestorTagName === "model-response") {
        // 返回 assistant。
        return "assistant";
      }
    }

    // 先尝试读取当前元素上的 data-message-author-role。
    const directRole = (element.getAttribute("data-message-author-role") || "").toLowerCase().trim();

    // 如果当前元素直接提供了合法角色，就返回它。
    if (SUPPORTED_ROLES.has(directRole)) {
      // 返回直接角色。
      return directRole;
    }

    // 再尝试从子树中寻找角色属性。
    const nestedRoleElement = element.querySelector("[data-message-author-role]");

    // 读取嵌套角色。
    const nestedRole = nestedRoleElement ? (nestedRoleElement.getAttribute("data-message-author-role") || "").toLowerCase().trim() : "";

    // 如果嵌套角色合法，就返回它。
    if (SUPPORTED_ROLES.has(nestedRole)) {
      // 返回嵌套角色。
      return nestedRole;
    }

    // 读取 data-testid，很多页面会在这里隐式体现角色。
    const testId = (element.getAttribute("data-testid") || "").toLowerCase();

    // 如果 testId 里提到 assistant，就返回 assistant。
    if (testId.includes("assistant")) {
      // 返回 assistant。
      return "assistant";
    }

    // 如果 testId 里提到 user，就返回 user。
    if (testId.includes("user")) {
      // 返回 user。
      return "user";
    }

    // 再把类名、测试标记和 aria 标签拼成统一特征串，兼容 Gemini 常见的命名方式。
    const structuralSignature = `${getSafeClassText(element)} ${testId} ${element.getAttribute("aria-label") || ""}`.toLowerCase();

    // 如果结构特征里提到 model-response，就返回 assistant。
    if (structuralSignature.includes("model-response")) {
      // 返回 assistant。
      return "assistant";
    }

    // 如果结构特征里提到 user-query，就返回 user。
    if (structuralSignature.includes("user-query")) {
      // 返回 user。
      return "user";
    }

    // 汇总当前候选节点内按钮的文本特征。
    const buttonSignature = Array.from(element.querySelectorAll("button"))
      .map((button) => `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""} ${button.textContent || ""}`.toLowerCase())
      .join(" ");

    // 如果出现复制、草稿或二次核查相关特征，通常更像 assistant 消息。
    if (buttonSignature.includes("copy") || buttonSignature.includes("复制") || buttonSignature.includes("regenerate") || buttonSignature.includes("重新生成") || buttonSignature.includes("double-check") || buttonSignature.includes("draft") || buttonSignature.includes("草稿") || buttonSignature.includes("share") || buttonSignature.includes("分享")) {
      // 返回 assistant。
      return "assistant";
    }

    // 如果出现编辑相关特征，通常更像 user 消息。
    if (buttonSignature.includes("edit") || buttonSignature.includes("编辑")) {
      // 返回 user。
      return "user";
    }

    // 都判断不了时，回退为交替角色。
    return fallbackRole || "";
  }

  // 统计某个节点内部“有意义图片”的数量。
  function countMeaningfulImages(root) {
    // 如果根节点无效，就返回 0。
    if (!(root instanceof HTMLElement)) {
      // 返回 0。
      return 0;
    }

    // 先准备结果数组，后续统一收集图片。
    const images = [];

    // 如果根节点自己就是图片，也需要参与统计。
    if (root instanceof HTMLImageElement && !isLikelyDecorativeImage(root)) {
      // 把根节点图片加入结果数组。
      images.push(root);
    }

    // 再把子树中的普通图片一起统计进来。
    images.push(...Array.from(root.querySelectorAll("img")).filter((image) => image instanceof HTMLImageElement && !isLikelyDecorativeImage(image)));

    // 返回图片总数。
    return images.length;
  }

  // 找到一个候选节点内部最适合当作正文根节点的元素。
  function findBestContentRoot(element) {
    // 如果元素无效，就返回空。
    if (!(element instanceof HTMLElement)) {
      // 返回 null。
      return null;
    }

    // 定义一组优先级较高的正文容器选择器。
    const prioritySelectors = [
      ".markdown",
      ".prose",
      "[class*='markdown']",
      "[data-testid*='markdown']",
      "message-content",
      ".message-content",
      ".query-text",
      ".model-response-text",
      "[class*='query-text']",
      "[class*='model-response-text']",
      "[data-test-id*='query-text']",
      "[data-test-id*='model-response-text']",
      "[dir='auto']"
    ];

    // 读取整条候选消息包含的文本量。
    const rootTextLength = normalizeWhitespace(element.innerText || element.textContent || "").length;

    // 读取整条候选消息包含的图片量。
    const rootImageCount = countMeaningfulImages(element);

    // 构造候选正文根节点集合，并去重。
    const candidates = Array.from(new Set([
      element,
      ...prioritySelectors.flatMap((selector) => Array.from(element.querySelectorAll(selector))),
      ...Array.from(element.querySelectorAll("div, section, article, aside, figure, picture, a, button"))
    ])).filter((node) => node instanceof HTMLElement && isElementVisible(node));

    // 如果连一个可用候选都没有，就退回原始元素。
    if (candidates.length === 0) {
      // 返回原始元素。
      return element;
    }

    // 初始化最佳节点为原始元素自身。
    let bestNode = element;

    // 初始化最佳分数为负无穷，保证第一个候选可替换。
    let bestScore = Number.NEGATIVE_INFINITY;

    // 遍历所有候选节点，综合比较文本、图片与优先级。
    candidates.forEach((candidate) => {
      // 读取当前候选的文本长度。
      const textLength = normalizeWhitespace(candidate.innerText || candidate.textContent || "").length;

      // 读取当前候选的图片数量。
      const imageCount = countMeaningfulImages(candidate);

      // 判断当前候选是否命中高优先级正文容器选择器。
      const isPriorityMatch = prioritySelectors.some((selector) => candidate.matches(selector));

      // 先按文本长度与图片数量组成基础分数。
      let score = textLength + imageCount * 420;

      // 命中高优先级正文容器时，给一点额外加分。
      if (isPriorityMatch) {
        // 追加优先级加分。
        score += 80;
      }

      // 根节点自身通常更完整，给一个轻微保底加分。
      if (candidate === element) {
        // 追加根节点保底分。
        score += 40;
      }

      // 如果整条消息里有图片，而当前候选把图片全丢了，就重罚。
      if (rootImageCount > 0 && imageCount === 0) {
        // 扣除大量分数，避免只抓到纯文本子容器。
        score -= 600;
      }

      // 如果当前候选只拿到了部分图片，也做适度惩罚。
      if (rootImageCount > imageCount && imageCount > 0) {
        // 按缺失图片数量扣分。
        score -= (rootImageCount - imageCount) * 160;
      }

      // 如果整条消息本来就有较多文本，而当前候选只拿到很少文本，也要降权。
      if (rootTextLength > 40 && textLength < Math.max(12, Math.round(rootTextLength * 0.45))) {
        // 适度扣分，避免过窄的文本子块胜出。
        score -= 180;
      }

      // 如果得分更高，就更新最佳候选。
      if (score > bestScore) {
        // 写入新的最高分。
        bestScore = score;

        // 写入新的最佳节点。
        bestNode = candidate;
      }
    });

    // 返回最终找到的最佳正文根节点。
    return bestNode;
  }

  // 判断当前节点在清洗阶段是否必须保留，以免把已标记的导出图片一起删掉。
  function shouldPreserveNodeDuringPrune(node) {
    // 如果节点不是元素，就直接返回假值。
    if (!(node instanceof HTMLElement)) {
      // 返回假值。
      return false;
    }

    // 如果当前节点自己就是被标记的导出图片，就必须保留。
    if (node.hasAttribute("data-export-image-id")) {
      // 返回真值。
      return true;
    }

    // 如果当前节点内部还包着被标记的导出图片，也必须保留。
    if (node.querySelector("[data-export-image-id]")) {
      // 返回真值。
      return true;
    }

    // 否则不需要因为图片而强制保留它。
    return false;
  }

  // 在克隆节点上执行正文清洗，删除明显属于界面的操作控件。
  function pruneCloneInPlace(clone) {
    // 如果克隆节点无效，就直接返回 null。
    if (!(clone instanceof HTMLElement)) {
      // 返回空值。
      return null;
    }

    // 定义需要删除的界面类控件选择器。
    const removableSelectors = [
      "button",
      "input",
      "textarea",
      "select",
      "option",
      "form",
      "nav",
      "script",
      "style",
      "noscript",
      "[role='toolbar']",
      "[data-testid*='toolbar']",
      "[data-testid*='copy']"
    ];

    // 批量删除这些不属于正文的元素，但要保住已经标记好的导出图片。
    clone.querySelectorAll(removableSelectors.join(",")).forEach((node) => {
      // 如果当前节点内含已标记导出图片，就跳过删除。
      if (shouldPreserveNodeDuringPrune(node)) {
        // 直接结束当前节点处理。
        return;
      }

      // 否则删除当前节点。
      node.remove();
    });

    // 删除被 hidden 属性标记的元素，同样要保留已标记图片。
    clone.querySelectorAll("[hidden]").forEach((node) => {
      // 如果当前隐藏节点里含有已标记图片，就跳过删除。
      if (shouldPreserveNodeDuringPrune(node)) {
        // 直接结束当前节点处理。
        return;
      }

      // 否则删除当前隐藏节点。
      node.remove();
    });

    // 返回清洗后的克隆结果。
    return clone;
  }

  // 克隆正文节点并删除明显属于界面的操作控件。
  function cloneAndPrune(element) {
    // 如果元素无效，就返回 null。
    if (!(element instanceof HTMLElement)) {
      // 返回空值。
      return null;
    }

    // 深拷贝当前节点，避免修改真实页面 DOM。
    const clone = element.cloneNode(true);

    // 对克隆结果执行清洗并返回。
    return pruneCloneInPlace(clone);
  }

  // 判断图片是否更像图标或装饰，而不是对话正文的一部分。
  function isLikelyDecorativeImage(image) {
    // 如果图片节点无效，就当作装饰图处理。
    if (!(image instanceof HTMLImageElement)) {
      // 返回真值表示跳过。
      return true;
    }

    // 读取图片的可见尺寸。
    const width = Math.round(image.getBoundingClientRect().width || image.width || image.naturalWidth || 0);

    // 读取图片的可见高度。
    const height = Math.round(image.getBoundingClientRect().height || image.height || image.naturalHeight || 0);

    // 如果图片过小，大概率是图标。
    if (width > 0 && height > 0 && width <= 32 && height <= 32) {
      // 返回真值表示装饰图。
      return true;
    }

    // 读取图片替代文本。
    const alt = (image.getAttribute("alt") || "").toLowerCase();

    // 一些明显的头像或图标文本也跳过。
    if (alt.includes("avatar") || alt.includes("icon") || alt.includes("logo")) {
      // 返回真值表示跳过。
      return true;
    }

    // 否则认为是正文图片。
    return false;
  }

  // 构建图片占位符文本。
  function buildImagePlaceholder(imageId) {
    // 返回形如 [[[CHATGPT_EXPORT_IMAGE:uuid]]] 的占位符。
    return `${IMAGE_PLACEHOLDER_PREFIX}${imageId}${IMAGE_PLACEHOLDER_SUFFIX}`;
  }

  // 识别图片节点并提取图片元数据，同时在克隆节点上写入占位符编号。
  async function collectImagesFromElements(originalRoot, cloneRoot, messageMeta) {
    // 如果任一根节点无效，就直接返回空数组。
    if (!(originalRoot instanceof HTMLElement) || !(cloneRoot instanceof HTMLElement)) {
      // 返回空数组。
      return [];
    }

    // 从原始正文根节点中取出全部图片并过滤掉装饰图。
    const originalImages = [
      ...(originalRoot instanceof HTMLImageElement && !isLikelyDecorativeImage(originalRoot) ? [originalRoot] : []),
      ...Array.from(originalRoot.querySelectorAll("img")).filter((image) => image instanceof HTMLImageElement && !isLikelyDecorativeImage(image))
    ];

    // 从克隆节点中取出全部图片，不再依赖按钮等包装层是否会被后续清洗删除。
    const cloneImages = [
      ...(cloneRoot instanceof HTMLImageElement ? [cloneRoot] : []),
      ...Array.from(cloneRoot.querySelectorAll("img")).filter((image) => image instanceof HTMLImageElement)
    ];

    // 初始化结果数组。
    const images = [];

    // 逐张处理图片，生成可导出元数据。
    for (let index = 0; index < Math.min(originalImages.length, cloneImages.length); index += 1) {
      // 读取原始图片节点。
      const originalImage = originalImages[index];

      // 读取克隆图片节点。
      const cloneImage = cloneImages[index];

      // 生成当前图片的唯一编号。
      const imageId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `image-${Date.now()}-${index}`;

      // 把唯一编号写到克隆图片节点上，后续 Markdown 转换时会输出占位符。
      cloneImage.setAttribute("data-export-image-id", imageId);

      // 读取图片来源地址，优先使用 currentSrc。
      const sourceUrl = originalImage.currentSrc || originalImage.getAttribute("src") || cloneImage.currentSrc || cloneImage.getAttribute("src") || "";

      // 读取图片替代文本。
      const alt = originalImage.getAttribute("alt") || cloneImage.getAttribute("alt") || `图片 ${index + 1}`;

      // 读取原始图片的自然宽度。
      const naturalWidth = Number(originalImage.naturalWidth || cloneImage.naturalWidth || 0);

      // 读取原始图片的自然高度。
      const naturalHeight = Number(originalImage.naturalHeight || cloneImage.naturalHeight || 0);

      // 读取页面中的实际显示宽度。
      const displayWidth = Math.round(originalImage.getBoundingClientRect().width || cloneImage.width || naturalWidth || 0);

      // 读取页面中的实际显示高度。
      const displayHeight = Math.round(originalImage.getBoundingClientRect().height || cloneImage.height || naturalHeight || 0);

      // 如果图片地址是 blob URL 或 data URL，就尝试在页面上下文中把它转成便携 data URL。
      const portableSourceUrl = await getPortableImageSource(originalImage, sourceUrl);

      // 把当前图片元数据压入结果数组。
      images.push({
        // 写入图片唯一编号。
        imageId,
        // 写入图片来源地址。
        sourceUrl,
        // 写入便携数据源。
        portableSourceUrl,
        // 写入替代文本。
        alt,
        // 写入自然宽度。
        naturalWidth,
        // 写入自然高度。
        naturalHeight,
        // 写入显示宽度。
        displayWidth,
        // 写入显示高度。
        displayHeight,
        // 写入当前消息的角色。
        role: messageMeta.role,
        // 写入当前轮次编号占位值，稍后在分组时回填。
        roundIndex: 0,
        // 写入当前消息内部的图片序号。
        imageIndex: index + 1
      });
    }

    // 返回收集完成的图片数组。
    return images;
  }

  // 尝试把 blob/data 形式的图片转换成可跨页面使用的 data URL。
  async function getPortableImageSource(imageElement, sourceUrl) {
    // 如果没有来源地址，就直接返回空字符串。
    if (!sourceUrl) {
      // 返回空字符串。
      return "";
    }

    // 如果原始地址本身已经是 data URL，就直接返回。
    if (sourceUrl.startsWith("data:")) {
      // 返回原始 data URL。
      return sourceUrl;
    }

    // 如果不是 blob URL，就不在内容脚本里强行转码，交给扩展页后续下载。
    if (!sourceUrl.startsWith("blob:")) {
      // 返回空字符串表示无需预处理。
      return "";
    }

    try {
      // 在页面上下文中抓取 blob URL 指向的真实数据。
      const response = await fetch(sourceUrl);

      // 如果响应失败，就返回空字符串。
      if (!response.ok) {
        // 返回空字符串。
        return "";
      }

      // 把响应转成 Blob。
      const blob = await response.blob();

      // 如果 Blob 为空，就返回空字符串。
      if (!blob || blob.size === 0) {
        // 返回空字符串。
        return "";
      }

      // 调用 FileReader 把 Blob 转成 data URL。
      return await blobToDataUrl(blob);
    } catch (_error) {
      // 如果转换失败，就返回空字符串，让后续流程继续尝试原始地址。
      return "";
    }
  }

  // 把 Blob 转成 data URL，方便跨上下文传递。
  function blobToDataUrl(blob) {
    // 返回一个 Promise，等待异步读取完成。
    return new Promise((resolve, reject) => {
      // 创建 FileReader 实例。
      const reader = new FileReader();

      // 绑定读取成功回调。
      reader.onload = () => {
        // 解析结果为字符串。
        resolve(typeof reader.result === "string" ? reader.result : "");
      };

      // 绑定错误回调。
      reader.onerror = () => {
        // 把读取错误抛给调用方。
        reject(new Error("读取图片数据失败。"));
      };

      // 启动读取过程。
      reader.readAsDataURL(blob);
    });
  }

  // 渲染表格为 Markdown 表格。
  function renderTable(tableElement, context) {
    // 收集表格的所有行。
    const rowElements = Array.from(tableElement.querySelectorAll("tr"));

    // 如果没有任何行，就返回空字符串。
    if (rowElements.length === 0) {
      // 返回空结果。
      return "";
    }

    // 把每一行都转成单元格数组。
    const rows = rowElements
      .map((rowElement) => Array.from(rowElement.children).filter((cell) => /^(th|td)$/i.test(cell.tagName)).map((cell) => escapeTableCell(cleanupMarkdown(markdownFromChildren(cell, context)).replace(/\n+/g, " <br> "))))
      .filter((cells) => cells.length > 0);

    // 如果处理后仍然没有有效表格数据，就返回空字符串。
    if (rows.length === 0) {
      // 返回空结果。
      return "";
    }

    // 读取首行作为表头。
    const header = rows[0];

    // 构造表头行。
    const headerLine = `| ${header.join(" | ")} |`;

    // 构造分隔线。
    const separatorLine = `| ${header.map(() => "---").join(" | ")} |`;

    // 构造正文行。
    const bodyLines = rows.slice(1).map((row) => {
      // 如果某一行列数不足，就用空字符串补齐。
      const paddedRow = [...row, ...Array(Math.max(0, header.length - row.length)).fill("")].slice(0, header.length);

      // 返回该行 Markdown 文本。
      return `| ${paddedRow.join(" | ")} |`;
    });

    // 返回完整 Markdown 表格。
    return `\n\n${[headerLine, separatorLine, ...bodyLines].join("\n")}\n\n`;
  }

  // 对表格单元格文本做必要转义。
  function escapeTableCell(text) {
    // 把输入安全转成字符串。
    const safeText = typeof text === "string" ? text : "";

    // 转义竖线，避免破坏表格结构。
    return safeText.replace(/\|/g, "\\|").trim();
  }

  // 渲染 blockquote 为 Markdown 引用块。
  function renderBlockquote(element, context) {
    // 递归渲染引用内部内容。
    const inner = cleanupMarkdown(markdownFromChildren(element, context));

    // 如果没有正文，就返回空字符串。
    if (!inner) {
      // 返回空结果。
      return "";
    }

    // 给每一行加上 Markdown 引用前缀。
    return `\n\n${prefixLines(inner, "> ")}\n\n`;
  }

  // 渲染列表结构为 Markdown 列表。
  function renderList(listElement, context, ordered) {
    // 读取当前列表深度。
    const depth = Number(context.listDepth || 0);

    // 读取当前列表下的直接子项。
    const items = Array.from(listElement.children).filter((child) => child.tagName && child.tagName.toLowerCase() === "li");

    // 如果没有列表项，就返回空字符串。
    if (items.length === 0) {
      // 返回空结果。
      return "";
    }

    // 逐项渲染列表内容。
    const renderedItems = items.map((item, index) => {
      // 提取当前 li 的直接文本与非嵌套列表子节点内容。
      const contentParts = [];

      // 提取当前 li 下嵌套的子列表。
      const nestedLists = [];

      // 遍历 li 的直接子节点，区分正文与嵌套列表。
      Array.from(item.childNodes).forEach((child) => {
        // 如果子节点是 ul/ol，则单独放入嵌套列表数组。
        if (child instanceof HTMLElement && ["ul", "ol"].includes(child.tagName.toLowerCase())) {
          // 记录嵌套列表节点。
          nestedLists.push(child);

          // 结束当前子节点处理。
          return;
        }

        // 把普通子节点递归转成 Markdown 并追加到正文部分。
        contentParts.push(markdownFromNode(child, { ...context, listDepth: depth + 1 }));
      });

      // 清洗当前列表项的正文。
      const mainText = cleanupMarkdown(contentParts.join("")) || "（空项）";

      // 生成当前层级需要的缩进字符串。
      const baseIndent = "  ".repeat(depth);

      // 生成当前项的项目符号前缀。
      const bullet = ordered ? `${index + 1}. ` : "- ";

      // 把主文本逐行转成带前缀的列表行。
      const mainLines = mainText.split("\n").map((line, lineIndex) => {
        // 如果是首行，就带上真正的项目符号。
        if (lineIndex === 0) {
          // 返回首行文本。
          return `${baseIndent}${bullet}${line}`.trimEnd();
        }

        // 后续行用空白缩进对齐。
        return `${baseIndent}${" ".repeat(bullet.length)}${line}`.trimEnd();
      });

      // 渲染所有嵌套列表。
      const nestedText = nestedLists.map((nestedList) => renderList(nestedList, { ...context, listDepth: depth + 1 }, nestedList.tagName.toLowerCase() === "ol")).join("\n");

      // 组合主文本与嵌套列表文本。
      return cleanupMarkdown([mainLines.join("\n"), nestedText].filter(Boolean).join("\n"));
    });

    // 返回整个列表块。
    return `${renderedItems.join("\n")}\n\n`;
  }

  // 判断当前元素是否是真正的数学公式根节点，而不是仅仅“内部包含公式”的普通容器。
  function isMathRootElement(element) {
    // 如果元素无效，就直接返回假值。
    if (!(element instanceof HTMLElement)) {
      // 返回假值。
      return false;
    }

    // 读取小写标签名，便于后续判断。
    const tagName = element.tagName.toLowerCase();

    // KaTeX 的根容器应当被视为真正的公式根节点。
    if (element.classList.contains("katex") || element.classList.contains("katex-display")) {
      // 返回真值。
      return true;
    }

    // 原生 MathML 的 math 根节点也应当直接按公式处理。
    if (tagName === "math") {
      // 返回真值。
      return true;
    }

    // annotation 自己如果承载了 TeX 源码，也属于公式源节点。
    if (tagName === "annotation" && (element.getAttribute("encoding") || "").toLowerCase() === "application/x-tex") {
      // 返回真值。
      return true;
    }

    // 其余普通容器即使内部包含公式，也不应在这一层被整体吞掉。
    return false;
  }

  // 从真正的数学公式根节点中读取 TeX 源码。
  function extractTexFromMathRoot(element) {
    // 如果元素无效，就直接返回空字符串。
    if (!(element instanceof HTMLElement)) {
      // 返回空字符串。
      return "";
    }

    // 如果当前节点自己就是 annotation，就直接读取自身文本。
    if (element.tagName.toLowerCase() === "annotation") {
      // 返回当前 annotation 中的源码文本。
      return normalizeWhitespace(element.textContent || "");
    }

    // 否则在当前公式根节点内部查找 TeX annotation。
    const annotation = element.querySelector("annotation[encoding='application/x-tex']");

    // 返回提取到的源码文本。
    return normalizeWhitespace(annotation ? annotation.textContent || "" : "");
  }

  // 递归把某个节点转成 Markdown。
  function markdownFromNode(node, context = { listDepth: 0 }) {
    // 如果节点为空，就返回空字符串。
    if (!node) {
      // 返回空结果。
      return "";
    }

    // 如果是文本节点，就直接返回文本内容。
    if (node.nodeType === Node.TEXT_NODE) {
      // 返回文本值或空字符串。
      return node.textContent || "";
    }

    // 如果不是元素节点，也不做处理。
    if (node.nodeType !== Node.ELEMENT_NODE) {
      // 返回空结果。
      return "";
    }

    // 把节点断言成 HTMLElement。
    const element = /** @type {HTMLElement} */ (node);

    // 读取小写标签名。
    const tagName = element.tagName.toLowerCase();

    // 只在真正的公式根节点上做数学公式转换，避免把整段正文误吞成单个公式。
    if (isMathRootElement(element)) {
      // 从当前公式根节点中提取 TeX 源码。
      const tex = extractTexFromMathRoot(element);

      // 如果成功拿到 TeX，就输出对应的 Markdown 数学语法。
      if (tex) {
        // 判断当前公式是否属于块级显示。
        const isDisplayMath = element.classList.contains("katex-display") || Boolean(element.closest(".katex-display"));

        // 返回块级或行内数学公式。
        return isDisplayMath ? `\n\n$$\n${tex}\n$$\n\n` : `$${tex}$`;
      }
    }

    // 非 TeX annotation 不应把自身文本直接混进正文里，避免重复。
    if (tagName === "annotation") {
      // 返回空字符串。
      return "";
    }

    // 换行标签直接转为换行符。
    if (tagName === "br") {
      // 返回单个换行。
      return "\n";
    }

    // 水平线转为 Markdown 横线。
    if (tagName === "hr") {
      // 返回横线块。
      return "\n\n---\n\n";
    }

    // 标题标签转换为对应级别的 Markdown 标题。
    if (/^h[1-6]$/.test(tagName)) {
      // 计算标题层级数字。
      const level = Number(tagName.slice(1));

      // 渲染标题内部正文。
      const inner = cleanupMarkdown(markdownFromChildren(element, context));

      // 如果没有正文，就返回空字符串。
      if (!inner) {
        // 返回空结果。
        return "";
      }

      // 返回 Markdown 标题块。
      return `\n\n${"#".repeat(level)} ${inner}\n\n`;
    }

    // 段落标签输出为独立段落。
    if (tagName === "p") {
      // 渲染段落内部内容。
      const inner = cleanupMarkdown(markdownFromChildren(element, context));

      // 如果没有内容，就返回空字符串。
      if (!inner) {
        // 返回空结果。
        return "";
      }

      // 返回段落并补空行。
      return `${inner}\n\n`;
    }

    // 加粗标签转换。
    if (tagName === "strong" || tagName === "b") {
      // 渲染加粗内部文本。
      const inner = cleanupMarkdown(markdownFromChildren(element, context));

      // 返回加粗语法。
      return inner ? `**${inner}**` : "";
    }

    // 斜体标签转换。
    if (tagName === "em" || tagName === "i") {
      // 渲染斜体内部文本。
      const inner = cleanupMarkdown(markdownFromChildren(element, context));

      // 返回斜体语法。
      return inner ? `*${inner}*` : "";
    }

    // 删除线标签转换。
    if (tagName === "s" || tagName === "del") {
      // 渲染删除线内部文本。
      const inner = cleanupMarkdown(markdownFromChildren(element, context));

      // 返回删除线语法。
      return inner ? `~~${inner}~~` : "";
    }

    // 链接标签转换。
    if (tagName === "a") {
      // 如果链接内部只有图片，就直接交给图片占位符输出，不再额外包一层链接语法。
      if (element.querySelector("img") && !normalizeWhitespace(element.textContent || "")) {
        // 直接递归处理子节点。
        return markdownFromChildren(element, context);
      }

      // 渲染链接文字。
      const label = cleanupMarkdown(markdownFromChildren(element, context));

      // 读取 href 地址。
      const href = element.getAttribute("href") || "";

      // 如果没有 href，就退化为普通文本。
      if (!href) {
        // 返回链接文字。
        return label;
      }

      // 使用地址本身作为空标签的回退文本。
      const safeLabel = label || href;

      // 返回 Markdown 链接。
      return `[${safeLabel}](${href})`;
    }

    // 图片标签转换为占位符。
    if (tagName === "img") {
      // 读取已经提前写在图片节点上的导出编号。
      const exportImageId = element.getAttribute("data-export-image-id") || "";

      // 如果拿到了导出编号，就输出占位符。
      if (exportImageId) {
        // 返回图片占位符并独占一行。
        return `\n\n${buildImagePlaceholder(exportImageId)}\n\n`;
      }

      // 否则退回普通的远程图片语法。
      const src = element.getAttribute("src") || "";

      // 读取 alt 文本。
      const alt = element.getAttribute("alt") || "图片";

      // 如果有地址，就输出普通 Markdown 图片语法。
      if (src) {
        // 返回远程图片语法。
        return `![${alt}](${src})`;
      }

      // 否则返回 alt 文本。
      return alt;
    }

    // 代码块转换。
    if (tagName === "pre") {
      // 查找内部 code 节点。
      const code = element.querySelector("code");

      // 尝试从 className 中提取语言名。
      const languageMatch = code ? (code.className || "").match(/language-([\w#+-]+)/i) : null;

      // 读取语言名。
      const language = languageMatch ? languageMatch[1] : "";

      // 读取代码正文。
      const codeText = (code ? code.textContent : element.textContent) || "";

      // 返回 fenced code block。
      return `\n\n\`\`\`${language}\n${codeText.replace(/\r\n/g, "\n")}\n\`\`\`\n\n`;
    }

    // 内联代码转换。
    if (tagName === "code") {
      // 如果父节点是 pre，就交给 pre 处理，这里不重复输出。
      if (element.parentElement && element.parentElement.tagName.toLowerCase() === "pre") {
        // 返回空字符串。
        return "";
      }

      // 读取代码文本。
      const codeText = element.textContent || "";

      // 返回安全包裹后的内联代码。
      return wrapInlineCode(codeText);
    }

    // 无序列表转换。
    if (tagName === "ul") {
      // 递归渲染无序列表。
      return renderList(element, context, false);
    }

    // 有序列表转换。
    if (tagName === "ol") {
      // 递归渲染有序列表。
      return renderList(element, context, true);
    }

    // 引用块转换。
    if (tagName === "blockquote") {
      // 交给 blockquote 渲染器处理。
      return renderBlockquote(element, context);
    }

    // 表格转换。
    if (tagName === "table") {
      // 交给表格渲染器处理。
      return renderTable(element, context);
    }

    // details 退化为普通块内容。
    if (tagName === "details") {
      // 渲染全部子内容。
      const inner = cleanupMarkdown(markdownFromChildren(element, context));

      // 如果没有正文，就返回空字符串。
      if (!inner) {
        // 返回空结果。
        return "";
      }

      // 返回普通块。
      return `${inner}\n\n`;
    }

    // summary 标签加粗显示。
    if (tagName === "summary") {
      // 渲染内部文本。
      const inner = cleanupMarkdown(markdownFromChildren(element, context));

      // 返回加粗文本。
      return inner ? `**${inner}**\n\n` : "";
    }

    // figure 与 figcaption 按普通容器处理即可，保持顺序。
    if (tagName === "figure" || tagName === "figcaption") {
      // 递归处理子节点。
      return markdownFromChildren(element, context);
    }

    // 列表项单独出现时，退化为普通内容。
    if (tagName === "li") {
      // 返回它的内部内容。
      return markdownFromChildren(element, context);
    }

    // 常见容器标签默认递归处理子节点。
    if (["div", "section", "article", "main", "span", "tbody", "thead", "tr", "th", "td", "sup", "sub", "kbd", "picture"].includes(tagName)) {
      // 递归处理全部子节点。
      return markdownFromChildren(element, context);
    }

    // 其他未知标签也统一递归处理其子节点。
    return markdownFromChildren(element, context);
  }

  // 把一个元素的全部子节点串联渲染成 Markdown。
  function markdownFromChildren(element, context) {
    // 依次递归处理所有子节点并拼接结果。
    return Array.from(element.childNodes).map((child) => markdownFromNode(child, context)).join("");
  }

  // 清理图片占位符与远程图片语法，避免它们污染纯文本摘要与标题。
  function stripImageArtifacts(text) {
    // 把输入安全转成字符串。
    const safeText = typeof text === "string" ? text : "";

    // 先移除内部导出图片占位符。
    const withoutPlaceholders = safeText.replace(/\[\[\[CHATGPT_EXPORT_IMAGE:[^\]]+\]\]\]/g, "");

    // 再移除普通 Markdown 图片语法。
    const withoutMarkdownImages = withoutPlaceholders.replace(/!\[[^\]]*\]\([^\)]+\)/g, "");

    // 返回清理后的纯文本。
    return normalizeWhitespace(withoutMarkdownImages);
  }

  // 把正文元素转换成 Markdown，并附带图片清单。
  async function elementToMarkdown(element, messageMeta) {
    // 如果正文元素无效，就直接返回空结果。
    if (!(element instanceof HTMLElement)) {
      // 返回空 Markdown 与空图片数组。
      return {
        markdown: "",
        images: []
      };
    }

    // 先深拷贝正文节点，但暂时不做清洗，避免把包住图片的按钮一并删掉。
    const clone = element.cloneNode(true);

    // 如果克隆失败，就返回空结果。
    if (!(clone instanceof HTMLElement)) {
      // 返回空 Markdown 与空图片数组。
      return {
        markdown: "",
        images: []
      };
    }

    // 先收集图片并给克隆节点打上占位符标记。
    const images = await collectImagesFromElements(element, clone, messageMeta);

    // 在图片已经标记好以后，再执行正文清洗。
    pruneCloneInPlace(clone);

    // 递归把克隆节点转成 Markdown 文本。
    const markdown = markdownFromChildren(clone, { listDepth: 0 });

    // 返回清洗后的 Markdown 与图片数组。
    return {
      markdown: cleanupMarkdown(markdown),
      images
    };
  }

  // 从候选消息节点中提取结构化消息记录。
  async function extractMessagesFromCandidates(candidates) {
    // 初始化结果数组。
    const messages = [];

    // 初始化交替回退角色，默认第一条更可能是 user。
    let alternatingFallbackRole = "user";

    // 逐个遍历候选消息节点。
    for (const candidate of candidates) {
      // 猜测当前节点角色。
      const role = guessRoleFromElement(candidate, alternatingFallbackRole);

      // 如果角色不在支持集合中，就跳过当前节点。
      if (!SUPPORTED_ROLES.has(role)) {
        // 继续下一轮循环。
        continue;
      }

      // 寻找最适合作为正文根节点的元素。
      const contentRoot = findBestContentRoot(candidate) || candidate;

      // 把正文根节点转换成 Markdown 与图片信息。
      const converted = await elementToMarkdown(contentRoot, { role });

      // 如果 Markdown 为空并且图片也为空，就跳过。
      if (!converted.markdown && converted.images.length === 0) {
        // 继续处理下一个候选节点。
        continue;
      }

      // 优先从真实 DOM 读取纯文本摘要，避免图片占位符混入标题。
      const plainTextFromDom = normalizeWhitespace(contentRoot.innerText || contentRoot.textContent || "");

      // 如果 DOM 文本为空，再退回到清理过图片占位符的 Markdown 文本。
      const plainTextFromMarkdown = stripImageArtifacts(converted.markdown || "");

      // 最终纯文本优先使用 DOM 文本，其次才使用清洗后的 Markdown 文本。
      const plainText = plainTextFromDom || plainTextFromMarkdown;

      // 把结构化消息推入结果数组。
      messages.push({
        // 写入角色。
        role,
        // 写入 Markdown 正文。
        markdown: converted.markdown,
        // 写入纯文本摘要。
        plainText,
        // 写入图片数组。
        images: converted.images,
        // 写入来源索引，方便后续调试。
        sourceIndex: messages.length
      });

      // 更新交替回退角色。
      alternatingFallbackRole = role === "user" ? "assistant" : "user";
    }

    // 返回提取结果。
    return messages;
  }

  // 按“用户问题 + 后续回复”把底层消息折叠成轮次。
  function groupMessagesIntoRounds(messages) {
    // 初始化轮次数组。
    const rounds = [];

    // 初始化当前正在构建的轮次对象。
    let currentRound = null;

    // 遍历所有消息。
    messages.forEach((message) => {
      // 如果当前消息是 user，就启动一轮新对话。
      if (message.role === "user") {
        // 如果上一轮已经存在，就先把它保存起来。
        if (currentRound) {
          // 保存上一轮。
          rounds.push(currentRound);
        }

        // 创建新的轮次对象。
        currentRound = {
          // 轮次编号先占位，稍后统一回填。
          roundIndex: 0,
          // 标题优先取当前问题的纯文本摘要；如果这一轮主要是图片，则给一个更友好的保底标题。
          title: makeTitlePreview(message.plainText || (Array.isArray(message.images) && message.images.length > 0 ? "图片提问" : message.markdown)),
          // 保存问题 Markdown。
          promptMarkdown: message.markdown,
          // 保存问题纯文本；纯图片轮次时写入更易读的保底文本。
          promptText: message.plainText || (Array.isArray(message.images) && message.images.length > 0 ? "（本轮用户主要发送了图片，没有可提取的文字提问。）" : message.markdown),
          // 保存问题图片数组。
          promptImages: Array.isArray(message.images) ? message.images : [],
          // 初始化回复消息数组。
          responseMessages: []
        };

        // 当前 user 消息处理完成，进入下一条。
        return;
      }

      // 如果还没遇到 user 就先遇到了其他角色，就创建一个隐式轮次，避免内容丢失。
      if (!currentRound) {
        // 创建保底轮次。
        currentRound = {
          // 轮次编号稍后统一补。
          roundIndex: 0,
          // 给一个保底标题。
          title: "未能识别的起始轮次",
          // 保底提问内容。
          promptMarkdown: "未能从页面中稳定识别到这一轮的用户提问。",
          // 保底提问纯文本。
          promptText: "未能从页面中稳定识别到这一轮的用户提问。",
          // 保底提问图片数组。
          promptImages: [],
          // 初始化回复数组。
          responseMessages: []
        };
      }

      // 把 assistant、tool、system 等后续消息加入当前轮次的回复里。
      currentRound.responseMessages.push(message);
    });

    // 循环结束后，把最后一轮也补进去。
    if (currentRound) {
      // 保存最后一轮。
      rounds.push(currentRound);
    }

    // 把轮次统一补编号，并合并回复文本与回复图片。
    return rounds.map((round, index) => {
      // 合并全部回复 Markdown，并在多段之间插入分隔线。
      const responseMarkdown = round.responseMessages.map((item) => item.markdown).filter(Boolean).join("\n\n---\n\n");

      // 合并全部回复纯文本摘要。
      const responseText = round.responseMessages.map((item) => item.plainText).filter(Boolean).join(" ");

      // 合并全部回复图片数组。
      const responseImages = round.responseMessages.flatMap((item) => Array.isArray(item.images) ? item.images : []);

      // 计算当前轮次编号。
      const roundIndex = index + 1;

      // 把当前轮次下的所有图片都写上真实轮次编号。
      [...round.promptImages, ...responseImages].forEach((image) => {
        // 回填当前图片所属轮次编号。
        image.roundIndex = roundIndex;
      });

      // 返回补齐后的轮次对象。
      return {
        // 写入轮次编号。
        roundIndex,
        // 写入轮次标题。
        title: round.title || `第 ${roundIndex} 轮`,
        // 写入问题 Markdown。
        promptMarkdown: round.promptMarkdown,
        // 写入问题纯文本。
        promptText: round.promptText,
        // 写入提问图片数组。
        promptImages: round.promptImages,
        // 写入回答 Markdown。
        responseMarkdown,
        // 写入回答纯文本。
        responseText,
        // 写入回答图片数组。
        responseImages,
        // 写入底层回复消息数量。
        responseMessageCount: round.responseMessages.length
      };
    });
  }

  // 把平台默认页标题收敛成更适合导出的最终标题。
  function normalizeConversationTitle(title, rounds) {
    // 先读取当前平台展示名。
    const providerDisplayName = getProviderDisplayName(CURRENT_PROVIDER);

    // 先压缩输入标题中的多余空白。
    const normalizedTitle = normalizeWhitespace(title || "");

    // 定义一组应当视为“平台默认标题”的保底文本。
    const genericTitles = new Set(["chatgpt", "gemini", "new chat", "new conversation", "新聊天", "新对话"]);

    // 如果当前标题既存在、又不是平台默认标题，就直接保留它。
    if (normalizedTitle && !genericTitles.has(normalizedTitle.toLowerCase())) {
      // 返回当前标题。
      return normalizedTitle;
    }

    // 否则优先退回到第一轮用户提问生成的标题。
    const firstRoundTitle = Array.isArray(rounds) && rounds[0] ? normalizeWhitespace(rounds[0].title || "") : "";

    // 如果第一轮标题存在，就返回它。
    if (firstRoundTitle) {
      // 返回首轮标题。
      return firstRoundTitle;
    }

    // 最后再退回到“平台名 + 对话”这种更明确的兜底标题。
    return providerDisplayName === "AI 对话" ? "未命名对话" : `${providerDisplayName} 对话`;
  }

  // 提取当前页面的完整对话结构。
  async function extractConversation() {
    // 动态页面先等待一个很短的稳定窗口，降低“刚切到页面就提取不全”的概率。
    await waitForConversationDomToSettle();

    // 获取候选消息节点。
    const candidates = getMessageCandidates();

    // 把候选节点提取成结构化消息。
    const messages = await extractMessagesFromCandidates(candidates);

    // 把消息折叠成轮次结构。
    const rounds = groupMessagesIntoRounds(messages);

    // 根据页面与首轮内容生成更稳定的对话标题。
    const normalizedTitle = normalizeConversationTitle(getConversationTitle(), rounds);

    // 返回完整对话对象。
    return {
      // 写入当前对话来源平台。
      provider: CURRENT_PROVIDER,
      // 写入更适合展示的来源平台名称。
      providerDisplayName: getProviderDisplayName(CURRENT_PROVIDER),
      // 写入对话标题。
      title: normalizedTitle,
      // 写入会话编号。
      conversationId: getConversationId(),
      // 写入源页面地址。
      sourceUrl: window.location.href,
      // 写入提取时间。
      extractedAt: new Date().toISOString(),
      // 写入底层消息数组。
      messages,
      // 写入轮次数组。
      rounds
    };
  }

  // 监听扩展页发来的消息请求。
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // 如果不是约定好的提取请求类型，就直接忽略。
    if (!message || message.type !== "EXPORTER_EXTRACT_CONVERSATION") {
      // 返回 undefined 表示不处理。
      return undefined;
    }

    // 异步执行提取逻辑，并把结果回传给扩展页。
    void (async () => {
      try {
        // 执行对话提取。
        const conversation = await extractConversation();

        // 如果一轮都没有识别出来，就返回错误响应。
        if (!conversation.rounds.length) {
          // 回传失败结果。
          sendResponse({
            ok: false,
            error: "没有从当前页面提取到可导出的轮次。请先打开具体对话，再尝试刷新页面后导出。"
          });

          // 结束异步函数。
          return;
        }

        // 回传成功结果。
        sendResponse({
          ok: true,
          conversation
        });
      } catch (error) {
        // 把未知错误转换成可展示文本。
        const errorMessage = error instanceof Error ? error.message : "提取当前对话时发生未知错误。";

        // 回传失败结果。
        sendResponse({
          ok: false,
          error: errorMessage
        });
      }
    })();

    // 返回 true，表示会异步调用 sendResponse。
    return true;
  });
})();
