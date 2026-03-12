(() => {
  'use strict';

  const { convertTableToMarkdown } = window.CopyMd.table;

  function addRemoveSelectorsRule(service, selectors) {
    if (!selectors || selectors.length === 0) return;
    service.addRule('removeUnwanted', {
      filter(node) {
        return selectors.some((selector) => {
          try {
            return node.matches && node.matches(selector);
          } catch (e) {
            return false;
          }
        });
      },
      replacement() {
        return '';
      },
    });
  }

  function addCommonRules(service, ctx) {
    // Strikethrough
    service.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement(content) {
        return '~~' + content + '~~';
      },
    });

    // Tables
    if (ctx.config.preserveTables) {
      service.addRule('table', {
        filter: 'table',
        replacement(content, node) {
          return convertTableToMarkdown(node, ctx);
        },
      });
    }

    // Images
    if (ctx.config.preserveImages) {
      service.addRule('image', {
        filter: 'img',
        replacement(content, node) {
          const alt = node.alt || '';
          const src = node.src || '';
          const title = node.title ? ` "${node.title}"` : '';
          if (!src) return '';
          return `![${alt}](${src}${title})`;
        },
      });
    }
  }

  function createTurndownService(ctx) {
    const cfg = ctx.config;
    const service = new TurndownService({
      headingStyle: cfg.headingStyle,
      codeBlockStyle: cfg.codeBlockStyle,
      bulletListMarker: '-',
      emDelimiter: '*',
    });

    addRemoveSelectorsRule(service, ctx.siteConfig && ctx.siteConfig.removeSelectors);
    addCommonRules(service, ctx);

    if (ctx.adapter && typeof ctx.adapter.extendTurndown === 'function') {
      ctx.adapter.extendTurndown(service, ctx);
    }

    // Allow fallback default extension for code blocks, etc.
    const defaultAdapter = window.CopyMd.registry.get('default');
    if (defaultAdapter && defaultAdapter !== ctx.adapter && typeof defaultAdapter.extendTurndown === 'function') {
      defaultAdapter.extendTurndown(service, ctx);
    }

    return service;
  }

  window.CopyMd.turndown = { createTurndownService };
})();

