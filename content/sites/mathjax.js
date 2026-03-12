(() => {
  'use strict';

  const { cleanLatexContent } = window.CopyMd.latex;

  const adapter = {
    id: 'mathjax',
    matches(ctx) {
      const h = ctx.hostname;
      return (
        h.includes('stackoverflow.com') ||
        h.includes('stackexchange.com') ||
        h.includes('arxiv.org') ||
        h.includes('mathjax') ||
        !!document.querySelector('.MathJax') ||
        !!document.querySelector('script[type*="math/tex"]')
      );
    },
    getSiteConfig(ctx) {
      const h = ctx.hostname;
      const isStack = h.includes('stackoverflow.com') || h.includes('stackexchange.com');
      const isArxiv = h.includes('arxiv.org');
      return {
        removeSelectors: ['.MathJax_Preview', '.MathJax'],
        postProcess: ['cleanLatexSpaces'],
        siteAlias: isStack ? 'stackoverflow' : isArxiv ? 'arxiv' : 'mathjax',
      };
    },
    extendTurndown(service) {
      service.addRule('mathjaxScript', {
        filter(node) {
          return node.tagName === 'SCRIPT' && node.type && node.type.includes('math/tex');
        },
        replacement(content, node) {
          const latex = node.textContent.trim();
          const isBlock = node.type.includes('mode=display');
          if (isBlock) return '\n\n$$\n' + cleanLatexContent(latex) + '\n$$\n\n';
          return '$' + cleanLatexContent(latex) + '$';
        },
      });

      service.addRule('mathjaxPreview', {
        filter(node) {
          return node.classList && (
            node.classList.contains('MathJax') ||
            node.classList.contains('MathJax_Preview') ||
            node.classList.contains('MathJax_Display')
          );
        },
        replacement() {
          return '';
        },
      });
    },
  };

  window.CopyMd.registerSite(adapter);
})();

