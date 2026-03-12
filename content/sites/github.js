(() => {
  'use strict';

  const { cleanLatexContent } = window.CopyMd.latex;

  const adapter = {
    id: 'github',
    matches(ctx) {
      return ctx.hostname.includes('github.com') || !!document.querySelector('math annotation');
    },
    getSiteConfig() {
      return {
        removeSelectors: [],
        postProcess: [],
      };
    },
    extendTurndown(service) {
      service.addRule('githubMath', {
        filter: 'math',
        replacement(content, node) {
          const annotation = node.querySelector('annotation[encoding*="tex"]');
          if (!annotation) return content;
          const latex = cleanLatexContent(annotation.textContent.trim());
          const isBlock = node.getAttribute('display') === 'block';
          if (isBlock) return '\n\n$$\n' + latex + '\n$$\n\n';
          return '$' + latex + '$';
        },
      });
    },
  };

  window.CopyMd.registerSite(adapter);
})();

