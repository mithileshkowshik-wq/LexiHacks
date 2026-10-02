// Custom ESM loader hook (registered by preload.mjs) that runs project
// source through Babel's JSX transform before Node parses it. node --test
// has no bundler in front of it, so a file containing raw `<div>...</div>`
// syntax would otherwise be a plain syntax error.
//
// Applies to every project .js/.jsx file, not just component files under
// src/ — this also lets test files themselves use JSX (e.g. `render(<Foo />)`)
// while still ending in the plain .test.js extension node --test already
// auto-discovers (it does not look for .test.jsx). Babel's JSX plugin is a
// no-op on files with no JSX, so transforming every file uniformly is safe.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformSync } from '@babel/core';

export async function load(url, context, nextLoad) {
  if (/\.jsx?$/.test(url) && url.startsWith('file://') && !url.includes('/node_modules/')) {
    const filename = fileURLToPath(url);
    const source = await readFile(filename, 'utf8');
    const { code } = transformSync(source, {
      filename,
      babelrc: false,
      configFile: false,
      sourceMaps: 'inline',
      plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
    });
    // Vite injects import.meta.env at build time; plain Node never defines
    // it, so any source reading e.g. import.meta.env.VITE_API_URL throws
    // before the module even finishes loading. Default it to an empty
    // object so that code falls through to its own `?? fallback` instead.
    const withEnvShim = `if (typeof import.meta.env === 'undefined') { import.meta.env = {}; }\n${code}`;
    return { format: 'module', source: withEnvShim, shortCircuit: true };
  }
  return nextLoad(url, context);
}
