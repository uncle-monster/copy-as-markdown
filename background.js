/**
 * Copy as Markdown - Background Service Worker
 * 处理右键菜单和扩展生命周期
 */

// 安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单项
  chrome.contextMenus.create({
    id: 'copyAsMarkdown',
    title: '复制为 Markdown',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'copyAsMarkdownWithMath',
    title: '复制为 Markdown（保留公式）',
    contexts: ['selection']
  });

  // 设置默认配置
  chrome.storage.sync.get('config', (result) => {
    if (!result.config) {
      chrome.storage.sync.set({
        config: {
          enabled: true,
          inlineMathDelimiter: '$',
          blockMathDelimiter: '$$',
          preserveImages: true,
          preserveTables: true,
          headingStyle: 'atx',
          codeBlockStyle: 'fenced'
        }
      });
    }
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copyAsMarkdown' || info.menuItemId === 'copyAsMarkdownWithMath') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'copySelection',
      preserveMath: info.menuItemId === 'copyAsMarkdownWithMath'
    });
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    chrome.storage.sync.get('config', (result) => {
      sendResponse(result.config);
    });
    return true; // 保持消息通道开放
  }
  
  if (request.action === 'saveConfig') {
    chrome.storage.sync.set({ config: request.config }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});