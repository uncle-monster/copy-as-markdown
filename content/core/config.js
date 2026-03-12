(() => {
  'use strict';

  const defaultConfig = {
    enabled: true,
    inlineMathDelimiter: '$',
    blockMathDelimiter: '$$',
    preserveImages: true,
    preserveTables: true,
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  };

  let config = { ...defaultConfig };

  function loadFromStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    chrome.storage.sync.get('config', (result) => {
      if (result && result.config) config = { ...config, ...result.config };
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.config) config = { ...config, ...changes.config.newValue };
    });
  }

  loadFromStorage();

  window.CopyMd.config = {
    get() {
      return config;
    },
    reset() {
      config = { ...defaultConfig };
    },
  };
})();
