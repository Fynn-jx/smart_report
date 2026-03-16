// Content Script - 文献助手 PDF 检测
(function() {
  // 防止重复初始化
  if (window.__literatureHelperInitialized) return;
  window.__literatureHelperInitialized = true;

  // 检查扩展是否可用
  function isExtensionAvailable() {
    try {
      return chrome && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  // 如果扩展不可用，静默退出
  if (!isExtensionAvailable()) {
    return;
  }

  console.log('📚 文献助手已加载');

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

  // 监听来自popup的消息 - 添加错误处理
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      try {
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
      } catch (e) {
        // 静默处理错误
      }
      return true;
    });
  }

  console.log('📚 文献助手已启动');
})();
