(() => {
  'use strict';

  const { cleanLatexContent } = window.CopyMd.latex;

  const adapter = {
    id: 'katex',
    matches(ctx) {
      const h = ctx.hostname;
      return (
        h.includes('leetcode.com') ||
        h.includes('leetcode.cn') ||
        h.includes('csdn.net') ||
        !!document.querySelector('.katex')
      );
    },
    getSiteConfig() {
      return {
        removeSelectors: ['.katex-html'],
        postProcess: ['cleanLatexSpaces'],
      };
    },
    extendTurndown(service) {
      service.addRule('katexMath', {
        filter(node) {
          return node.classList && node.classList.contains('katex');
        },
        replacement(content, node) {
          const annotation = node.querySelector('.katex-mathml annotation');
          if (!annotation) return content;
          const latex = cleanLatexContent(annotation.textContent.trim());
          const isBlock = node.closest('.katex-display') !== null;
          if (isBlock) return '\n\n$$\n' + latex + '\n$$\n\n';
          return '$' + latex + '$';
        },
      });

      service.addRule('katexDisplay', {
        filter(node) {
          return node.classList && node.classList.contains('katex-display');
        },
        replacement(content, node) {
          const annotation = node.querySelector('.katex-mathml annotation');
          if (annotation) return '\n\n$$\n' + cleanLatexContent(annotation.textContent.trim()) + '\n$$\n\n';
          return content;
        },
      });
    },
  };

  window.CopyMd.registerSite(adapter);
})();

