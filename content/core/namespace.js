// Shared namespace for content scripts (no module imports in MV3 content_scripts).
(function initCopyMdNamespace() {
  'use strict';

  if (window.CopyMd) return;

  const registry = new Map();

  window.CopyMd = {
    version: 'v12',
    registry,
    registerSite(adapter) {
      if (!adapter || !adapter.id || typeof adapter.matches !== 'function') {
        throw new Error('Invalid site adapter. Expected { id, matches() }');
      }
      registry.set(adapter.id, adapter);
    },
    getSiteAdapter(ctx) {
      for (const adapter of registry.values()) {
        try {
          if (adapter.matches(ctx)) return adapter;
        } catch (e) {
          // Ignore adapter errors to avoid breaking other sites.
        }
      }
      return registry.get('default');
    },
  };
})();
