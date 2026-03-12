(() => {
  'use strict';

  const { cleanLatexContent } = window.CopyMd.latex;

  const adapter = {
    id: 'wikipedia',
    matches(ctx) {
      const h = ctx.hostname;
      return h.includes('wikipedia.org') || h.includes('wikimedia.org') || !!document.querySelector('.mwe-math-element');
    },
    getSiteConfig() {
      return {
        removeSelectors: ['.mw-editsection', '.reference', 'style', '.sr-only'],
        postProcess: ['cleanEditLinks', 'cleanReferences', 'cleanLatexSpaces'],
      };
    },
    extendTurndown(service) {
      service.addRule('wikipediaMath', {
        filter(node) {
          return node.classList && node.classList.contains('mwe-math-element');
        },
        replacement(content, node) {
          const annotation = node.querySelector('annotation');
          if (!annotation) return content;
          const latex = cleanLatexContent(annotation.textContent.trim());
          const isBlock = node.querySelector('.mwe-math-fallback-image-display') !== null;
          if (isBlock) return '\n\n$$\n' + latex + '\n$$\n\n';
          return '$' + latex + '$';
        },
      });

      service.addRule('wikipediaFraction', {
        filter(node) {
          return node.classList && node.classList.contains('sfrac');
        },
        replacement(content, node) {
          const num = node.querySelector('.num');
          const den = node.querySelector('.den');
          if (num && den) return '$\\frac{' + num.textContent.trim() + '}{' + den.textContent.trim() + '}$';
          return content;
        },
      });

      service.addRule('wikipediaReference', {
        filter(node) {
          return node.nodeName === 'SUP' && node.classList && node.classList.contains('reference');
        },
        replacement() {
          return '';
        },
      });

      // 行内上标/下标：用于 10-14 这类数量级，避免被当成普通文本
      service.addRule('wikipediaSupSub', {
        filter(node) {
          const name = node.nodeName;
          if (name !== 'SUP' && name !== 'SUB') return false;
          // 引用上标已经通过 wikipediaReference / removeSelectors 处理，这里只处理普通上标
          if (node.classList && node.classList.contains('reference')) return false;
          return true;
        },
        replacement(content, node) {
          const raw = node.textContent || '';
          const text = raw.trim();
          if (!text) return '';

          const isSup = node.nodeName === 'SUP';
          const supMap = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
            '-': '⁻', '−': '⁻', '+': '⁺',
          };
          const subMap = {
            '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
            '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
            '-': '₋', '−': '₋', '+': '₊',
          };

          // 仅当全部字符都在映射表中时才转换，避免误改化学符号等复杂上标
          const map = isSup ? supMap : subMap;
          if (![...text].every((ch) => map[ch])) {
            return text;
          }

          let result = '';
          for (const ch of text) {
            result += map[ch] || ch;
          }
          return result;
        },
      });

      service.addRule('removeEditSection', {
        filter(node) {
          return node.classList && node.classList.contains('mw-editsection');
        },
        replacement() {
          return '';
        },
      });
    },
  };

  window.CopyMd.registerSite(adapter);
})();

