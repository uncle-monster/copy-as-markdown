(() => {
  'use strict';

  const { cleanLatexContent } = window.CopyMd.latex;

  function extractCellContent(cell, ctx) {
    // Prefer formulas
    const annotations = cell.querySelectorAll('annotation');
    if (annotations.length > 0) {
      const formulas = [];
      annotations.forEach((ann) => {
        const latex = ann.textContent.trim();
        if (latex) formulas.push(cleanLatexContent(latex));
      });
      if (formulas.length > 0) return '$' + formulas.join(' ') + '$';
    }

    const mathElements = cell.querySelectorAll('.mwe-math-element');
    if (mathElements.length > 0) {
      const formulas = [];
      mathElements.forEach((el) => {
        const ann = el.querySelector('annotation');
        if (ann) formulas.push(cleanLatexContent(ann.textContent.trim()));
      });
      if (formulas.length > 0) return '$' + formulas.join(' ') + '$';
    }

    const clone = cell.cloneNode(true);
    clone.querySelectorAll('.mwe-math-element, math').forEach((el) => el.remove());

    // Remove Wikipedia/other reference superscripts
    clone.querySelectorAll('sup.reference').forEach((sup) => sup.remove());
    clone.querySelectorAll('.mw-reftooltip-cite').forEach((el) => el.remove());

    // Generic superscripts/subscripts
    clone.querySelectorAll('sup').forEach((sup) => {
      const content = sup.textContent.trim();
      if (/^\d+$/.test(content)) {
        const m = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
        let t = '';
        for (const ch of content) t += m[ch] || ch;
        sup.replaceWith(document.createTextNode(t));
      }
    });
    clone.querySelectorAll('sub').forEach((sub) => {
      const content = sub.textContent.trim();
      if (/^\d+$/.test(content)) {
        const m = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
        let t = '';
        for (const ch of content) t += m[ch] || ch;
        sub.replaceWith(document.createTextNode(t));
      }
    });

    let text = clone.textContent
      .trim()
      .replace(/\|/g, '\\|')
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ');

    // Keep legacy ref normalization (if any placeholders exist)
    text = text.replace(/【REF(\d+):(\d+-\d+)REF】/g, '^[$1]:$2^');
    text = text.replace(/【REF(\d+)REF】/g, '^[$1]^');

    return text;
  }

  function convertTableToMarkdown(table, ctx) {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let markdown = '\n\n';

    const caption = table.querySelector('caption');
    if (caption) {
      let captionContent = extractCellContent(caption, ctx);
      captionContent = captionContent.replace(/\s*\[编辑\]\s*/g, '').trim();
      if (captionContent) markdown += '**' + captionContent + '**\n\n';
    }

    let headerProcessed = false;
    rows.forEach((row) => {
      const cells = row.querySelectorAll('th, td');
      const cellContents = Array.from(cells).map((cell) => extractCellContent(cell, ctx));
      markdown += '| ' + cellContents.join(' | ') + ' |\n';

      if (!headerProcessed) {
        markdown += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n';
        headerProcessed = true;
      }
    });

    return markdown + '\n';
  }

  window.CopyMd.table = { convertTableToMarkdown, extractCellContent };
})();

