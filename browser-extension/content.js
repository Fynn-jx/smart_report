// Content Script - 文献助手 PDF 检测
console.log('📚 文献助手已加载');

// 防止重复初始化
if (window.__literatureHelperInitialized) {
  console.log('📚 已初始化，跳过');
} else {
  window.__literatureHelperInitialized = true;

  const DOWNLOAD_TEXTS = ['下载', 'download', '导出', 'export', '保存', 'save', 'pdf', '全文', 'full text'];

  // 简化版检测函数 - 只检测真正的PDF
  function detectPDFs() {
    const results = [];
    const seen = new Set();
    try {
      // 只检查前100个链接
      const links = document.querySelectorAll('a[href]');
      const limit = Math.min(links.length, 100);

      for (let i = 0; i < limit; i++) {
        try {
          const link = links[i];
          const href = link.href;
          if (!href || seen.has(href)) continue;

          // 只检测以.pdf结尾的链接
          if (href.toLowerCase().endsWith('.pdf')) {
            seen.add(href);
            results.push({ url: href, title: link.textContent.trim() || link.title || href.split('/').pop(), type: 'PDF链接', confidence: 'high' });
            markElement(link);
          }
        } catch (e) { continue; }
      }

      return results;

    } catch (error) {
      console.error('📚 检测出错:', error);
      return [];
    }
  }

  // 标记元素
  function markElement(el) {
    try {
      if (!el.hasAttribute('data-literature-marked')) {
        el.style.outline = '2px solid #667eea';
        el.style.outlineOffset = '2px';
        el.setAttribute('data-literature-marked', 'true');
      }
    } catch (e) {}
  }

  // 初始化检测 - 只运行一次，不持续监听
  setTimeout(detectPDFs, 500);

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getMarkedLinks') {
      // 获取已标记的链接
      const marked = document.querySelectorAll('[data-literature-marked]');
      const links = [];

      marked.forEach(el => {
        const href = el.href || el.getAttribute('data-url') || el.getAttribute('data-pdf');
        if (href) {
          const title = el.textContent.trim() || el.title || href.split('/').pop();
          links.push({
            url: href,
            title: title,
            type: 'PDF链接',
            confidence: 'high'
          });
        }
      });

      sendResponse({ links: links });
    }
    return true;
  });

  console.log('📚 文献助手已启动');
}
