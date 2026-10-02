// Preloaded via `node --import` before any test file runs (see package.json
// "test" script). Registers the JSX loader and stands up a jsdom window as
// the global DOM so React Testing Library has somewhere to render.

import { register } from 'node:module';
import { JSDOM } from 'jsdom';

register('./jsx-loader.mjs', import.meta.url);

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});

// Node 21+ already defines a few of these (navigator, structuredClone) as
// getter-only globals for its own Web API support, so a plain assignment
// throws — defineProperty overrides them like jsdom-in-Jest does.
function setGlobal(key, value) {
  Object.defineProperty(global, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

setGlobal('window', dom.window);
setGlobal('document', dom.window.document);
setGlobal('navigator', dom.window.navigator);
// Silences React's "not wrapped in act()" warnings outside a Jest/Vitest
// environment, where RTL can't auto-detect that it's running in a test.
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);

for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (!(key in global)) {
    setGlobal(key, dom.window[key]);
  }
}
