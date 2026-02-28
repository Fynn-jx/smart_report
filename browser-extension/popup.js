// 配置
const API_BASE_URL = 'http://localhost:5000';

// 全局状态
let savedDocs = [];
let detectedResults = [];
let selectedResult = null;

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

    // 检测页面中的 PDF
    const results = await detectPDFs(tab.id);

    if (results.length > 0) {
      showResults(results);
    } else {
      // 检查是否本身就是 PDF
      if (tab.url && (tab.url.includes('.pdf') || tab.url.toLowerCase().includes('pdf'))) {
        selectResult({
          url: tab.url,
          title: document.title || tab.url.split('/').pop(),
          type: 'current-page',
          confidence: 'high'
        });
      } else {
        showStatus('no-pdf', '当前页面没有检测到 PDF 文档');
      }
    }
  } catch (error) {
    console.error('检测失败:', error);
    showStatus('no-pdf', '检测失败，请刷新页面重试');
  }
}

// 检测页面中的 PDF 链接
async function detectPDFs(tabId) {
  try {
    // 使用executeScript在目标页面执行检测函数
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // 在页面上下文中执行的函数
        try {
          const DOWNLOAD_TEXTS = ['下载', 'download', '导出', 'export', '保存', 'save'];
          const results = [];

          // 检测链接
          document.querySelectorAll('a[href]').forEach(link => {
            const href = link.href;
            const text = link.textContent.trim().toLowerCase();

            if (href) {
              if (href.includes('.pdf') || href.toLowerCase().includes('pdf')) {
                results.push({
                  url: href,
                  title: link.textContent.trim() || link.title || href.split('/').pop(),
                  type: 'PDF链接',
                  confidence: 'high'
                });
              } else if (href.includes('download') || DOWNLOAD_TEXTS.some(t => text.includes(t))) {
                results.push({
                  url: href,
                  title: link.textContent.trim() || '下载链接',
                  type: '下载链接',
                  confidence: 'medium'
                });
              }
            }
          });

          // 检测按钮
          document.querySelectorAll('button, [role="button"], .btn, .button').forEach(btn => {
            const text = btn.textContent.trim().toLowerCase();

            if (DOWNLOAD_TEXTS.some(t => text.includes(t))) {
              let url = btn.getAttribute('data-url') ||
                        btn.getAttribute('data-href') ||
                        btn.getAttribute('data-pdf');

              if (!url && btn.onclick) {
                const match = btn.onclick.toString().match(/['"]([^'"]*\.(pdf|download[^'"]*))['"]/i);
                if (match) url = match[1];
              }

              if (!url) {
                const parentLink = btn.closest('a');
                if (parentLink) url = parentLink.href;
              }

              results.push({
                url: url || window.location.href,
                title: btn.textContent.trim() || '下载按钮',
                type: url ? '下载按钮' : '下载按钮(需点击)',
                confidence: url ? 'medium' : 'low',
                needsClick: !url
              });
            }
          });

          // 检测iframe
          document.querySelectorAll('iframe[src]').forEach(iframe => {
            const src = iframe.src;
            if (src && (src.includes('.pdf') || src.toLowerCase().includes('pdf'))) {
              results.push({
                url: src,
                title: iframe.title || '嵌入的PDF',
                type: '嵌入PDF',
                confidence: 'high'
              });
            }
          });

          // 去重
          const seen = new Set();
          return results.filter(r => r.url && !seen.has(r.url) && seen.add(r.url));
        } catch (error) {
          console.error('页面内检测出错:', error);
          return [];
        }
      }
    });

    // executeScript返回一个数组，每个元素都有result属性
    const results = injectionResults?.[0]?.result || [];
    detectedResults = results;
    return results;

  } catch (error) {
    console.error('检测PDF失败:', error);
    // 如果executeScript失败，返回空数组
    return [];
  }
}

// 显示检测结果
function showResults(results) {
  const resultsSection = document.getElementById('resultsSection');
  const resultsList = document.getElementById('resultsList');

  resultsSection.classList.remove('hidden');

  if (results.length === 1) {
    // 只有一个结果，直接选择
    selectResult(results[0]);
    resultsSection.classList.add('hidden');
    return;
  }

  // 多个结果，显示列表
  const message = results.length >= 5
    ? `检测到 ${results.length} 个可能的文档`
    : `检测到 ${results.length} 个文档`;

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
      selectResult(results[index]);
    });
  });
}

// 选择结果
function selectResult(result) {
  selectedResult = result;

  document.getElementById('resultsSection').classList.add('hidden');
  document.getElementById('content').style.display = 'block';

  showStatus('has-pdf', '已选择文档');

  document.getElementById('docTitle').value = result.title;
  document.getElementById('docUrl').value = result.url || '（需要手动点击网页上的下载按钮获取链接）';

  // 显示警告
  const warning = document.getElementById('needsClickWarning');
  if (result.needsClick || !result.url) {
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
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
      document.getElementById('resultsSection').classList.remove('hidden');
      showStatus('has-multiple', `检测到 ${detectedResults.length} 个文档`);
    }
  });

  // 切换手动输入
  document.getElementById('toggleManual').addEventListener('click', () => {
    const manualInput = document.getElementById('manualInput');
    manualInput.classList.toggle('hidden');
  });

  // 使用手动输入
  document.getElementById('useManualBtn').addEventListener('click', () => {
    const url = document.getElementById('manualUrl').value.trim();
    const title = document.getElementById('manualTitle').value.trim();

    if (!url) {
      alert('请输入PDF链接');
      return;
    }

    selectResult({
      url: url,
      title: title || url.split('/').pop(),
      type: '手动输入',
      confidence: 'high'
    });
  });
}

// 保存到文献库
async function saveToLibrary() {
  const title = document.getElementById('docTitle').value.trim();
  const url = document.getElementById('docUrl').value;

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
        title: title,
        user_id: 'default',
        source_type: 'plugin'
      })
    });

    const data = await response.json();

    if (data.success) {
      // 保存到本地存储
      savedDocs.push({
        title,
        url,
        timestamp: new Date().toLocaleString()
      });
      await chrome.storage.local.set({ savedDocs });

      // 更新UI
      showStatus('has-pdf', '✅ 已保存到文献库！');
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

        // 返回结果列表
        document.getElementById('content').style.display = 'none';
        if (detectedResults.length > 1) {
          document.getElementById('resultsSection').classList.remove('hidden');
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
  const title = document.getElementById('docTitle').value.trim();

  if (!url || url.includes('（需要手动点击')) {
    alert('请先获取有效的下载链接');
    return;
  }

  const downloadBtn = document.getElementById('downloadBtn');
  downloadBtn.disabled = true;
  downloadBtn.textContent = '⏳ 下载中...';

  try {
    const filename = `${title}.pdf`;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        alert(`下载失败: ${chrome.runtime.lastError.message}`);
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
    const result = await chrome.storage.local.get('savedDocs');
    savedDocs = result.savedDocs || [];
    renderSavedDocs();
  } catch (error) {
    console.error('加载失败:', error);
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
