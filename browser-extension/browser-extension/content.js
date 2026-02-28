// Content Script - 在网页中运行
// 用于检测和标记 PDF 链接和下载按钮

console.log('📚 文献助手已加载');

// 防止重复加载
if (window.__literatureHelperLoaded) {
  console.log('📚 文献助手已加载，跳过重复初始化');
} else {
  window.__literatureHelperLoaded = true;

  // PDF相关关键词
  const PDF_KEYWORDS = [
    'pdf', '.pdf', 'download', '下载', 'downloader',
    'export', '导出', 'save', '保存', 'getpdf'
  ];

  // 下载相关文本
  const DOWNLOAD_TEXTS = [
    '下载', 'download', '导出', 'export',
    '保存', 'save', '获取', 'get',
    'pdf', '全文', 'full text', 'paper'
  ];

  // 检测页面中的 PDF 链接
  function detectPDFLinks() {
    const results = {
      directLinks: [],    // 直接PDF链接
      likelyButtons: [],  // 可能的下载按钮
      forms: []          // 下载表单
    };

    try {
      // 1. 检测所有链接
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent.trim().toLowerCase();

        if (href) {
          // 直接PDF链接
          if (href.includes('.pdf') || href.toLowerCase().includes('pdf')) {
            results.directLinks.push({
              type: 'link',
              element: link,
              url: href,
              title: link.textContent.trim() || link.title || href.split('/').pop(),
              confidence: 'high'
            });
            markElement(link, '📚 PDF链接');
          }
          // 下载链接
          else if (href.includes('download') || DOWNLOAD_TEXTS.some(t => text.includes(t))) {
            results.likelyButtons.push({
              type: 'download-link',
              element: link,
              url: href,
              title: link.textContent.trim() || link.title || href.split('/').pop(),
              confidence: 'medium'
            });
            markElement(link, '⬇️ 可能的下载');
          }
        }
      });

      // 2. 检测按钮和可点击元素
      document.querySelectorAll('button, [role="button"], .btn, .button').forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();

        // 检查是否包含下载相关文本
        if (DOWNLOAD_TEXTS.some(t => text.includes(t))) {
          // 尝试从多个来源获取URL
          const url = extractURLFromElement(btn);

          results.likelyButtons.push({
            type: 'button',
            element: btn,
            url: url,
            title: btn.textContent.trim() || '下载按钮',
            confidence: url ? 'medium' : 'low'
          });

          if (url) {
            markElement(btn, '🔗 下载按钮');
          } else {
            markElement(btn, '⚠️ 下载按钮(需点击)');
          }
        }
      });

      // 3. 检测iframe中的PDF
      document.querySelectorAll('iframe[src]').forEach(iframe => {
        const src = iframe.getAttribute('src');
        if (src && src.includes('.pdf')) {
          results.directLinks.push({
            type: 'iframe',
            element: iframe,
            url: src,
            title: iframe.title || '嵌入的PDF',
            confidence: 'high'
          });
          markElement(iframe, '📄 嵌入PDF');
        }
      });

      // 4. 检测object和embed标签（PDF查看器）
      document.querySelectorAll('object[data], embed[src]').forEach(obj => {
        const url = obj.getAttribute('data') || obj.getAttribute('src');
        if (url && url.includes('.pdf')) {
          results.directLinks.push({
            type: 'object',
            element: obj,
            url: url,
            title: '嵌入的PDF对象',
            confidence: 'high'
          });
          markElement(obj, '📄 PDF对象');
        }
      });

      // 5. 检测表单
      document.querySelectorAll('form').forEach(form => {
        const action = form.getAttribute('action');
        const text = form.textContent.trim().toLowerCase();

        if (action && (action.includes('download') || action.includes('pdf'))) {
          results.forms.push({
            type: 'form',
            element: form,
            url: action,
            title: '下载表单',
            confidence: 'medium'
          });
          markElement(form, '📋 下载表单');
        }
      });

      // 6. 检测data-*属性中可能包含PDF URL的元素
      document.querySelectorAll('[data-url], [data-pdf], [data-file], [data-download]').forEach(el => {
        const url = el.getAttribute('data-url') ||
                    el.getAttribute('data-pdf') ||
                    el.getAttribute('data-file') ||
                    el.getAttribute('data-download');

        if (url && (url.includes('.pdf') || url.toLowerCase().includes('pdf'))) {
          results.directLinks.push({
            type: 'data-attr',
            element: el,
            url: url,
            title: el.textContent.trim() || el.title || 'PDF链接',
            confidence: 'high'
          });
          markElement(el, '📎 数据属性PDF');
        }
      });

    } catch (error) {
      console.error('📚 检测过程中出错:', error);
    }

    console.log('📚 检测结果:', {
      直接链接: results.directLinks.length,
      可能按钮: results.likelyButtons.length,
      表单: results.forms.length
    });

    return results;
  }

  // 从元素中提取URL
  function extractURLFromElement(element) {
    try {
      // 检查onclick属性
      const onclick = element.getAttribute('onclick') || element.onclick;
      if (onclick) {
        // 尝试从onclick中提取URL
        const urlMatch = onclick.toString().match(/['"]([^'"]*\.(pdf|pdf\?[^'"]*)|download[^'"]*)['"]/i);
        if (urlMatch) return urlMatch[1];
      }

      // 检查data-*属性
      const dataUrl = element.getAttribute('data-url') ||
                      element.getAttribute('data-href') ||
                      element.getAttribute('data-link') ||
                      element.getAttribute('data-pdf');
      if (dataUrl) return dataUrl;

      // 检查父元素的链接
      const parentLink = element.closest('a');
      if (parentLink && parentLink.href) {
        return parentLink.href;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // 标记元素
  function markElement(element, label) {
    try {
      element.style.outline = '2px solid #667eea';
      element.style.outlineOffset = '2px';
      element.style.boxShadow = '0 0 10px rgba(102, 126, 234, 0.3)';

      // 添加tooltip
      const existingTitle = element.title || '';
      element.title = `${label} ${existingTitle ? '- ' + existingTitle : ''}`;
    } catch (error) {
      // 忽略标记错误
    }
  }

  // 页面加载完成后检测
  function initializeDetection() {
    setTimeout(() => {
      try {
        detectPDFLinks();
      } catch (error) {
        console.error('📚 初始化检测失败:', error);
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDetection);
  } else {
    initializeDetection();
  }

  // 监听来自 popup 的消息
  // 使用一次性监听器避免重复
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 只处理我们关心的消息
    if (request.action === 'detectPDFs') {
      try {
        const results = detectPDFLinks();

        // 返回所有检测到的结果
        const allResults = [
          ...results.directLinks.map(r => ({
            url: r.url,
            title: r.title,
            type: r.type,
            confidence: r.confidence
          })),
          ...results.likelyButtons.map(r => ({
            url: r.url || window.location.href,
            title: r.title,
            type: r.type,
            confidence: r.confidence,
            needsClick: !r.url
          })),
          ...results.forms.map(r => ({
            url: r.url,
            title: r.title,
            type: r.type,
            confidence: r.confidence
          }))
        ];

        // 同步返回结果
        sendResponse({
          count: allResults.length,
          results: allResults,
          details: results
        });
      } catch (error) {
        console.error('📚 处理检测消息时出错:', error);
        sendResponse({
          count: 0,
          results: [],
          details: { directLinks: [], likelyButtons: [], forms: [] },
          error: error.message
        });
      }
      // 返回true表示我们可能异步发送响应
      return true;
    }
    // 其他消息不处理，返回false关闭通道
    return false;
  });

  // 监听页面变化（动态加载的内容）
  let observerTimer = null;
  const observer = new MutationObserver((mutations) => {
    // 防抖，避免频繁检测
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      try {
        detectPDFLinks();
      } catch (error) {
        console.error('📚 自动检测出错:', error);
      }
    }, 1000);
  });

  // 等待DOM准备完成
  function startObserver() {
    try {
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    } catch (error) {
      console.error('📚 启动监听器失败:', error);
    }
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }

  console.log('📚 文献助手PDF检测已启动');
}
