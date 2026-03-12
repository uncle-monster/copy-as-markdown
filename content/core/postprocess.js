(() => {
  'use strict';

  const { cleanLatexContent } = window.CopyMd.latex;

  const postProcessors = {
    cleanEditLinks(text) {
      return text
        .replace(/\s*\\\[\[编辑\]\([^\)]+\)\\\]\s*/g, '')
        .replace(/\s*\[编辑\]\([^\)]+\)\s*/g, '');
    },

    cleanReferences(text) {
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

    cleanLatexSpaces(text) {
      return text.replace(/\$([^$]+)\$/g, (match, inner) => '$' + cleanLatexContent(inner) + '$');
    },

    cleanDoubleMath(text) {
      let result = text;

      result = result.replace(/「CF」([^「]+)「\/CF」/g, '$$$1$$');

      result = result.replace(/\$\^\{?\\text\{[∗\*][^}]*\$(?!\})/g, '$^*$');
      result = result.replace(/\$\^\{?\\text\{([^}]*)\$(?!\})/g, '$^{$1}$');

      result = result.replace(/\$([^$]*)\\text\{([^}$]*)\$([^$])/g, (match, before, textContent, after) => {
        return '$' + before + '\\text{' + textContent + '}$' + after;
      });

      result = result.replace(/\$([a-zA-Z])\$\1(?![a-zA-Z_\d])/g, '$$$1$$');
      result = result.replace(/\$(\d+)\$\1(?!\d)/g, '$$$1$$');

      result = result.replace(/\$([a-zA-Z])_(\d+)\$\1[_\\]*\2/g, '$$$1_$2$$');
      result = result.replace(/\$([a-zA-Z])_\{(\d+)\}\$\1[_\\]*\{?\2\}?/g, '$$$1_{$2}$$');
      result = result.replace(/\$([a-zA-Z])_([a-zA-Z])\$\1[_\\]*\2/g, '$$$1_$2$$');

      result = result.replace(/\$(\\[a-zA-Z]+)\$\\+[a-zA-Z]+/g, '$$$1$$');
      result = result.replace(/\$(\\ldots)\$\\+ldots/g, '$$$1$$');

      result = result.replace(/\$([a-zA-Z])\(([^)]+)\)\$\1\([^)]+\)/g, '$$$1($2)$$');

      result = result.replace(/\$([^$]+)\$(\d+\s*\\\\[a-zA-Z_\s\\{}^0-9\.\,\(\)\[\]\-\+\=\<\>]+)/g, (match, latex, escaped) => {
        if (/\\\\[a-zA-Z]/.test(escaped)) return '$' + latex + '$';
        return match;
      });

      result = result.replace(/\$([^$]+)\$([a-zA-Z][a-zA-Z0-9_]*(?:\s*\\\\[a-zA-Z_\s\\{}^0-9\.\,]+)*)/g, (match, latex, text2) => {
        const latexSimple = latex.replace(/[\\{}_^\s]/g, '').toLowerCase();
        const textSimple = text2.replace(/[\\{}_^\s]/g, '').toLowerCase();

        if (latexSimple.length > 0 && textSimple.length > 0) {
          let matchCount = 0;
          for (let i = 0; i < Math.min(latexSimple.length, textSimple.length, 5); i++) {
            if (latexSimple[i] === textSimple[i]) matchCount++;
          }
          if (matchCount >= 2 || (latexSimple.length <= 2 && matchCount >= 1)) return '$' + latex + '$';
        }
        return match;
      });

      return result;
    },
  };

  function postProcessMarkdown(markdown, ctx) {
    let result = markdown;

    result = result.replace(/[–—−]/g, '-');
    result = result.replace(/⁠/g, '');

    result = result.replace(/(\$\$\n)\n?([^\s\n])/g, '$1\n$2');

    if (ctx.site === 'zhihu') {
      result = result.replace(/\$([^\$]+)\$([\u4e00-\u9fa5])/g, '$$$1$$ $2');
    }

    const processors = (ctx.siteConfig && ctx.siteConfig.postProcess) || [];
    for (const procName of processors) {
      const proc = postProcessors[procName];
      if (proc) result = proc(result);
    }

    result = result.split('$^{\\text{∗$').join('*');
    result = result.split('$^{\\text{*$').join('*');
    result = result.split('$^\\text{∗$').join('*');
    result = result.split('$^\\text{*$').join('*');
    result = result.replace(/\$\^\{?\\text\{[∗\*]\$?/g, '*');

    // Codeforces 特殊清理：修复 flush*}}$ 这类残留
    if (ctx.site === 'codeforces') {
      result = result.replace(/\*}*}\$/g, '*');
    }

    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
  }

  window.CopyMd.postprocess = { postProcessMarkdown, postProcessors };
})();

