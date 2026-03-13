// 配置
const API_BASE_URL = 'http://localhost:5000';

// 全局状态
let savedDocs = [];
let detectedResults = [];
let selectedResult = null;

// 获取 PDF 元数据（从 PDF 文件中提取标题）
async function getPDFMetadata(url) {
  try {
    console.log('开始获取PDF元数据:', url);

    // 直接获取整个响应（PDF 通常不大）
    const response = await fetch(url);

    if (!response.ok) {
      console.log('获取PDF失败:', response.status);
      return null;
    }

    // 只读取前 64KB
    const blob = await response.blob();
    const slice = blob.slice(0, 65536);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    console.log('PDF数据长度:', bytes.length);

    // 将 bytes 转换为文本（只取可见字符）
    let text = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] >= 32 && bytes[i] < 127) {
        text += String.fromCharCode(bytes[i]);
      } else if (bytes[i] >= 192) {
        // 尝试读取 UTF-8 多字节字符
        if ((bytes[i] & 0xE0) === 0xC0 && i + 1 < bytes.length) {
          text += String.fromCharCode((bytes[i] << 6) | (bytes[i+1] & 0x3F));
          i++;
        } else if ((bytes[i] & 0xF0) === 0xE0 && i + 2 < bytes.length) {
          text += String.fromCharCode((bytes[i] << 12) | ((bytes[i+1] & 0x3F) << 6) | (bytes[i+2] & 0x3F));
          i += 2;
        }
      }
    }

    console.log('提取文本长度:', text.length);

    // 方法1: 查找 /Title (xxx) 格式
    const titleMatch = text.match(/\/Title\s*\(([^)]+)\)/);
    if (titleMatch && titleMatch[1] && titleMatch[1].length > 1) {
      const title = titleMatch[1].replace(/\\n/g, ' ').replace(/\\/g, '').trim();
      if (title.length > 1 && title.length < 200) {
        console.log('找到标题(方法1):', title);
        return title;
      }
    }

    // 方法2: 查找 <dc:title>
    const dcTitleMatch = text.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (dcTitleMatch && dcTitleMatch[1]) {
      const title = dcTitleMatch[1].trim();
      if (title.length > 1 && title.length < 200) {
        console.log('找到标题(方法2):', title);
        return title;
      }
    }

    // 方法3: 查找 <xmp:Title>
    const xmlTitleMatch = text.match(/<xmp:Title[^>]*>([^<]+)<\/xmp:Title>/i);
    if (xmlTitleMatch && xmlTitleMatch[1]) {
      const title = xmlTitleMatch[1].trim();
      if (title.length > 1 && title.length < 200) {
        console.log('找到标题(方法3):', title);
        return title;
      }
    }

    console.log('未找到PDF标题');
    return null;
  } catch (e) {
    console.log('获取PDF元数据失败:', e);
    return null;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await checkCurrentTab();
  setupEventListeners();
  loadSavedDocs();
});

// 检查当前标签页
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      showStatus('no-pdf', '无法访问当前页面');
      return;
    }

    // 检查是否本身就是 PDF
    if (tab.url && (tab.url.includes('.pdf') || tab.url.toLowerCase().includes('pdf'))) {
      selectResult({
        url: tab.url,
        title: document.title || tab.url.split('/').pop(),
        type: 'current-page',
        confidence: 'high'
      });
      return;
    }

    // 使用消息传递方式获取已标记的链接，如果失败则使用备选方案
    let links = [];
    try {
      // 发送消息给content.js请求已标记的链接
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { action: 'getMarkedLinks' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('超时')), 2000))
      ]);

      if (response && response.links) {
        links = response.links;
      }
    } catch (e) {
      console.warn('消息传递失败，使用备选方案:', e.message);
    }

    // 如果消息传递没获取到链接，使用备选方案直接检测
    if (links.length === 0) {
      try {
        // 给 executeScript 添加 3 秒超时
        const injectionResults = await Promise.race([
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const results = [];
              const seen = new Set();
              const links = document.querySelectorAll('a[href]');
              const limit = Math.min(links.length, 100);

              for (let i = 0; i < limit; i++) {
                try {
                  const link = links[i];
                  const href = link.href;
                  if (!href || seen.has(href)) continue;

                  if (href.toLowerCase().endsWith('.pdf')) {
                    seen.add(href);
                    results.push({
                      url: href,
                      title: link.textContent.trim() || link.title || href.split('/').pop(),
                      type: 'PDF链接',
                      confidence: 'high'
                    });
                  }
                } catch (e) { continue; }
              }
              return results;
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('executeScript超时')), 3000))
        ]);
        links = injectionResults?.[0]?.result || [];
        console.log('备选方案检测到:', links.length, '个链接');
      } catch (e2) {
        console.warn('备选方案也失败:', e2.message);
      }
    }

    if (links.length > 0) {
      showResults(links);
    } else {
      showStatus('no-pdf', '请在下方手动输入PDF链接');
    }
  } catch (error) {
    console.error('检测失败:', error);
    showStatus('no-pdf', '检测失败，请刷新页面重试');
  }
}

// 检测页面中的 PDF 链接
async function detectPDFs(tabId) {
  try {
    // 短暂等待页面加载
    await new Promise(resolve => setTimeout(resolve, 300));

    // 超简化版检测函数 - 只检测真正的PDF文件
    const quickDetectFunc = () => {
      const results = [];
      const seen = new Set();

      // 检查前100个链接
      const links = document.querySelectorAll('a[href]');
      const linkLimit = Math.min(links.length, 100);

      for (let i = 0; i < linkLimit; i++) {
        const link = links[i];
        try {
          const href = link.href;
          if (!href || seen.has(href)) continue;

          // 只检测以.pdf结尾的链接，或者URL包含.pdf且是文件下载类型
          const hrefLower = href.toLowerCase();
          const isPDF = hrefLower.endsWith('.pdf') ||
                       (hrefLower.includes('.pdf') && (hrefLower.includes('/download/') || hrefLower.includes('download=')));

          if (isPDF) {
            seen.add(href);
            // 获取更干净的标题
            let title = link.textContent.trim() || link.title || '';
            if (!title || title.length < 3) {
              // 从URL提取标题
              title = href.split('/').pop().split('?')[0] || 'PDF文档';
            }
            results.push({
              url: href,
              title: title,
              type: 'PDF文档',
              confidence: 'high'
            });
          }
        } catch (e) { continue; }
      }

      return results.slice(0, 20);
    };

    // 使用executeScript在目标页面执行检测函数
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: quickDetectFunc
    });

    // executeScript返回一个数组，每个元素都有result属性
    const results = injectionResults?.[0]?.result || [];
    detectedResults = results;
    return results;

  } catch (error) {
    console.error('检测PDF失败:', error);

    // 检查是否是超时或连接错误，提供友好的错误提示
    const errorMessage = error.message || '';
    if (errorMessage.includes('Could not establish connection') ||
        errorMessage.includes('No tab with id') ||
        errorMessage.includes('Extensions cannot') ||
        errorMessage.includes('executeScript')) {
      showStatus('no-pdf', '⚠️ 页面检测受限，请尝试：\n1. 刷新页面后重试\n2. 使用手动输入链接功能');
    } else {
      // 如果executeScript失败，返回空数组
      return [];
    }
  }
}

// 直接显示手动输入模式（解决部分网站超时问题）
function showManualInputMode() {
  const resultsSection = document.getElementById('resultsSection');
  const manualInput = document.getElementById('manualInput');

  resultsSection.style.display = 'block';
  manualInput.style.display = 'block';

  showStatus('no-pdf', '请手动输入PDF链接');
}

// 显示检测结果
function showResults(results) {
  const resultsSection = document.getElementById('resultsSection');
  const resultsList = document.getElementById('resultsList');

  // 显示结果区域
  resultsSection.style.display = 'block';

  console.log('showResults 收到:', results.length, '个结果', results);

  // 无论有几个结果，都显示列表让用户选择
  const message = results.length >= 5
    ? `检测到 ${results.length} 个可能的文档，请选择`
    : `检测到 ${results.length} 个文档，请选择`;

  showStatus('has-multiple', message);

  resultsList.innerHTML = results.map((result, index) => `
    <div class="result-item" data-index="${index}">
      <div class="result-title">
        <span>${result.type === 'PDF链接' ? '📄' : result.type === '下载按钮' ? '⬇️' : '🔗'}</span>
        <span>${escapeHtml(result.title)}</span>
      </div>
      ${result.url && result.url !== window.location.href ? `
        <div class="result-url">${escapeHtml(truncateUrl(result.url))}</div>
      ` : ''}
      <div class="result-meta">
        <span class="badge badge-${result.confidence}">${getConfidenceText(result.confidence)}</span>
        <span>${result.type}</span>
        ${result.needsClick ? '<span style="color: #dc2626;">⚠️ 需手动点击</span>' : ''}
      </div>
    </div>
  `).join('');

  // 添加点击事件
  resultsList.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      console.log('点击了第', index, '个结果:', results[index]);
      selectResult(results[index]);
    });
  });
}

// 选择结果
function selectResult(result) {
  selectedResult = result;

  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('content').style.display = 'block';

  showStatus('has-pdf', '已选择文档');

  document.getElementById('docTitle').value = result.title;
  document.getElementById('docUrl').value = result.url || '（需要手动点击网页上的下载按钮获取链接）';

  // 显示警告
  const warning = document.getElementById('needsClickWarning');
  if (result.needsClick || !result.url) {
    warning.style.display = 'block';
  } else {
    warning.style.display = 'none';
  }

  // 自动选中标题文本
  document.getElementById('docTitle').select();
}

// 显示状态
function showStatus(type, message) {
  const statusEl = document.getElementById('status');
  const contentEl = document.getElementById('content');

  statusEl.className = `status ${type}`;
  statusEl.innerHTML = message;

  if (type !== 'has-pdf') {
    contentEl.style.display = 'none';
  }
}

// 设置事件监听
function setupEventListeners() {
  // 保存按钮
  document.getElementById('saveBtn').addEventListener('click', saveToLibrary);

  // 下载按钮
  document.getElementById('downloadBtn').addEventListener('click', downloadToLocal);

  // 返回按钮
  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('content').style.display = 'none';
    if (detectedResults.length > 1) {
      document.getElementById('resultsSection').style.display = 'block';
      showStatus('has-multiple', `检测到 ${detectedResults.length} 个文档`);
    }
  });

  // 切换手动输入
  document.getElementById('toggleManual').addEventListener('click', () => {
    const manualInput = document.getElementById('manualInput');
    if (manualInput.style.display === 'none') {
      manualInput.style.display = 'block';
    } else {
      manualInput.style.display = 'none';
    }
  });

  // 使用手动输入 - 直接保存到文献库
  document.getElementById('useManualBtn').addEventListener('click', async () => {
    const url = document.getElementById('manualUrl').value.trim();
    const title = document.getElementById('manualTitle').value.trim();
    const folder = document.getElementById('docFolder').value;
    const tagsInput = document.getElementById('docTags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    if (!url) {
      alert('请输入PDF链接');
      return;
    }

    // 直接调用保存，带上文件夹和标签
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ 保存中...';
    showStatus('saving', '正在保存...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/plugin/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          title: title || url.split('/').pop().split('?')[0] || 'PDF文档',
          user_id: 'default',
          source_type: 'plugin',
          folder: folder,
          tags: tags
        })
      });

      const data = await response.json();

      if (data.success) {
        savedDocs.push({
          title: title || url.split('/').pop().split('?')[0] || 'PDF文档',
          url,
          folder,
          tags,
          timestamp: new Date().toLocaleString()
        });
        try {
          await chrome.storage.local.set({ savedDocs });
        } catch (storageError) {}

        showStatus('has-pdf', `✅ 已保存到 "${folder}" 文件夹！`);
        renderSavedDocs();

        // 清空输入框
        document.getElementById('manualUrl').value = '';
        document.getElementById('manualTitle').value = '';
        document.getElementById('docTags').value = '';
      } else {
        throw new Error(data.error || '保存失败');
      }
    } catch (error) {
      alert(`保存失败: ${error.message}`);
    }

    saveBtn.disabled = false;
    saveBtn.textContent = '💾 保存到文献库';
  });
}

// 保存到文献库
async function saveToLibrary() {
  let title = document.getElementById('docTitle').value.trim();
  const url = document.getElementById('docUrl').value;
  const folder = document.getElementById('docFolder').value;
  const tagsInput = document.getElementById('docTags').value.trim();
  // 将标签字符串转换为数组
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

  if (!title) {
    alert('请输入文档标题');
    return;
  }

  if (url.includes('（需要手动点击')) {
    alert('请先在网页上点击下载按钮，获取实际链接后再保存');
    return;
  }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ 获取标题...';

  // 尝试从 PDF 元数据获取标题
  try {
    const pdfTitle = await getPDFMetadata(url);
    if (pdfTitle && pdfTitle.length > 0 && pdfTitle.length < 200) {
      title = pdfTitle;
      document.getElementById('docTitle').value = title;
    }
  } catch (e) {
    console.log('获取PDF标题失败，使用原有标题');
  }

  saveBtn.textContent = '⏳ 保存中...';

  showStatus('saving', '正在保存...');

  try {
    // 清除之前的错误
    if (chrome.runtime.lastError) {
      chrome.runtime.lastError = null;
    }

    const response = await fetch(`${API_BASE_URL}/api/plugin/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        title: title,
        user_id: 'default',
        source_type: 'plugin',
        folder: folder,  // 传递文件夹参数
        tags: tags       // 传递标签参数
      })
    });

    const data = await response.json();

    if (data.success) {
      // 保存到本地存储
      savedDocs.push({
        title,
        url,
        folder,
        tags,
        timestamp: new Date().toLocaleString()
      });
      try {
        await chrome.storage.local.set({ savedDocs });
      } catch (storageError) {
        console.warn('保存到本地存储失败:', storageError);
      }

      // 更新UI
      showStatus('has-pdf', `✅ 已保存到 "${folder}" 文件夹！`);
      renderSavedDocs();

      setTimeout(() => {
        showStatus('has-pdf', '可以继续保存或打开文献库');
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 保存到文献库';

        // 清空表单
        document.getElementById('docTitle').value = '';
        document.getElementById('docUrl').value = '';
        document.getElementById('manualUrl').value = '';
        document.getElementById('manualTitle').value = '';
        document.getElementById('docTags').value = '';

        // 返回结果列表
        document.getElementById('content').style.display = 'none';
        if (detectedResults.length > 1) {
          document.getElementById('resultsSection').style.display = 'block';
          showStatus('has-multiple', `检测到 ${detectedResults.length} 个文档`);
        }
      }, 1500);
    } else {
      throw new Error(data.error || '保存失败');
    }
  } catch (error) {
    console.error('保存失败:', error);
    alert(`保存失败: ${error.message}`);
    showStatus('no-pdf', '保存失败，请重试');
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 保存到文献库';
  }
}

// 下载到本地
async function downloadToLocal() {
  const url = document.getElementById('docUrl').value;
  let title = document.getElementById('docTitle').value.trim();

  if (!url || url.includes('（需要手动点击')) {
    alert('请先获取有效的下载链接');
    return;
  }

  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.disabled = true;
  downloadBtn.textContent = '⏳ 获取标题...';

  try {
    // 尝试从 PDF 元数据获取标题
    const pdfTitle = await getPDFMetadata(url);
    if (pdfTitle && pdfTitle.length > 0) {
      title = pdfTitle;
      document.getElementById('docTitle').value = title;
      console.log('获取到PDF标题:', title);
    }
  } catch (e) {
    console.log('获取PDF标题失败，使用原有标题');
  }

  downloadBtn.textContent = '⏳ 下载中...';

  try {
    // 清除之前的错误
    if (chrome.runtime.lastError) {
      chrome.runtime.lastError = null;
    }

    const filename = `${title}.pdf`;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      // 检查错误，但不让错误影响UI
      if (chrome.runtime.lastError) {
        console.warn('下载提示:', chrome.runtime.lastError.message);
        // 不再弹窗干扰用户，只重置按钮状态
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇️ 下载到本地';
      } else {
        // 下载成功，也保存到文献库
        saveToLibrary();
      }
    });
  } catch (error) {
    console.error('下载失败:', error);
    alert(`下载失败: ${error.message}`);
    downloadBtn.disabled = false;
    downloadBtn.textContent = '⬇️ 下载到本地';
  }
}

// 加载已保存的文档
async function loadSavedDocs() {
  try {
    // 清除之前的错误
    if (chrome.runtime.lastError) {
      chrome.runtime.lastError = null;
    }
    const result = await chrome.storage.local.get('savedDocs');
    savedDocs = result.savedDocs || [];
    renderSavedDocs();
  } catch (error) {
    console.error('加载失败:', error);
    // 静默处理，不影响其他功能
  }
}

// 渲染已保存列表
function renderSavedDocs() {
  const container = document.getElementById('savedItems');
  const savedSection = document.getElementById('saved');

  if (savedDocs.length === 0) {
    savedSection.style.display = 'none';
    return;
  }

  savedSection.style.display = 'block';
  container.innerHTML = savedDocs.map(doc => `
    <div class="saved-item">
      <div class="title">📄 ${escapeHtml(doc.title)}</div>
      <div class="url">${escapeHtml(doc.url)}</div>
      <div style="font-size: 10px; color: #999; margin-top: 4px;">
        保存于 ${doc.timestamp}
      </div>
    </div>
  `).join('');
}

// 辅助函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncateUrl(url) {
  if (!url) return '';
  if (url.length > 60) {
    return url.substring(0, 30) + '...' + url.substring(url.length - 25);
  }
  return url;
}

function getConfidenceText(confidence) {
  const texts = {
    'high': '高置信度',
    'medium': '中置信度',
    'low': '低置信度'
  };
  return texts[confidence] || '';
}
