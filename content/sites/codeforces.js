(() => {
  'use strict';

  const { cleanLatexContent } = window.CopyMd.latex;

  const adapter = {
    id: 'codeforces',
    matches(ctx) {
      return ctx.hostname.includes('codeforces.com');
    },
    getSiteConfig() {
      return {
        removeSelectors: ['.MathJax_Preview', '.MathJax', '.mjx-chtml'],
        postProcess: ['cleanDoubleMath', 'cleanLatexSpaces'],
      };
    },
    extendTurndown(service) {
      service.addRule('codeforcesMathScript', {
        filter(node) {
          return node.tagName === 'SCRIPT' && node.type && node.type.includes('math/tex');
        },
        replacement(content, node) {
          const latex = node.textContent.trim();
          const isBlock = node.type.includes('mode=display');
          if (isBlock) return '\n\n$$\n' + cleanLatexContent(latex) + '\n$$\n\n';
          // keep legacy CF marker for later de-dup postprocess
          return '「CF」' + cleanLatexContent(latex) + '「/CF」';
        },
      });

      service.addRule('codeforcesMathJax', {
        filter(node) {
          if (!node.classList) return false;
          return (
            node.classList.contains('MathJax') ||
            node.classList.contains('MathJax_Preview') ||
            node.classList.contains('MathJax_Display') ||
            node.classList.contains('MathJax_SVG') ||
            node.classList.contains('MathJax_SVG_Display')
          );
        },
        replacement() {
          return '';
        },
      });

      service.addRule('universalCodeBlock', {
        filter(node) {
          return node.nodeName === 'PRE' || (node.classList && (node.classList.contains('input') || node.classList.contains('output')));
        },
        replacement(content, node) {
          const clone = node.cloneNode(true);
          clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
          clone.querySelectorAll('p, div').forEach((block) => {
            block.prepend('\n');
            block.append('\n');
          });

          let code = clone.innerText || clone.textContent || '';
          code = code.replace(/\n{3,}/g, '\n\n').trim();

          let language = '';
          const codeTag = node.querySelector && node.querySelector('code');
          if (codeTag && codeTag.className) {
            const match = codeTag.className.match(/(?:language-|lang-)(\w+)/);
            if (match) language = match[1];
          }

          return '\n\n```' + language + '\n' + code + '\n```\n\n';
        },
      });
    },
  };

  window.CopyMd.registerSite(adapter);
})();

