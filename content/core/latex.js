(() => {
  'use strict';

  function cleanLatexContent(latex) {
    if (!latex) return '';

    let cleaned = String(latex).trim();

    // Wikipedia outer wrapper
    if (cleaned.startsWith('{\\displaystyle') && cleaned.endsWith('}')) {
      cleaned = cleaned.substring(15, cleaned.length - 1).trim();
    }

    return cleaned
      .replace(/[\\ ]+$/, '')
      .replace(/[−–—]/g, '-')
      .trim();
  }

  window.CopyMd.latex = { cleanLatexContent };
})();
