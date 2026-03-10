/**
 * Copy as Markdown - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    enabled: document.getElementById('enabled'),
    inlineMathDelimiter: document.getElementById('inlineMathDelimiter'),
    blockMathDelimiter: document.getElementById('blockMathDelimiter'),
    preserveImages: document.getElementById('preserveImages'),
    preserveTables: document.getElementById('preserveTables'),
    convertItalicMath: document.getElementById('convertItalicMath'),
    headingStyle: document.getElementById('headingStyle'),
    resetBtn: document.getElementById('resetBtn')
  };

  const defaultConfig = {
    enabled: true,
    inlineMathDelimiter: '$',
    blockMathDelimiter: '$$',
    preserveImages: true,
    preserveTables: true,
    convertItalicMath: true,
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  };

  function loadConfig() {
    chrome.storage.sync.get('config', (result) => {
      const config = result.config || defaultConfig;
      
      elements.enabled.checked = config.enabled;
      elements.inlineMathDelimiter.value = config.inlineMathDelimiter;
      elements.blockMathDelimiter.value = config.blockMathDelimiter;
      elements.preserveImages.checked = config.preserveImages;
      elements.preserveTables.checked = config.preserveTables;
      elements.convertItalicMath.checked = config.convertItalicMath !== false;
      elements.headingStyle.value = config.headingStyle;

      updateUIState(config.enabled);
    });
  }

  function saveConfig() {
    const config = {
      enabled: elements.enabled.checked,
      inlineMathDelimiter: elements.inlineMathDelimiter.value,
      blockMathDelimiter: elements.blockMathDelimiter.value,
      preserveImages: elements.preserveImages.checked,
      preserveTables: elements.preserveTables.checked,
      convertItalicMath: elements.convertItalicMath.checked,
      headingStyle: elements.headingStyle.value,
      codeBlockStyle: 'fenced'
    };

    chrome.storage.sync.set({ config }, () => {
      console.log('Config saved:', config);
    });

    updateUIState(config.enabled);
  }

  function updateUIState(enabled) {
    const main = document.querySelector('main');
    if (enabled) {
      main.classList.remove('disabled');
    } else {
      main.classList.add('disabled');
    }
  }

  function resetConfig() {
    chrome.storage.sync.set({ config: defaultConfig }, () => {
      loadConfig();
    });
  }

  Object.keys(elements).forEach(key => {
    if (key === 'resetBtn') {
      elements[key].addEventListener('click', resetConfig);
    } else if (elements[key]) {
      elements[key].addEventListener('change', saveConfig);
    }
  });

  loadConfig();
});