/**
 * Copy as Markdown - Content Script (v6 - 修复分数连接问题)
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
      emDelimiter: '_'
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

    // ========== 数学公式规则 ==========

    service.addRule('katex', {
      filter: function(node) {
        return node.classList && node.classList.contains('katex');
      },
      replacement: function(content, node) {
        const annotation = node.querySelector('.katex-mathml annotation');
        if (annotation) {
          const latex = annotation.textContent.trim();
          const isBlock = node.closest('.katex-display') !== null;
          return formatMath(latex, isBlock);
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
          return formatMath(annotation.textContent.trim(), true);
        }
        return content;
      }
    });

    service.addRule('mathjax2', {
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
          const isBlock = script.type.includes('mode=display') || 
                          node.classList.contains('MathJax_Display');
          return formatMath(script.textContent.trim(), isBlock);
        }
        return content;
      }
    });

    service.addRule('mathjax3', {
      filter: function(node) {
        return node.tagName && node.tagName.toLowerCase() === 'mjx-container';
      },
      replacement: function(content, node) {
        let latex = node.getAttribute('data-latex');
        if (!latex) {
          const assistant = node.querySelector('mjx-assistive-mml annotation');
          if (assistant) latex = assistant.textContent;
        }
        if (latex) {
          const isBlock = node.hasAttribute('display') && 
                          node.getAttribute('display') === 'true';
          return formatMath(latex, isBlock);
        }
        return content;
      }
    });

    service.addRule('mathml', {
      filter: 'math',
      replacement: function(content, node) {
        const annotation = node.querySelector('annotation[encoding*="tex"], annotation[encoding*="latex"]');
        if (annotation) {
          const isBlock = node.getAttribute('display') === 'block';
          return formatMath(annotation.textContent.trim(), isBlock);
        }
        return content;
      }
    });

    service.addRule('wikipedia-math', {
      filter: function(node) {
        return node.classList && node.classList.contains('mwe-math-element');
      },
      replacement: function(content, node) {
        const annotation = node.querySelector('annotation');
        if (annotation) {
          const isBlock = node.querySelector('.mwe-math-fallback-image-display') !== null;
          return formatMath(annotation.textContent.trim(), isBlock);
        }
        const img = node.querySelector('img');
        if (img && img.alt) {
          const isBlock = img.classList.contains('mwe-math-fallback-image-display');
          return formatMath(img.alt, isBlock);
        }
        return content;
      }
    });

    // Wikipedia 分数 - 使用特殊标记，后处理时合并
    service.addRule('wikipediaFraction', {
      filter: function(node) {
        return node.classList && node.classList.contains('sfrac');
      },
      replacement: function(content, node) {
        const num = node.querySelector('.num');
        const den = node.querySelector('.den');
        if (num && den) {
          return '⟪FRAC:' + num.textContent.trim() + '/' + den.textContent.trim() + ':FRAC⟫';
        }
        const text = node.textContent.trim();
        const match = text.match(/(\d+)\/(\d+)/);
        if (match) {
          return '⟪FRAC:' + match[1] + '/' + match[2] + ':FRAC⟫';
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
          const text = link.textContent.trim();
          return '^' + text + '^';
        }
        return content;
      }
    });

    // 斜体数学变量
    service.addRule('italicMathVar', {
      filter: function(node) {
        if (!config.convertItalicMath) return false;
        if (node.nodeName !== 'I' && node.nodeName !== 'EM') return false;
        const text = node.textContent.trim();
        if (/^[a-zA-Z]$/.test(text)) return true;
        if (/^[a-zA-Z]{2,3}$/.test(text) && !/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out)$/i.test(text)) return true;
        return false;
      },
      replacement: function(content, node) {
        const text = node.textContent.trim();
        return '⟦' + text + '⟧';
      }
    });

        // ========== 删除线 ==========
    service.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function(content) {
        return '~~' + content + '~~';
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

  function formatMath(latex, isBlock) {
    latex = latex.trim()
      .replace(/^\\\[|\\\]$/g, '')
      .replace(/^\\\(|\\\)$/g, '')
      .replace(/^\$\$|\$\$$/g, '')
      .replace(/^\$|\$$/g, '')
      .trim();

    if (isBlock) {
      return `\n\n${config.blockMathDelimiter}\n${latex}\n${config.blockMathDelimiter}\n\n`;
    }
    return `${config.inlineMathDelimiter}${latex}${config.inlineMathDelimiter}`;
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

    // ========== Step 1: 清理垃圾内容 ==========
    result = result.replace(/\.mw-parser-output[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
    result = result.replace(/\{[^}]*white-space:[^}]*\}/g, '');
    result = result.replace(/⁠/g, '');

    // ========== Step 2: 处理分数+后续变量 ==========
    // ⟪FRAC:1/2:FRAC⟫ab → $\frac{1}{2}ab$
    // ⟪FRAC:1/2:FRAC⟫$ab$ → $\frac{1}{2}ab$
    // ⟪FRAC:1/2:FRAC⟫⟦ab⟧ → $\frac{1}{2}ab$
    result = result.replace(/⟪FRAC:(\d+)\/(\d+):FRAC⟫\s*\$?⟦?([a-zA-Z]+)⟧?\$?/g, 
      '$\\frac{$1}{$2}$3$');
    
    // 单独的分数
    result = result.replace(/⟪FRAC:(\d+)\/(\d+):FRAC⟫/g, '$\\frac{$1}{$2}$');

    // ========== Step 3: 转换特殊标记的变量 ==========
    result = result.replace(/⟦([a-zA-Z]+)⟧/g, function(match, varName) {
      const nonMathWords = ['a', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we', 'and', 'the', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out'];
      if (nonMathWords.includes(varName.toLowerCase())) {
        return varName;
      }
      return '$' + varName + '$';
    });

    // ========== Step 4: 处理括号+上标 ==========
    result = result.replace(/\(([^)]+)\)([²³⁴⁵⁶⁷⁸⁹0-9]+)/g, function(match, inner, exp) {
      let cleanInner = inner.replace(/\$/g, '').trim();
      let power = convertSuperscript(exp);
      return '$(' + cleanInner + ')^' + power + '$';
    });

    // ========== Step 5: 处理变量+上标 ==========
    result = result.replace(/\$([a-zA-Z]+)\$([²³⁴⁵⁶⁷⁸⁹0-9]+)/g, function(match, varName, exp) {
      let power = convertSuperscript(exp);
      return '$' + varName + '^' + power + '$';
    });

    // 纯文本变量+Unicode上标
    result = result.replace(/\b([a-z])\s*([²³⁴⁵⁶⁷⁸⁹])/g, function(match, varName, exp) {
      let power = convertSuperscript(exp);
      return '$' + varName + '^' + power + '$';
    });

    // ========== Step 6: 合并相邻数学表达式 ==========
    for (let i = 0; i < 3; i++) {
      result = result.replace(/\$([^$]+)\$\s*\+\s*\$([^$]+)\$/g, '$$$1 + $2$$');
      result = result.replace(/\$([^$]+)\$\s*[−–\-]\s*\$([^$]+)\$/g, '$$$1 - $2$$');
      result = result.replace(/\$([^$]+)\$\s*=\s*\$([^$]+)\$/g, '$$$1 = $2$$');
    }

    // ========== Step 7: 处理混合情况 ==========
    result = result.replace(/\b([a-z])\s*\+\s*\$([a-z])\$/g, '$$$1 + $2$$');
    result = result.replace(/\$([a-z])\$\s*\+\s*([a-z])\b/g, '$$$1 + $2$$');
    result = result.replace(/\b([a-z])\s*[−–\-]\s*\$([a-z])\$/g, '$$$1 - $2$$');
    result = result.replace(/\$([a-z])\$\s*[−–\-]\s*([a-z])\b/g, '$$$1 - $2$$');

    // ========== Step 8: 清理引用格式 ==========
    result = result.replace(/\^+\[(\d+)\]\^*/g, '^[$1]^');

    // ========== Step 9: 修复连续/嵌套的 $ 符号 ==========
    // $...$ab$ → $...ab$ (分数后面跟变量的情况)
    result = result.replace(/\$([^$]+)\$([a-z]+)\$/g, '$$$1$2$$');
    
    // $$...$ 或 $...$$ → $...$
    result = result.replace(/\$\$([^$\n]+)\$/g, '$$$1$$');
    result = result.replace(/\$([^$\n]+)\$\$/g, '$$$1$$');
    
    // $$$...$$$ → $...$
    result = result.replace(/\${3,}([^$]+)\${3,}/g, '$$$1$$');

    // ========== Step 10: 统一减号 ==========
    // 在 $ $ 内部统一使用标准减号
    result = result.replace(/\$([^$]+)\$/g, function(match, inner) {
      return '$' + inner.replace(/[−–]/g, '-') + '$';
    });

    // ========== Step 11: 清理空行和空格 ==========
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.replace(/  +/g, ' ');
    result = result.trim();

    return result;
  }

  function convertSuperscript(str) {
    return str
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

  console.log('Copy as Markdown extension loaded (v6)');
})();