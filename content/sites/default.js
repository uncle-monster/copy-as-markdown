(() => {
  'use strict';

  const adapter = {
    id: 'default',
    // 只作为兜底使用，getSiteAdapter 会在没有其它站点命中的时候返回它
    matches() {
      return false;
    },
    getSiteConfig() {
      return {
        removeSelectors: ['.MathJax_Preview', '.katex-html'],
        postProcess: ['cleanLatexSpaces'],
      };
    },
    extendTurndown(service, ctx) {
      // Generic fenced code blocks (pre>code)
      service.addRule('fencedCodeBlock', {
        filter(node) {
          return node.nodeName === 'PRE' && node.querySelector('code');
        },
        replacement(content, node) {
          const code = node.querySelector('code');
          let language = '';
          if (code.className) {
            const match = code.className.match(/(?:language-|lang-)(\w+)/);
            if (match) language = match[1];
          }
          const codeContent = code.textContent.replace(/\n$/, '');
          return '\n\n```' + language + '\n' + codeContent + '\n```\n\n';
        },
      });
    },
  };

  window.CopyMd.registerSite(adapter);
})();

