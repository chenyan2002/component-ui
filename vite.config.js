import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
    base: '/component-ui/',
    // Lower the standard decorators used by the Lit components; browsers don't support them yet.
    esbuild: { target: 'es2022' },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // jco marks its output (src/obj/bindgen.js) with a directive that doesn't apply to bundles.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use components"')) {
            return;
          }
          warn(warning);
        },
      },
    },
    plugins: [
      topLevelAwait(),
      {
        // jco's transpiler imports `node:fs/promises` only when running in Node; in the browser
        // it fetches instead, so resolve the import to an empty module.
        name: 'empty-node-fs',
        // Before Vite's resolver, which externalizes Node built-ins with a warning.
        enforce: 'pre',
        resolveId(id) {
          return id === 'node:fs/promises' ? '\0empty-node-fs' : undefined;
        },
        load(id) {
          return id === '\0empty-node-fs' ? 'export {};' : undefined;
        },
      },
        {
            name: 'server-wasm',
            configureServer(server) {
              server.middlewares.use((req, res, next) => {
                if (req.url.endsWith('.wasm')) {
                  const wasmFile = path.basename(req.url);
                  const wasmPath = path.resolve(
                        __dirname,
                        `node_modules/@bytecodealliance/jco-transpile/vendor/${wasmFile}`
                      ); 
                  fs.readFile(wasmPath, (err, data) => {
                    if (err) {
                        return next();
                    }
                    res.setHeader('Content-Type', 'application/wasm');
                    res.end(data);
                  });
                  return;
                }
                next();
              });
            }
        }
    ],
});
