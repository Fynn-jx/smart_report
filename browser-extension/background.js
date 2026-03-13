// 公文系统文献助手 - Background Service Worker
// 处理后台任务、右键菜单和事件监听

// ============= 配置 =============
const CONFIG = {
  API_BASE_URL: 'http://localhost:5000',
  USER_ID: 'default'
};

// ============= 插件安装/更新 =============
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📚 文献助手已安装/更新');

  if (details.reason === 'install') {
    // 首次安装，使用 Promise 方式避免回调问题
    try {
      await chrome.storage.local.set({
        savedDocs: [],
        settings: {
          autoSave: false,
          defaultFolder: '未分类',
          defaultTags: ['网页保存']
        }
      });
      console.log('✅ 初始化存储成功');
    } catch (error) {
      console.error('初始化存储失败:', error);
    }
  } else if (details.reason === 'update') {
    // 更新后的操作
    console.log('插件已更新到新版本');
  }

  // 创建右键菜单
  createContextMenus();
});

// ============= 右键菜单 =============
function createContextMenus() {
  // 移除旧菜单，使用 Promise 方式
  chrome.contextMenus.removeAll()
    .then(() => {
      // 创建保存PDF到文献库的菜单
      return chrome.contextMenus.create({
        id: 'save-pdf-to-library',
        title: '📚 保存PDF到文献库',
        contexts: ['link', 'selection', 'page']
      });
    })
    .then(() => {
      // 创建在当前页面查找PDF的菜单
      return chrome.contextMenus.create({
        id: 'find-pdfs-in-page',
        title: '🔍 在当前页面查找PDF',
        contexts: ['page']
      });
    })
    .then(() => {
      // 打开文献库
      return chrome.contextMenus.create({
        id: 'open-library',
        title: '🚀 打开文献库',
        contexts: ['all']
      });
    })
    .then(() => {
      console.log('✅ 右键菜单创建成功');
    })
    .catch((error) => {
      console.warn('创建右键菜单失败:', error);
    });
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // 清除之前的错误
  if (chrome.runtime.lastError) {
    chrome.runtime.lastError = null;
  }

  try {
    switch (info.menuItemId) {
      case 'save-pdf-to-library':
        await handleSavePDF(info, tab);
        break;
      case 'find-pdfs-in-page':
        await handleFindPDFs(tab);
        break;
      case 'open-library':
        await openLibrary();
        break;
      default:
        console.warn('未知菜单项:', info.menuItemId);
    }
  } catch (error) {
    console.error('处理菜单点击失败:', error);
  }
});

// 保存PDF到文献库
async function handleSavePDF(info, tab) {
  let url = null;
  let title = null;

  // 从链接获取
  if (info.linkUrl) {
    url = info.linkUrl;
    title = info.linkText || 'PDF文档';
  }
  // 从选中文本获取
  else if (info.selectionText) {
    url = info.selectionText;
    title = '选中的PDF链接';
  }
  // 从页面URL获取
  else if (tab.url && (tab.url.includes('.pdf') || tab.url.toLowerCase().includes('pdf'))) {
    url = tab.url;
    title = tab.title || 'PDF文档';
  }

  if (url) {
    // 打开popup或直接保存
    const result = await saveToLibrary(url, title);
    if (result.success) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon.svg',
          title: '文献助手',
          message: '✅ 已保存到文献库！'
        });
      } catch (notifyError) {
        console.warn('创建通知失败:', notifyError);
      }
    } else {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon.svg',
          title: '文献助手',
          message: `❌ 保存失败: ${result.error}`
        });
      } catch (notifyError) {
        console.warn('创建通知失败:', notifyError);
      }
    }
  } else {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon.svg',
        title: '文献助手',
        message: '❓ 未检测到PDF链接'
      });
    } catch (notifyError) {
      console.warn('创建通知失败:', notifyError);
    }
  }
}

// 在页面中查找PDF
async function handleFindPDFs(tab) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: findPDFsInPage
    });

    const pdfs = result?.result || [];

    if (pdfs.length === 0) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon.svg',
          title: '文献助手',
          message: '当前页面没有找到PDF链接'
        });
      } catch (notifyError) {
        console.warn('创建通知失败:', notifyError);
      }
    } else {
      // 创建包含所有PDF链接的通知
      try {
        chrome.notifications.create({
          type: 'list',
          iconUrl: 'icons/icon.svg',
          title: `找到 ${pdfs.length} 个PDF`,
          message: '点击插件查看详情',
          items: pdfs.slice(0, 5).map(pdf => ({
            title: pdf.title,
            message: pdf.url
          }))
        });
      } catch (notifyError) {
        console.warn('创建通知失败:', notifyError);
      }

      // 存储找到的PDF以便popup使用
      try {
        await chrome.storage.local.set({ foundPDFs: pdfs });
      } catch (storageError) {
        console.warn('存储PDF列表失败:', storageError);
      }
    }
  } catch (error) {
    console.error('查找PDF失败:', error);
  }
}

// 在页面中查找PDF的函数（会被注入到页面中执行）
function findPDFsInPage() {
  const pdfs = [];

  // 检测所有链接
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.href;
    if (href && (
      href.includes('.pdf') ||
      href.toLowerCase().includes('pdf') ||
      href.includes('download')
    )) {
      pdfs.push({
        url: href,
        title: link.textContent.trim() || link.href.split('/').pop()
      });
    }
  });

  // 检测iframe
  document.querySelectorAll('iframe[src]').forEach(iframe => {
    const src = iframe.src;
    if (src && src.includes('.pdf')) {
      pdfs.push({
        url: src,
        title: document.title || src.split('/').pop()
      });
    }
  });

  return pdfs;
}

// 打开文献库
async function openLibrary() {
  try {
    // 清除之前的错误
    if (chrome.runtime.lastError) {
      chrome.runtime.lastError = null;
    }
    await chrome.tabs.create({
      url: 'http://localhost:5173'
    });
  } catch (error) {
    console.error('打开文献库失败:', error);
  }
}

// ============= API 调用 =============
async function saveToLibrary(url, title) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/api/plugin/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        title: title,
        user_id: CONFIG.USER_ID,
        source_type: 'plugin'
      })
    });

    const data = await response.json();

    // 同时保存到本地存储，使用 Promise 方式
    try {
      const result = await chrome.storage.local.get('savedDocs');
      const savedDocs = result.savedDocs || [];
      savedDocs.push({
        title,
        url,
        timestamp: new Date().toLocaleString()
      });
      await chrome.storage.local.set({ savedDocs });
    } catch (storageError) {
      console.warn('保存到本地存储失败:', storageError);
      // 不影响主流程，继续返回 API 响应
    }

    return data;
  } catch (error) {
    console.error('保存失败:', error);
    return { success: false, error: error.message };
  }
}

// ============= 下载监听 =============
// 监听下载完成事件，如果下载的是PDF，提示用户保存到文献库
chrome.downloads.onChanged.addListener(async (downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    try {
      const downloadItems = await chrome.downloads.search({
        id: downloadDelta.id
      });

      if (downloadItems.length > 0) {
        const item = downloadItems[0];

        // 检查是否是PDF
        if (item.filename && item.filename.toLowerCase().endsWith('.pdf')) {
          // 使用 Promise 避免回调问题
          try {
            const result = await chrome.storage.local.get('downloadedPDFs');
            const downloadedPDFs = result.downloadedPDFs || [];
            downloadedPDFs.push({
              filename: item.filename,
              url: item.url,
              title: item.filename.split(/[/\\]/).pop(),
              timestamp: Date.now()
            });
            await chrome.storage.local.set({ downloadedPDFs });
          } catch (storageError) {
            console.warn('保存下载记录失败:', storageError);
          }
        }
      }
    } catch (error) {
      // 静默处理错误，不干扰用户
      console.debug('下载事件处理:', error);
    }
  }
});

// ============= 消息监听 =============
// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 清除之前的错误
  if (chrome.runtime.lastError) {
    chrome.runtime.lastError = null;
  }

  try {
    switch (request.action) {
      case 'saveToLibrary':
        saveToLibrary(request.url, request.title)
          .then(result => {
            sendResponse(result);
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        return true; // 保持消息通道开启

      case 'openLibrary':
        openLibrary();
        sendResponse({ success: true });
        return true;

      case 'getFoundPDFs':
        chrome.storage.local.get('foundPDFs')
          .then((result) => {
            sendResponse({ pdfs: result.foundPDFs || [] });
          })
          .catch((error) => {
            console.error('获取foundPDFs失败:', error);
            sendResponse({ pdfs: [] });
          });
        return true;

      case 'getSettings':
        chrome.storage.local.get('settings')
          .then((result) => {
            sendResponse({ settings: result.settings || {} });
          })
          .catch((error) => {
            console.error('获取settings失败:', error);
            sendResponse({ settings: {} });
          });
        return true;

      case 'updateSettings':
        chrome.storage.local.get('settings')
          .then((result) => {
            const settings = { ...result.settings, ...request.settings };
            return chrome.storage.local.set({ settings });
          })
          .then(() => {
            return chrome.storage.local.get('settings');
          })
          .then((result) => {
            sendResponse({ success: true, settings: result.settings });
          })
          .catch((error) => {
            console.error('更新settings失败:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;

      default:
        // 未知消息类型，不发送响应
        console.warn('未知消息类型:', request.action);
        return false;
    }
  } catch (error) {
    console.error('Background message handler error:', error);
    // 尝试发送响应，但如果通道已关闭则忽略
    try {
      sendResponse({ success: false, error: error.message });
    } catch (e) {
      // 忽略 "message port closed" 错误
      if (e.message && !e.message.includes('message port closed')) {
        console.error('发送响应失败:', e);
      }
    }
    return true;
  }
});

// ============= 快捷键 =============
// 可以在manifest.json中添加commands来定义快捷键
chrome.commands?.onCommand?.addListener(async (command) => {
  // 清除之前的错误
  if (chrome.runtime.lastError) {
    chrome.runtime.lastError = null;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    switch (command) {
      case 'save-current-pdf':
        if (tab && tab.url && tab.url.includes('.pdf')) {
          await saveToLibrary(tab.url, tab.title);
        }
        break;
      case 'open-library':
        await openLibrary();
        break;
      default:
        console.warn('未知命令:', command);
    }
  } catch (error) {
    console.error('处理快捷键失败:', error);
  }
});

// ============= 日志 =============
console.log('📚 文献助手 Background Service Worker 已启动');
