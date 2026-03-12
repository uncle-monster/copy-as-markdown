(() => {
  'use strict';

  const cfg = window.CopyMd.config.get;
  const { createTurndownService } = window.CopyMd.turndown;
  const { postProcessMarkdown } = window.CopyMd.postprocess;

  function buildCtx() {
    const hostname = window.location.hostname.toLowerCase();
    const config = cfg();
    const ctx = { hostname, config, site: 'default', adapter: null, siteConfig: null };

    const adapter = window.CopyMd.getSiteAdapter(ctx) || window.CopyMd.registry.get('default');
    ctx.adapter = adapter;
    ctx.site = adapter ? adapter.id : 'default';
    ctx.siteConfig = (adapter && typeof adapter.getSiteConfig === 'function') ? adapter.getSiteConfig(ctx) : {};
    return ctx;
  }

  function convertHtmlToMarkdown(html, ctx) {
    const service = createTurndownService(ctx);
    let markdown = service.turndown(html);
    markdown = postProcessMarkdown(markdown, ctx);
    return markdown;
  }

  document.addEventListener('copy', (e) => {
    const config = cfg();
    if (!config.enabled) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    try {
      const container = document.createElement('div');
      for (let i = 0; i < selection.rangeCount; i++) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
      }

      const html = container.innerHTML;
      if (!html.trim()) return;

      const ctx = buildCtx();
      const markdown = convertHtmlToMarkdown(html, ctx);

      e.clipboardData.setData('text/plain', markdown);
      e.clipboardData.setData('text/html', html);
      e.preventDefault();

      showNotification('已复制为 Markdown (' + ctx.site + ')');
    } catch (error) {
      console.error('Copy as Markdown error:', error);
    }
  });

  function showNotification(message) {
    const existing = document.querySelector('.copy-md-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'copy-md-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #333;
      color: #fff;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 999999;
      opacity: 0;
      transition: opacity 0.3s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.style.opacity = '1';
    });

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  const ctx = buildCtx();
  console.log('Copy as Markdown loaded for:', ctx.site);
})();

