/**
 * Copy as Markdown - Content Script (v11 - 多网站支持)
 */

(function() {
  'use strict';

  // ========== 配置 ==========
  let config = {
    enabled: true,
    inlineMathDelimiter: '$',
    blockMathDelimiter: '$$',
    preserveImages: true,
    preserveTables: true,
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
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

  // ========== 网���检测 ==========
  function detectSite() {
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('wikipedia.org') || hostname.includes('wikimedia.org')) {
      return 'wikipedia';
    }
    if (hostname.includes('codeforces.com')) {
      return 'codeforces';
    }
    if (hostname.includes('leetcode.com') || hostname.includes('leetcode.cn')) {
      return 'leetcode';
    }
    if (hostname.includes('stackoverflow.com') || hostname.includes('stackexchange.com')) {
      return 'stackoverflow';
    }
    if (hostname.includes('github.com')) {
      return 'github';
    }
    if (hostname.includes('zhihu.com')) {
      return 'zhihu';
    }
    if (hostname.includes('csdn.net')) {
      return 'csdn';
    }
    if (hostname.includes('juejin.cn')) {
      return 'juejin';
    }
    if (hostname.includes('notion.so') || hostname.includes('notion.site')) {
      return 'notion';
    }
    if (hostname.includes('arxiv.org')) {
      return 'arxiv';
    }
    if (hostname.includes('overleaf.com')) {
      return 'overleaf';
    }
    if (hostname.includes('mathjax') || document.querySelector('.MathJax')) {
      return 'mathjax';
    }
    if (document.querySelector('.katex')) {
      return 'katex';
    }
    
    return 'default';
  }

  // ========== 网站特定配置 ==========
  const siteConfigs = {
    // Wikipedia 配置
    wikipedia: {
      mathSelector: '.mwe-math-element annotation',
      mathDisplaySelector: '.mwe-math-fallback-image-display',
      removeSelectors: ['.mw-editsection', '.reference', 'style', '.sr-only'],
      hasFractions: true,
      hasReferences: true,
      postProcess: ['cleanEditLinks', 'cleanReferences', 'cleanLatexSpaces']
    },
    
    // Codeforces 配置
    codeforces: {
      mathSelector: 'script[type*="math/tex"]',
      mathDisplaySelector: 'script[type*="mode=display"]',
      removeSelectors: ['.MathJax_Preview', '.MathJax', '.mjx-chtml'],
      hasDoubleMath: true,  // 公式会重复显示
      postProcess: ['cleanDoubleMath', 'cleanLatexSpaces']
    },
    
    // LeetCode 配置
    leetcode: {
      mathSelector: '.katex-mathml annotation',
      mathDisplaySelector: '.katex-display',
      removeSelectors: ['.katex-html'],
      postProcess: ['cleanLatexSpaces']
    },
    
    // Stack Overflow 配置
    stackoverflow: {
      mathSelector: 'script[type*="math/tex"]',
      mathDisplaySelector: '.MathJax_Display',
      removeSelectors: ['.MathJax_Preview'],
      hasCodeBlocks: true,
      postProcess: ['cleanLatexSpaces']
    },
    
    // 知乎配置
    zhihu: {
      mathSelector: '.ztext-math',
      mathDisplaySelector: '.ztext-math[data-display="block"]',
      removeSelectors: [],
      postProcess: ['cleanLatexSpaces']
    },
    
    // GitHub 配置
    github: {
      mathSelector: 'math annotation',
      mathDisplaySelector: 'math[display="block"]',
      removeSelectors: [],
      hasCodeBlocks: true,
      postProcess: []
    },
    
    // CSDN 配置
    csdn: {
      mathSelector: '.katex-mathml annotation',
      mathDisplaySelector: '.katex-display',
      removeSelectors: ['.katex-html'],
      postProcess: ['cleanLatexSpaces']
    },
    
    // Notion 配置
    notion: {
      mathSelector: '.notion-equation-block annotation',
      mathDisplaySelector: '.notion-equation-block',
      removeSelectors: [],
      postProcess: ['cleanLatexSpaces']
    },
    
    // arXiv 配置
    arxiv: {
      mathSelector: 'script[type*="math/tex"]',
      mathDisplaySelector: 'script[type*="mode=display"]',
      removeSelectors: ['.MathJax_Preview', '.MathJax'],
      postProcess: ['cleanLatexSpaces']
    },
    
    // 默认配置（通用 MathJax/KaTeX）
    default: {
      mathSelector: 'annotation[encoding*="tex"], script[type*="math/tex"]',
      mathDisplaySelector: '.MathJax_Display, .katex-display',
      removeSelectors: ['.MathJax_Preview', '.katex-html'],
      postProcess: ['cleanLatexSpaces']
    },
    
    // 纯 MathJax 网站
    mathjax: {
      mathSelector: 'script[type*="math/tex"]',
      mathDisplaySelector: 'script[type*="mode=display"]',
      removeSelectors: ['.MathJax_Preview', '.MathJax'],
      postProcess: ['cleanLatexSpaces']
    },
    
    // 纯 KaTeX 网站
    katex: {
      mathSelector: '.katex-mathml annotation',
      mathDisplaySelector: '.katex-display',
      removeSelectors: ['.katex-html'],
      postProcess: ['cleanLatexSpaces']
    }
  };

  // ========== 获取当前网站配置 ==========
  function getSiteConfig() {
    const site = detectSite();
    console.log('Detected site:', site);
    return { site, config: siteConfigs[site] || siteConfigs.default };
  }

  // ========== 清理 LaTeX 内容 ==========
  function cleanLatexContent(latex) {
    if (!latex) return '';
    // 仅当公式以 {\displaystyle 开头且以 } 结尾时，成对剥离最外层
    if (latex.startsWith('{\\displaystyle') && latex.endsWith('}')) {
      latex = latex.substring(15, latex.length - 1);
    }
    return latex
      .replace(/[−–—]/g, '-') // 统一减号字符
      .replace(/\\([a-zA-Z]+)\s+\{/g, '\\$1{') // 修复 LaTeX 里的多余空格
      .trim();
  }

  // ========== 创建 Turndown 服务 ==========
  function createTurndownService(siteInfo) {
    const service = new TurndownService({
      headingStyle: config.headingStyle,
      codeBlockStyle: config.codeBlockStyle,
      bulletListMarker: '-',
      emDelimiter: '*'
    });

    const siteConfig = siteInfo.config;

    // 移除不需要的元素
    if (siteConfig.removeSelectors) {
      service.addRule('removeUnwanted', {
        filter: function(node) {
          return siteConfig.removeSelectors.some(selector => {
            try {
              return node.matches && node.matches(selector);
            } catch (e) {
              return false;
            }
          });
        },
        replacement: function() { return ''; }
      });
    }

    // 删除线
    service.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function(content) {
        return '~~' + content + '~~';
      }
    });

    // ========== 数学公式处理（根据网站类型）==========
    
    // Wikipedia 公式
    if (siteInfo.site === 'wikipedia') {
      service.addRule('wikipediaMath', {
        filter: function(node) {
          return node.classList && node.classList.contains('mwe-math-element');
        },
        replacement: function(content, node) {
          const annotation = node.querySelector('annotation');
          if (annotation) {
            const latex = cleanLatexContent(annotation.textContent.trim());
            const isBlock = node.querySelector('.mwe-math-fallback-image-display') !== null;
            if (isBlock) {
              return '\n\n$$\n' + latex + '\n$$\n\n';
            }
            return '$' + latex + '$';
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
            return '$\\frac{' + num.textContent.trim() + '}{' + den.textContent.trim() + '}$';
          }
          return content;
        }
      });

      // Wikipedia 引用
      service.addRule('wikipediaReference', {
        filter: function(node) {
          return node.nodeName === 'SUP' && node.classList && node.classList.contains('reference');
        },
        // 不保留引用
        // replacement: function(content, node) {
        //   const link = node.querySelector('a');
        //   if (link) {
        //     return '^' + link.textContent.trim() + '^';
        //   }
        //   return content;
        // }
        replacement: function() { 
          return ''; // 返回空字符串，不保留任何引用标记
        }
      });

      // 移除编辑链接
      service.addRule('removeEditSection', {
        filter: function(node) {
          return node.classList && node.classList.contains('mw-editsection');
        },
        replacement: function() { return ''; }
      });
    }

    // Codeforces 公式和代码块
    if (siteInfo.site === 'codeforces') {
      // MathJax script 标签中的公式
      service.addRule('codeforcesMathScript', {
        filter: function(node) {
          return node.tagName === 'SCRIPT' && node.type && node.type.includes('math/tex');
        },
        replacement: function(content, node) {
          const latex = node.textContent.trim();
          const isBlock = node.type.includes('mode=display');
          if (isBlock) {
            return '\n\n$$\n' + cleanLatexContent(latex) + '\n$$\n\n';
          }
          return '「CF」' + cleanLatexContent(latex) + '「/CF」';
        }
      });

      // 移除 MathJax 渲染元素
      service.addRule('codeforcesMathJax', {
        filter: function(node) {
          if (!node.classList) return false;
          return node.classList.contains('MathJax') || 
                 node.classList.contains('MathJax_Preview') ||
                 node.classList.contains('MathJax_Display') ||
                 node.classList.contains('MathJax_SVG') ||
                 node.classList.contains('MathJax_SVG_Display');
        },
        replacement: function() { return ''; }
      });

      // 代码块 - 用 innerHTML 处理 <br>
      // 优化后的代码块处理逻辑
      service.addRule('universalCodeBlock', {
        filter: function(node) {
          // 匹配 pre 标签，或者 codeforces 特有的 input/output 类
          return node.nodeName === 'PRE' || node.classList.contains('input') || node.classList.contains('output');
        },
        replacement: function(content, node) {
          // 1. 克隆节点以免影响页面显示
          let clone = node.cloneNode(true);

          // 2. 处理特殊的换行标签：将 <br>, <p>, <div> 替换为换行占位符
          // 许多 OJ 网站（如 Codeforces）的代码块换行是靠这些标签实现的
          clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
          clone.querySelectorAll('p, div').forEach(block => {
            block.prepend('\n');
            block.append('\n');
          });

          // 3. 获取处理后的文本
          let code = clone.innerText || clone.textContent || '';

          // 4. 清理多余的空行和首尾空格
          code = code.replace(/\n{3,}/g, '\n\n').trim();

          // 5. 根据父容器判断语言（可选）
          let language = '';
          const codeTag = node.querySelector('code');
          if (codeTag && codeTag.className) {
            const match = codeTag.className.match(/(?:language-|lang-)(\w+)/);
            if (match) language = match[1];
          }

          return '\n\n```' + language + '\n' + code + '\n```\n\n';
        }
      });
    }

    // KaTeX 公式（LeetCode, CSDN 等）
    if (['leetcode', 'csdn', 'katex'].includes(siteInfo.site)) {
      service.addRule('katexMath', {
        filter: function(node) {
          return node.classList && node.classList.contains('katex');
        },
        replacement: function(content, node) {
          const annotation = node.querySelector('.katex-mathml annotation');
          if (annotation) {
            const latex = cleanLatexContent(annotation.textContent.trim());
            const isBlock = node.closest('.katex-display') !== null;
            if (isBlock) {
              return '\n\n$$\n' + latex + '\n$$\n\n';
            }
            return '$' + latex + '$';
          }
          return content;
        }
      });

      service.addRule('katexDisplay', {
        filter: function(node) {
          return node.classList && node.classList.contains('katex-display');
        },
        replacement: function(content, node) {
          const annotation = node.querySelector('.katex-mathml annotation');
          if (annotation) {
            return '\n\n$$\n' + cleanLatexContent(annotation.textContent.trim()) + '\n$$\n\n';
          }
          return content;
        }
      });
    }

    // 知乎公式
    if (siteInfo.site === 'zhihu') {
      service.addRule('zhihuMath', {
        filter: function(node) {
          return node.classList && node.classList.contains('ztext-math');
        },
        replacement: function(content, node) {
          const latex = node.getAttribute('data-tex') || node.textContent.trim();
          const isBlock = node.getAttribute('data-display') === 'block';
          if (isBlock) {
            return '\n\n$$\n' + cleanLatexContent(latex) + '\n$$\n\n';
          }
          return '$' + cleanLatexContent(latex) + '$';
        }
      });
    }

    // GitHub 公式
    if (siteInfo.site === 'github') {
      service.addRule('githubMath', {
        filter: 'math',
        replacement: function(content, node) {
          const annotation = node.querySelector('annotation[encoding*="tex"]');
          if (annotation) {
            const latex = cleanLatexContent(annotation.textContent.trim());
            const isBlock = node.getAttribute('display') === 'block';
            if (isBlock) {
              return '\n\n$$\n' + latex + '\n$$\n\n';
            }
            return '$' + latex + '$';
          }
          return content;
        }
      });
    }

    // 通用 MathJax 处理
    if (['mathjax', 'stackoverflow', 'arxiv', 'default'].includes(siteInfo.site)) {
      service.addRule('mathjaxScript', {
        filter: function(node) {
          return node.tagName === 'SCRIPT' && node.type && node.type.includes('math/tex');
        },
        replacement: function(content, node) {
          const latex = node.textContent.trim();
          const isBlock = node.type.includes('mode=display');
          if (isBlock) {
            return '\n\n$$\n' + cleanLatexContent(latex) + '\n$$\n\n';
          }
          return '$' + cleanLatexContent(latex) + '$';
        }
      });

      service.addRule('mathjaxPreview', {
        filter: function(node) {
          return node.classList && (
            node.classList.contains('MathJax') ||
            node.classList.contains('MathJax_Preview') ||
            node.classList.contains('MathJax_Display')
          );
        },
        replacement: function() { return ''; }
      });
    }

    // ========== 通用代码块（非 Codeforces）==========
    if (siteInfo.site !== 'codeforces') {
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
    }

    // ========== 表格 ==========
    if (config.preserveTables) {
      service.addRule('table', {
        filter: 'table',
        replacement: function(content, node) {
          return convertTableToMarkdown(node, siteInfo);
        }
      });
    }

    // ========== 图片 ==========
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

  // ========== 表格转换 ==========
  function convertTableToMarkdown(table, siteInfo) {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let markdown = '\n\n';
    
    // 处理表格标题
    const caption = table.querySelector('caption');
    if (caption) {
      let captionContent = extractCellContent(caption, siteInfo);
      captionContent = captionContent.replace(/\s*\[编辑\]\s*/g, '').trim();
      if (captionContent) {
        markdown += '**' + captionContent + '**\n\n';
      }
    }

    let headerProcessed = false;

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('th, td');
      const cellContents = Array.from(cells).map(cell => extractCellContent(cell, siteInfo));

      markdown += '| ' + cellContents.join(' | ') + ' |\n';

      if (!headerProcessed) {
        const separator = cellContents.map(() => '---').join(' | ');
        markdown += '| ' + separator + ' |\n';
        headerProcessed = true;
      }
    });

    return markdown + '\n';
  }

  // ========== 提取单元格内容 ==========
  function extractCellContent(cell, siteInfo) {
    // 1. 优先提取公式
    const annotations = cell.querySelectorAll('annotation');
    if (annotations.length > 0) {
      const formulas = [];
      annotations.forEach(ann => {
        let latex = ann.textContent.trim();
        if (latex) {
          // 使用上面修改后的 cleanLatexContent
          formulas.push(cleanLatexContent(latex));
        }
      });
      // 如果单元格内有公式，直接返回带 $ 的格式，避免后续 textContent 干扰
      if (formulas.length > 0) {
        return '$' + formulas.join(' ') + '$';
      }
    }

    // 处理 mwe-math-element
    const mathElements = cell.querySelectorAll('.mwe-math-element');
    if (mathElements.length > 0) {
      const formulas = [];
      mathElements.forEach(el => {
        const ann = el.querySelector('annotation');
        if (ann) {
          formulas.push(cleanLatexContent(ann.textContent.trim()));
        }
      });
      if (formulas.length > 0) {
        return '$' + formulas.join(' ') + '$';
      }
    }

    // 处理纯文本和引用
    const clone = cell.cloneNode(true);
    
    clone.querySelectorAll('.mwe-math-element, math').forEach(el => el.remove());
    
    // 处理引用
    // let refInfo = null;
    // clone.querySelectorAll('sup.reference').forEach(sup => {
    //   const link = sup.querySelector('a');
    //   if (link) {
    //     let refNum = link.textContent.trim().replace(/^\[|\]$/g, '');
    //     refInfo = { num: refNum, element: sup };
    //   }
    // });
    
    // if (refInfo) {
    //   let afterText = '';
    //   let node = refInfo.element.nextSibling;
    //   while (node) {
    //     if (node.nodeType === Node.TEXT_NODE) {
    //       afterText += node.textContent;
    //     }
    //     node = node.nextSibling;
    //   }
      
    //   afterText = afterText.replace(/[–—−]/g, '-');
    //   const pageMatch = afterText.match(/^[:\s]*(\d+)\s*-\s*(\d+)/);
      
    //   if (pageMatch) {
    //     refInfo.pages = pageMatch[1] + '-' + pageMatch[2];
    //     if (refInfo.element.nextSibling) {
    //       refInfo.element.nextSibling.textContent = afterText.replace(/^[:\s]*\d+\s*-\s*\d+/, '');
    //     }
    //   }
      
    //   const refText = refInfo.pages 
    //     ? '【REF' + refInfo.num + ':' + refInfo.pages + 'REF】'
    //     : '【REF' + refInfo.num + 'REF】';
    //   refInfo.element.replaceWith(document.createTextNode(refText));
    // }

    // 统一去掉注释上标：直接移除所有带有 reference 类名的 sup 元素
    clone.querySelectorAll('sup.reference').forEach(sup => sup.remove());

    // 同时移除单元格内可能残留的 annotation 之外的数学引用干扰（可选）
    clone.querySelectorAll('.mw-reftooltip-cite').forEach(el => el.remove());
    
    // 处理普通上标
    clone.querySelectorAll('sup').forEach(sup => {
      const content = sup.textContent.trim();
      if (/^\d+$/.test(content)) {
        const superscriptMap = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
        let superText = '';
        for (const char of content) {
          superText += superscriptMap[char] || char;
        }
        sup.replaceWith(document.createTextNode(superText));
      }
    });
    
    // 处理下标
    clone.querySelectorAll('sub').forEach(sub => {
      const content = sub.textContent.trim();
      if (/^\d+$/.test(content)) {
        const subscriptMap = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
        let subText = '';
        for (const char of content) {
          subText += subscriptMap[char] || char;
        }
        sub.replaceWith(document.createTextNode(subText));
      }
    });
    
    let text = clone.textContent.trim()
      .replace(/\|/g, '\\|')
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ');
    
    // 还原引用格式
    text = text.replace(/【REF(\d+):(\d+-\d+)REF】/g, '^[$1]:$2^');
    text = text.replace(/【REF(\d+)REF】/g, '^[$1]^');

    return text;
  }

  // ========== 后处理函数集 ==========
  const postProcessors = {
    // 清理编辑链接
    cleanEditLinks: function(text) {
      return text
        .replace(/\s*\\\[\[编辑\]\([^\)]+\)\\\]\s*/g, '')
        .replace(/\s*\[编辑\]\([^\)]+\)\s*/g, '');
    },

    // 清理引用格式
    cleanReferences: function(text) {
      let result = text;
      result = result.replace(/\^\[注(\d+)\]\^\[(\d+)\]\^:\s*(\d+)-(\d+)/g, '^[注$1][$2]:$3-$4^');
      result = result.replace(/\^\[注(\d+)\]\^\[(\d+)\]\^/g, '^[注$1][$2]^');
      result = result.replace(/\]\^\[/g, '][');
      result = result.replace(/\]\^:\s*/g, ']:');
      result = result.replace(/:(\d+)-(\d+)([^\^])/g, ':$1-$2^$3');
      result = result.replace(/:(\d+)-(\d+)$/gm, ':$1-$2^');
      result = result.replace(/\^\^+/g, '^');
      return result;
    },

    // 清理 LaTeX 空格
    cleanLatexSpaces: function(text) {
      return text.replace(/\$([^$]+)\$/g, function(match, inner) {
        return '$' + cleanLatexContent(inner) + '$';
      });
    },

        // 清理 Codeforces 公式重复
    cleanDoubleMath: function(text) {
      let result = text;
      
      // 转换 Codeforces 标记
      result = result.replace(/「CF」([^「]+)「\/CF」/g, '$$$1$$');
      
      // ===== 修复不完整/损坏的公式 =====
      // $^{\text{∗$ -> $^*$
      result = result.replace(/\$\^\{?\\text\{[∗\*][^}]*\$(?!\})/g, '$^*$');
      result = result.replace(/\$\^\{?\\text\{([^}]*)\$(?!\})/g, '$^{$1}$');
      
      // 修复 $...\text{xxx$ 这种未闭合的情况
      result = result.replace(/\$([^$]*)\\text\{([^}$]*)\$([^$])/g, function(match, before, textContent, after) {
        return '$' + before + '\\text{' + textContent + '}$' + after;
      });
      
      // ===== 清理公式重复 =====
      // $n$n -> $n$
      result = result.replace(/\$([a-zA-Z])\$\1(?![a-zA-Z_\d])/g, '$$$1$$');
      
      // $0$0 -> $0$
      result = result.replace(/\$(\d+)\$\1(?!\d)/g, '$$$1$$');
      
      // $x_1$x\_1 -> $x_1$
      result = result.replace(/\$([a-zA-Z])_(\d+)\$\1[_\\]*\2/g, '$$$1_$2$$');
      result = result.replace(/\$([a-zA-Z])_\{(\d+)\}\$\1[_\\]*\{?\2\}?/g, '$$$1_{$2}$$');
      result = result.replace(/\$([a-zA-Z])_([a-zA-Z])\$\1[_\\]*\2/g, '$$$1_$2$$');
      
      // $\min$\\min -> $\min$
      result = result.replace(/\$(\\[a-zA-Z]+)\$\\+[a-zA-Z]+/g, '$$$1$$');
      result = result.replace(/\$(\\ldots)\$\\+ldots/g, '$$$1$$');
      
      // $f(...)$f(...) -> $f(...)$
      result = result.replace(/\$([a-zA-Z])\(([^)]+)\)\$\1\([^)]+\)/g, '$$$1($2)$$');
      
      // 复杂表达式
      result = result.replace(/\$([^$]+)\$(\d+\s*\\\\[a-zA-Z_\s\\{}^0-9\.\,\(\)\[\]\-\+\=\<\>]+)/g, function(match, latex, escaped) {
        if (/\\\\[a-zA-Z]/.test(escaped)) {
          return '$' + latex + '$';
        }
        return match;
      });
      
      // 通用清理
      result = result.replace(/\$([^$]+)\$([a-zA-Z][a-zA-Z0-9_]*(?:\s*\\\\[a-zA-Z_\s\\{}^0-9\.\,]+)*)/g, function(match, latex, text) {
        const latexSimple = latex.replace(/[\\{}_^\s]/g, '').toLowerCase();
        const textSimple = text.replace(/[\\{}_^\s]/g, '').toLowerCase();
        
        if (latexSimple.length > 0 && textSimple.length > 0) {
          let matchCount = 0;
          for (let i = 0; i < Math.min(latexSimple.length, textSimple.length, 5); i++) {
            if (latexSimple[i] === textSimple[i]) matchCount++;
          }
          if (matchCount >= 2 || (latexSimple.length <= 2 && matchCount >= 1)) {
            return '$' + latex + '$';
          }
        }
        return match;
      });
      
      return result;
    }
  };

    // ========== 主后处理函数 ==========
  function postProcessMarkdown(markdown, siteInfo) {
    let result = markdown;

    // 统一特殊字符
    result = result.replace(/[–—−]/g, '-');
    result = result.replace(/⁠/g, '');

    // 应用网站特定的后处理
    const processors = siteInfo.config.postProcess || [];
    for (const procName of processors) {
      if (postProcessors[procName]) {
        result = postProcessors[procName](result);
      }
    }

    // 如果是 Wikipedia，增加一行正则，强制清除可能漏掉的 [1] 或 ^[1]^ 格式，清除上标
    if (siteInfo.site === 'wikipedia') {
      result = result.replace(/\^\[[^\]]+\]\^/g, ''); // 清除 ^[1]^
      result = result.replace(/\\\[\d+\\\]/g, '');    // 清除 \[1\]
    }

    // ===== 最终修复：损坏的公式 =====
    // Codeforces 脚注 $^{\text{∗$ -> *
    result = result.split('$^{\\text{∗$').join('*');
    result = result.split('$^{\\text{*$').join('*');
    result = result.split('$^\\text{∗$').join('*');
    result = result.split('$^\\text{*$').join('*');
    
    // 正则兜底
    result = result.replace(/\$\^\{?\\text\{[∗\*]\$?/g, '*');

    // 通用清理
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.trim();

    return result;
  }

  // ========== 主转换函数 ==========
  function convertHtmlToMarkdown(html) {
    const siteInfo = getSiteConfig();
    const service = createTurndownService(siteInfo);
    let markdown = service.turndown(html);
    markdown = postProcessMarkdown(markdown, siteInfo);
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

      const siteInfo = getSiteConfig();
      showNotification('已复制为 Markdown (' + siteInfo.site + ')');
    } catch (error) {
      console.error('Copy as Markdown error:', error);
    }
  });

  // ========== 通知 ==========
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

  // 初始化日志
  const siteInfo = getSiteConfig();
  console.log('Copy as Markdown v11 loaded for:', siteInfo.site);
})();