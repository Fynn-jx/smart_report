// Content Script - 文献助手 PDF 检测
console.log('📚 文献助手已加载');

// 防止重复初始化
if (window.__literatureHelperInitialized) {
  console.log('📚 已初始化，跳过');
} else {
  window.__literatureHelperInitialized = true;

  const DOWNLOAD_TEXTS = ['下载', 'download', '导出', 'export', '保存', 'save', 'pdf', '全文', 'full text'];

  // 检测PDF链接
  function detectPDFs() {
    const results = [];
    try {
      // 检测链接
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.href;
        const text = link.textContent.trim().toLowerCase();

        if (href) {
          if (href.includes('.pdf') || href.toLowerCase().includes('pdf')) {
            results.push({ url: href, title: link.textContent.trim() || link.title || href.split('/').pop(), type: 'PDF链接', confidence: 'high' });
            markElement(link);
          } else if (href.includes('download') || DOWNLOAD_TEXTS.some(t => text.includes(t))) {
            results.push({ url: href, title: link.textContent.trim() || '下载链接', type: '下载链接', confidence: 'medium' });
            markElement(link);
          }
        }
      });

      // 检测按钮
      document.querySelectorAll('button, [role="button"], .btn, .button').forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        if (DOWNLOAD_TEXTS.some(t => text.includes(t))) {
          let url = btn.getAttribute('data-url') || btn.getAttribute('data-href') || btn.getAttribute('data-pdf');
          if (!url && btn.onclick) {
            const match = btn.onclick.toString().match(/['"]([^'"]*\.(pdf|download[^'"]*))['"]/i);
            if (match) url = match[1];
          }
          if (!url) {
            const parent = btn.closest('a');
            if (parent) url = parent.href;
          }
          results.push({
            url: url || window.location.href,
            title: btn.textContent.trim() || '下载按钮',
            type: url ? '下载按钮' : '下载按钮(需点击)',
            confidence: url ? 'medium' : 'low',
            needsClick: !url
          });
          if (url) markElement(btn);
        }
      });

      // 检测iframe
      document.querySelectorAll('iframe[src]').forEach(iframe => {
        const src = iframe.src;
        if (src && src.includes('.pdf')) {
          results.push({ url: src, title: '嵌入的PDF', type: '嵌入PDF', confidence: 'high' });
          markElement(iframe);
        }
      });

      // 去重
      const seen = new Set();
      return results.filter(r => r.url && !seen.has(r.url) && seen.add(r.url));

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

  // 初始化检测
  setTimeout(detectPDFs, 500);

  // 监听DOM变化
  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(detectPDFs, 800);
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

  console.log('📚 文献助手已启动');

  // 注意：不需要消息监听器，因为popup.js使用executeScript直接注入检测代码
  // 这样可以避免"The message port closed"错误
}
