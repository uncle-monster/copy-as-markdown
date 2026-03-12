(() => {
  'use strict';

  const { cleanLatexContent } = window.CopyMd.latex;

  const adapter = {
    id: 'zhihu',
    matches(ctx) {
      return ctx.hostname.includes('zhihu.com') || !!document.querySelector('.ztext-math');
    },
    getSiteConfig() {
      return {
        removeSelectors: [],
        postProcess: ['cleanLatexSpaces'],
      };
    },
    extendTurndown(service) {
      service.addRule('zhihuMath', {
        filter(node) {
          return node.classList && node.classList.contains('ztext-math');
        },
        replacement(content, node) {
          const latex = node.getAttribute('data-tex') || node.textContent.trim();
          const isBlock =
            node.getAttribute('data-display') === 'block' ||
            /\\\\|begin\{(align|cases|gather|matrix|split)\}/.test(latex);

          const cleaned = cleanLatexContent(latex);
          if (isBlock) return '\n\n$$\n' + cleaned + '\n$$\n\n';
          return '$' + cleaned + '$';
        },
      });
    },
  };

  window.CopyMd.registerSite(adapter);
})();

