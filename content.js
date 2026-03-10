/**
 * Copy as Markdown - Content Script (v8 - 稳定版)
 */

(function() {
  'use strict';

  let config = {
    enabled: true,
    inlineMathDelimiter: '$',
    blockMathDelimiter: '$$',
    preserveImages: true,
    preserveTables: true,
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    convertItalicMath: true
  };

  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get('config', (result) => {
      if (result.config) {
        config = { ...config, ...result.config };
      }
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.config) {
        config = { ...config, ...changes.config.newValue };
      }
    });
  }

  function createTurndownService() {
    const service = new TurndownService({
      headingStyle: config.headingStyle,
      codeBlockStyle: config.codeBlockStyle,
      bulletListMarker: '-',
      emDelimiter: '*'  // 保持斜体为 *，后处理中识别
    });

    // ========== 过滤不需要的元素 ==========
    service.addRule('removeStyle', {
      filter: 'style',
      replacement: function() { return ''; }
    });

    service.addRule('removeSrOnly', {
      filter: function(node) {
        return node.classList && node.classList.contains('sr-only');
      },
      replacement: function() { return ''; }
    });

    // ========== 删除线 ==========
    service.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function(content) {
        return '~~' + content + '~~';
      }
    });

    // ========== 数学公式规则 ==========

    // KaTeX
    service.addRule('katex', {
      filter: function(node) {
        return node.classList && node.classList.contains('katex');
      },
      replacement: function(content, node) {
        const annotation = node.querySelector('.katex-mathml annotation');
        if (annotation) {
          const latex = annotation.textContent.trim();
          const isBlock = node.closest('.katex-display') !== null;
          if (isBlock) {
            return '\n\n$$\n' + cleanLatex(latex) + '\n$$\n\n';
          }
          return '「MATH」' + cleanLatex(latex) + '「/MATH」';
        }
        return content;
      }
    });

    service.addRule('katex-display', {
      filter: function(node) {
        return node.classList && node.classList.contains('katex-display');
      },
      replacement: function(content, node) {
        const annotation = node.querySelector('.katex-mathml annotation');
        if (annotation) {
          return '\n\n$$\n' + cleanLatex(annotation.textContent.trim()) + '\n$$\n\n';
        }
        return content;
      }
    });

    // MathJax
    service.addRule('mathjax', {
      filter: function(node) {
        return node.classList && (
          node.classList.contains('MathJax') ||
          node.classList.contains('MathJax_Display') ||
          node.classList.contains('MathJax_Preview')
        );
      },
      replacement: function(content, node) {
        if (node.classList.contains('MathJax_Preview')) return '';
        const script = node.nextElementSibling;
        if (script && script.type && script.type.includes('math/tex')) {
          const latex = script.textContent.trim();
          const isBlock = script.type.includes('mode=display');
          if (isBlock) {
            return '\n\n$$\n' + cleanLatex(latex) + '\n$$\n\n';
          }
          return '「MATH」' + cleanLatex(latex) + '「/MATH」';
        }
        return content;
      }
    });

    // MathML
    service.addRule('mathml', {
      filter: 'math',
      replacement: function(content, node) {
        const annotation = node.querySelector('annotation[encoding*="tex"], annotation[encoding*="latex"]');
        if (annotation) {
          const latex = annotation.textContent.trim();
          const isBlock = node.getAttribute('display') === 'block';
          if (isBlock) {
            return '\n\n$$\n' + cleanLatex(latex) + '\n$$\n\n';
          }
          return '「MATH」' + cleanLatex(latex) + '「/MATH」';
        }
        return content;
      }
    });

    // Wikipedia 公式
    service.addRule('wikipedia-math', {
      filter: function(node) {
        return node.classList && node.classList.contains('mwe-math-element');
      },
      replacement: function(content, node) {
        const annotation = node.querySelector('annotation');
        if (annotation) {
          const latex = annotation.textContent.trim();
          const isBlock = node.querySelector('.mwe-math-fallback-image-display') !== null;
          if (isBlock) {
            return '\n\n$$\n' + cleanLatex(latex) + '\n$$\n\n';
          }
          return '「MATH」' + cleanLatex(latex) + '「/MATH」';
        }
        const img = node.querySelector('img');
        if (img && img.alt) {
          const isBlock = img.classList.contains('mwe-math-fallback-image-display');
          if (isBlock) {
            return '\n\n$$\n' + cleanLatex(img.alt) + '\n$$\n\n';
          }
          return '「MATH」' + cleanLatex(img.alt) + '「/MATH」';
        }
        return content;
      }
    });

    // Wikipedia 分数
    service.addRule('wikipediaFraction', {
      filter: function(node) {
        return node.classList && node.classList.contains('sfrac');
      },
      replacement: function(content, node) {
        const num = node.querySelector('.num');
        const den = node.querySelector('.den');
        if (num && den) {
          return '「MATH」\\frac{' + num.textContent.trim() + '}{' + den.textContent.trim() + '}「/MATH」';
        }
        return content;
      }
    });

    // Wikipedia 引用上标
    service.addRule('wikiCiteRef', {
      filter: function(node) {
        return node.nodeName === 'SUP' && node.classList && node.classList.contains('reference');
      },
      replacement: function(content, node) {
        const link = node.querySelector('a');
        if (link) {
          return '^' + link.textContent.trim() + '^';
        }
        return content;
      }
    });

    // 代码块
    service.addRule('fencedCodeBlock', {
      filter: function(node) {
        return node.nodeName === 'PRE' && node.querySelector('code');
      },
      replacement: function(content, node) {
        const code = node.querySelector('code');
        let language = '';
        if (code.className) {
          const match = code.className.match(/(?:language-|lang-)(\w+)/);
          if (match) language = match[1];
        }
        const codeContent = code.textContent.replace(/\n$/, '');
        return '\n\n```' + language + '\n' + codeContent + '\n```\n\n';
      }
    });

    // 表格
    if (config.preserveTables) {
      service.addRule('table', {
        filter: 'table',
        replacement: function(content, node) {
          return convertTableToMarkdown(node);
        }
      });
    }

    // 图片
    if (config.preserveImages) {
      service.addRule('image', {
        filter: 'img',
        replacement: function(content, node) {
          const alt = node.alt || '';
          const src = node.src || '';
          const title = node.title ? ` "${node.title}"` : '';
          if (!src) return '';
          return `![${alt}](${src}${title})`;
        }
      });
    }

    return service;
  }

  // 清理 LaTeX 内容
  function cleanLatex(latex) {
    return latex.trim()
      .replace(/^\\\[|\\\]$/g, '')
      .replace(/^\\\(|\\\)$/g, '')
      .replace(/^\$\$|\$\$$/g, '')
      .replace(/^\$|\$$/g, '')
      .trim();
  }

  function convertTableToMarkdown(table) {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let markdown = '\n\n';
    let headerProcessed = false;

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('th, td');
      const cellContents = Array.from(cells).map(cell => {
        return cell.textContent.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ');
      });
      markdown += '| ' + cellContents.join(' | ') + ' |\n';
      if (!headerProcessed && (row.querySelector('th') || index === 0)) {
        const separator = cellContents.map(() => '---').join(' | ');
        markdown += '| ' + separator + ' |\n';
        headerProcessed = true;
      }
    });

    return markdown + '\n';
  }

  /**
   * 后处理 Markdown
   */
  function postProcessMarkdown(markdown) {
    let result = markdown;

    // ========== Step 1: 清理垃圾 ==========
    result = result.replace(/\.mw-parser-output[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
    result = result.replace(/⁠/g, '');

    // ========== Step 2: 转换数学标记为 $...$ ==========
    result = result.replace(/「MATH」([^「]+)「\/MATH」/g, function(match, latex) {
      return '$' + latex.trim() + '$';
    });

    // ========== Step 3: 处理斜体变量 *a*, *b*, *c* ==========
    // 单个字母的斜体 -> 数学变量
    result = result.replace(/\*([a-zA-Z])\*/g, function(match, letter) {
      return '$' + letter + '$';
    });
    
    // 2-3个字母的斜体变量 (排除常见单词)
    result = result.replace(/\*([a-zA-Z]{2,3})\*/g, function(match, letters) {
      const nonMath = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'its', 'two', 'also'];
      if (nonMath.includes(letters.toLowerCase())) {
        return '*' + letters + '*';
      }
      return '$' + letters + '$';
    });

    // ========== Step 4: 处理变量后的数字上标 ==========
    // $a$2 -> $a^2$
    result = result.replace(/\$([a-zA-Z]+)\$([0-9²³⁴⁵⁶⁷⁸⁹]+)/g, function(match, varName, exp) {
      const power = convertSuperscript(exp);
      return '$' + varName + '^' + power + '$';
    });

    // 独立的 a2, b2 (字母紧跟数字)
    result = result.replace(/\b([a-zA-Z])([²³⁴⁵⁶⁷⁸⁹])/g, function(match, letter, exp) {
      const power = convertSuperscript(exp);
      return '$' + letter + '^' + power + '$';
    });

    // ========== Step 5: 处理括号表达式+上标 ==========
    // (a + $b$)2 -> $(a + b)^2$
    result = result.replace(/\(([^)]+)\)([0-9²³⁴⁵⁶⁷⁸⁹]+)/g, function(match, inner, exp) {
      // 清理括号内的 $ 符号
      const cleanInner = inner.replace(/\$/g, '').trim();
      const power = convertSuperscript(exp);
      return '$('+cleanInner + ')^' + power + '$';
    });

    // ========== Step 6: 处理数字+变量 ==========
    // 2$ab$ -> $2ab$
    result = result.replace(/(\d+)\$([a-zA-Z]+)\$/g, '$$$1$2$$');

    // ========== Step 7: 合并相邻数学表达式 ==========
    for (let i = 0; i < 5; i++) {
      // $a$ + $b$ -> $a + b$
      result = result.replace(/\$([^$]+)\$\s*\+\s*\$([^$]+)\$/g, '$$$1 + $2$$');
      result = result.replace(/\$([^$]+)\$\s*[−–\-]\s*\$([^$]+)\$/g, '$$$1 - $2$$');
      result = result.replace(/\$([^$]+)\$\s*=\s*\$([^$]+)\$/g, '$$$1 = $2$$');
    }

    // ========== Step 8: 清理多余的 $ 符号 ==========
    // $$...$ 或 $...$$ -> $...$
    result = result.replace(/\$\$([^$\n]{1,50})\$(?!\$)/g, '$$$1$$');
    result = result.replace(/(?<!\$)\$([^$\n]{1,50})\$\$/g, '$$$1$$');
    
    // $$$ -> $
    result = result.replace(/\${3,}([^$]+)\${3,}/g, '$$$1$$');
    result = result.replace(/\${3,}/g, '$$');

    // ========== Step 9: 统一减号 ==========
    result = result.replace(/\$([^$]+)\$/g, function(match, inner) {
      return '$' + inner.replace(/[−–]/g, '-') + '$';
    });

    // ========== Step 10: 清理引用格式 ==========
    result = result.replace(/\^+\[(\d+)\]\^*/g, '^[$1]^');

    // ========== Step 11: 清理空行 ==========
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.trim();

    return result;
  }

  function convertSuperscript(str) {
    return String(str)
      .replace(/²/g, '2').replace(/³/g, '3').replace(/⁴/g, '4')
      .replace(/⁵/g, '5').replace(/⁶/g, '6').replace(/⁷/g, '7')
      .replace(/⁸/g, '8').replace(/⁹/g, '9').replace(/⁰/g, '0');
  }

  function convertHtmlToMarkdown(html) {
    const service = createTurndownService();
    let markdown = service.turndown(html);
    markdown = postProcessMarkdown(markdown);
    return markdown;
  }

  // ========== 监听复制事件 ==========
  document.addEventListener('copy', function(e) {
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

      const markdown = convertHtmlToMarkdown(html);

      e.clipboardData.setData('text/plain', markdown);
      e.clipboardData.setData('text/html', html);
      e.preventDefault();

      showNotification('已复制为 Markdown');
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

  console.log('Copy as Markdown extension loaded (v8)');
})();