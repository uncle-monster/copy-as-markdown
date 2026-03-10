/**
 * Copy as Markdown - Content Script (v10 - 修复表头)
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

    /**
   * 从单元格中提取内容（公式、文本、引用、上标）
   */
  function extractCellContent(cell) {
    // 先处理公式
    const annotations = cell.querySelectorAll('annotation');
    
    if (annotations.length > 0) {
      const formulas = [];
      annotations.forEach(ann => {
        let latex = ann.textContent.trim();
        if (latex) {
          latex = latex.replace(/^\{\\displaystyle\s*/, '').replace(/\}$/, '');
          formulas.push(latex);
        }
      });
      
      if (formulas.length > 0) {
        let refText = '';
        cell.querySelectorAll('sup.reference').forEach(sup => {
          const link = sup.querySelector('a');
          if (link) {
            refText += '^' + link.textContent.trim() + '^';
          }
        });
        return '$' + formulas.join(' ') + '$' + refText;
      }
    }

    // 查找 mwe-math-element
    const mathElements = cell.querySelectorAll('.mwe-math-element');
    if (mathElements.length > 0) {
      const formulas = [];
      mathElements.forEach(el => {
        const ann = el.querySelector('annotation');
        if (ann) {
          let latex = ann.textContent.trim();
          latex = latex.replace(/^\{?\\displaystyle\s*/, '').replace(/\}?$/, '');
          formulas.push(latex);
        }
      });
      if (formulas.length > 0) {
        let refText = '';
        cell.querySelectorAll('sup.reference').forEach(sup => {
          const link = sup.querySelector('a');
          if (link) {
            refText += '^' + link.textContent.trim() + '^';
          }
        });
        return '$' + formulas.join(' ') + '$' + refText;
      }
    }

    // 没有公式，创建副本处理
    const clone = cell.cloneNode(true);
    
    // 移除公式元素
    clone.querySelectorAll('.mwe-math-element').forEach(el => el.remove());
    clone.querySelectorAll('math').forEach(el => el.remove());
    
    // 处理引用上标：提取引用编号和页码
    let refInfo = null;
    clone.querySelectorAll('sup.reference').forEach(sup => {
      const link = sup.querySelector('a');
      if (link) {
        let refNum = link.textContent.trim().replace(/^\[|\]$/g, '');
        refInfo = { num: refNum, element: sup };
      }
    });
    
    // 如果有引用，获取后面的页码
    if (refInfo) {
      // 获取引用后的文本（可能包含页码）
      let afterText = '';
      let node = refInfo.element.nextSibling;
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          afterText += node.textContent;
        }
        node = node.nextSibling;
      }
      
      // 提取页码 : 782-783 或 :782-783
      afterText = afterText.replace(/[–—−]/g, '-');
      const pageMatch = afterText.match(/^[:\s]*(\d+)\s*-\s*(\d+)/);
      const singlePageMatch = afterText.match(/^[:\s]*(\d+)(?!\s*-)/);
      
      if (pageMatch) {
        refInfo.pages = pageMatch[1] + '-' + pageMatch[2];
        // 移除页码部分
        refInfo.element.nextSibling && (refInfo.element.nextSibling.textContent = 
          afterText.replace(/^[:\s]*\d+\s*-\s*\d+/, ''));
      } else if (singlePageMatch) {
        refInfo.pages = singlePageMatch[1];
        refInfo.element.nextSibling && (refInfo.element.nextSibling.textContent = 
          afterText.replace(/^[:\s]*\d+/, ''));
      }
      
      // 替换引用元素
      const refText = refInfo.pages 
        ? '【REF' + refInfo.num + ':' + refInfo.pages + 'REF】'
        : '【REF' + refInfo.num + 'REF】';
      refInfo.element.replaceWith(document.createTextNode(refText));
    }
    
    // 处理普通上标（纯数字）
    clone.querySelectorAll('sup').forEach(sup => {
      const content = sup.textContent.trim();
      if (/^\d+$/.test(content)) {
        const superscriptMap = {
          '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
          '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
        };
        let superText = '';
        for (const char of content) {
          superText += superscriptMap[char] || char;
        }
        sup.replaceWith(document.createTextNode(superText));
      }
    });
    
    // 处理下标（纯数字）
    clone.querySelectorAll('sub').forEach(sub => {
      const content = sub.textContent.trim();
      if (/^\d+$/.test(content)) {
        const subscriptMap = {
          '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
          '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        let subText = '';
        for (const char of content) {
          subText += subscriptMap[char] || char;
        }
        sub.replaceWith(document.createTextNode(subText));
      }
    });
    
    // 提取文本
    let text = clone.textContent.trim()
      .replace(/\|/g, '\\|')
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ');
    
    // 还原引用格式
    text = text.replace(/【REF(\d+):(\d+-\d+)REF】/g, '^[$1]:$2^');
    text = text.replace(/【REF(\d+):(\d+)REF】/g, '^[$1]:$2^');
    text = text.replace(/【REF(\d+)REF】/g, '^[$1]^');

    return text;
  }


    /**
   * 将表格转换为 Markdown
   */
  function convertTableToMarkdown(table) {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let markdown = '\n\n';
    
    // 处理表格标题 <caption>
    const caption = table.querySelector('caption');
    if (caption) {
      // 提取标题文字，可能包含公式
      let captionContent = extractCellContent(caption);
      // 移除编辑链接
      captionContent = captionContent.replace(/\s*\[编辑\]\s*/g, '').trim();
      if (captionContent) {
        markdown += '**' + captionContent + '**\n\n';
      }
    }

    let headerProcessed = false;

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('th, td');
      const cellContents = Array.from(cells).map(cell => extractCellContent(cell));

      markdown += '| ' + cellContents.join(' | ') + ' |\n';

      // 添加分隔行
      if (!headerProcessed) {
        const separator = cellContents.map(() => '---').join(' | ');
        markdown += '| ' + separator + ' |\n';
        headerProcessed = true;
      }
    });

    return markdown + '\n';
  }

  function createTurndownService() {
    const service = new TurndownService({
      headingStyle: config.headingStyle,
      codeBlockStyle: config.codeBlockStyle,
      bulletListMarker: '-',
      emDelimiter: '*'
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

    // 移除 Wikipedia 编辑链接
    service.addRule('removeEditLinks', {
      filter: function(node) {
        if (node.nodeName === 'SPAN' && node.classList) {
          return node.classList.contains('mw-editsection');
        }
        return false;
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

    service.addRule('katex', {
      filter: function(node) {
        return node.classList && node.classList.contains('katex');
      },
      replacement: function(content, node) {
        const annotation = node.querySelector('.katex-mathml annotation');
        if (annotation) {
          const latex = cleanLatex(annotation.textContent.trim());
          const isBlock = node.closest('.katex-display') !== null;
          if (isBlock) {
            return '\n\n$$\n' + latex + '\n$$\n\n';
          }
          return '「M」' + latex + '「/M」';
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
          const latex = cleanLatex(script.textContent.trim());
          const isBlock = script.type.includes('mode=display');
          if (isBlock) {
            return '\n\n$$\n' + latex + '\n$$\n\n';
          }
          return '「M」' + latex + '「/M」';
        }
        return content;
      }
    });

    service.addRule('mathml', {
      filter: 'math',
      replacement: function(content, node) {
        const annotation = node.querySelector('annotation[encoding*="tex"], annotation[encoding*="latex"]');
        if (annotation) {
          const latex = cleanLatex(annotation.textContent.trim());
          const isBlock = node.getAttribute('display') === 'block';
          if (isBlock) {
            return '\n\n$$\n' + latex + '\n$$\n\n';
          }
          return '「M」' + latex + '「/M」';
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
          const latex = cleanLatex(annotation.textContent.trim());
          const isBlock = node.querySelector('.mwe-math-fallback-image-display') !== null;
          if (isBlock) {
            return '\n\n$$\n' + latex + '\n$$\n\n';
          }
          return '「M」' + latex + '「/M」';
        }
        return content;
      }
    });

    service.addRule('wikipediaFraction', {
      filter: function(node) {
        return node.classList && node.classList.contains('sfrac');
      },
      replacement: function(content, node) {
        const num = node.querySelector('.num');
        const den = node.querySelector('.den');
        if (num && den) {
          return '「M」\\frac{' + num.textContent.trim() + '}{' + den.textContent.trim() + '}「/M」';
        }
        return content;
      }
    });

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

    // ========== 表格 ==========
    if (config.preserveTables) {
      service.addRule('table', {
        filter: 'table',
        replacement: function(content, node) {
          return convertTableToMarkdown(node);
        }
      });
    }

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

  function cleanLatex(latex) {
    return latex.trim()
      .replace(/^\{\\displaystyle\s*/, '')
      .replace(/\}$/, '')
      .replace(/^\\\[|\\\]$/g, '')
      .replace(/^\\\(|\\\)$/g, '')
      .replace(/^\$\$|\$\$$/g, '')
      .replace(/^\$|\$$/g, '')
      .trim();
  }

    /**
   * 后处理 Markdown
   */
  function postProcessMarkdown(markdown) {
    let result = markdown;

    // ========== Step 0: 统一特殊字符（最先执行）==========
    result = result.replace(/–/g, '-');  // en-dash U+2013
    result = result.replace(/—/g, '-');  // em-dash U+2014
    result = result.replace(/−/g, '-');  // minus sign U+2212

    // ========== Step 1: 清理垃圾 ==========
    result = result.replace(/\.mw-parser-output[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
    result = result.replace(/⁠/g, '');
    
    // 移除 [编辑] 链接
    result = result.replace(/\s*\\\[\[编辑\]\([^\)]+\)\\\]\s*/g, '');
    result = result.replace(/\s*\[编辑\]\([^\)]+\)\s*/g, '');
    result = result.replace(/\s*\\\[\s*\[编辑\][^\]]*\]\s*/g, '');

    // ========== Step 2: 转换数学标记 ==========
    result = result.replace(/「M」([^「]+)「\/M」/g, function(match, latex) {
      return '$' + latex.trim() + '$';
    });

    // ========== Step 2.5: 清理 LaTeX 公式 ==========
    result = result.replace(/\$([^$]+)\$/g, function(match, inner) {
      return '$' + cleanLatexContent(inner) + '$';
    });
    
    result = result.replace(/\$\$\n?([\s\S]+?)\n?\$\$/g, function(match, inner) {
      return '$$\n' + cleanLatexContent(inner) + '\n$$';
    });

    // ========== Step 3: 处理斜体变量 ==========
    result = result.replace(/\*([a-zA-Z])\*/g, function(match, letter) {
      return '$' + letter + '$';
    });
    
    result = result.replace(/\*([a-zA-Z]{2,3})\*/g, function(match, letters) {
      const nonMath = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'its', 'two', 'also'];
      if (nonMath.includes(letters.toLowerCase())) {
        return '*' + letters + '*';
      }
      return '$' + letters + '$';
    });

    // ========== Step 4: 处理上标 ==========
    result = result.replace(/\$([a-zA-Z]+)\$([0-9²³⁴⁵⁶⁷⁸⁹]+)/g, function(match, varName, exp) {
      return '$' + varName + '^' + convertSuperscript(exp) + '$';
    });

    result = result.replace(/\b([a-zA-Z])([²³⁴⁵⁶⁷⁸⁹])/g, function(match, letter, exp) {
      return '$' + letter + '^' + convertSuperscript(exp) + '$';
    });

    // ========== Step 5: 处理括号+上标 ==========
    result = result.replace(/\(([^)]+)\)([0-9²³⁴⁵⁶⁷⁸⁹]+)/g, function(match, inner, exp) {
      const cleanInner = inner.replace(/\$/g, '').trim();
      return '$(' + cleanInner + ')^' + convertSuperscript(exp) + '$';
    });

    // ========== Step 6: 数字+变量 ==========
    result = result.replace(/(\d+)\$([a-zA-Z]+)\$/g, '$$$1$2$$');

    // ========== Step 7: 合并相邻公式 ==========
    for (let i = 0; i < 5; i++) {
      result = result.replace(/\$([^$]+)\$\s*\+\s*\$([^$]+)\$/g, '$$$1 + $2$$');
      result = result.replace(/\$([^$]+)\$\s*-\s*\$([^$]+)\$/g, '$$$1 - $2$$');
      result = result.replace(/\$([^$]+)\$\s*=\s*\$([^$]+)\$/g, '$$$1 = $2$$');
    }

    // ========== Step 8: 清理多余 $ ==========
    result = result.replace(/\$\$([^$\n]{1,50})\$(?!\$)/g, '$$$1$$');
    result = result.replace(/(?<!\$)\$([^$\n]{1,50})\$\$/g, '$$$1$$');
    result = result.replace(/\${3,}/g, '$$');

    // ========== Step 9: 已在 Step 0 处理减号 ==========

    // ========== Step 10: 清理引用格式 ==========
    // ^[注3]^[8]^: 209-213 -> ^[注3][8]:209-213^
    result = result.replace(/\^\[注(\d+)\]\^\[(\d+)\]\^:\s*(\d+)-(\d+)/g, '^[注$1][$2]:$3-$4^');
    
    // ^[注3]^[8]^ -> ^[注3][8]^
    result = result.replace(/\^\[注(\d+)\]\^\[(\d+)\]\^/g, '^[注$1][$2]^');
    
    // ]^[ -> ][
    result = result.replace(/\]\^\[/g, '][');
    
    // ]^: -> ]:
    result = result.replace(/\]\^:\s*/g, ']:');
    
    // 页码末尾加 ^
    result = result.replace(/:(\d+)-(\d+)([^\^])/g, ':$1-$2^$3');
    result = result.replace(/:(\d+)-(\d+)$/gm, ':$1-$2^');
    
    // 清理 ^^
    result = result.replace(/\^\^+/g, '^');

    // ========== Step 11: 清理空行 ==========
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.trim();

    return result;
  }

    /**
   * 清理 LaTeX 内容
   */
  function cleanLatexContent(latex) {
    let cleaned = latex
      .replace(/\\([a-zA-Z]+)\s+\{/g, '\\$1{')
      .replace(/\}\s+\{/g, '}{')
      .replace(/\}\s+_/g, '}_')
      .replace(/\}\s+\^/g, '}^')
      .replace(/_\s+\{/g, '_{')
      .replace(/\^\s+\{/g, '^{')
      .replace(/\s+\}/g, '}')
      .replace(/\{\s+/g, '{')
      .replace(/\\[\s]*$/g, '')      // 关键：清理末尾的 \
      .replace(/\\ $/g, '')          // 关键：清理末尾的 "\ "
      .replace(/^\s+/, '')
      .replace(/\s+$/, '')
      .replace(/[−–]/g, '-');
    return cleaned;
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

  console.log('Copy as Markdown extension loaded (v10)');
})();