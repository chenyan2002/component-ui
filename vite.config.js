import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
    base: '/component-ui/',
    // Lower the standard decorators used by the Lit components; browsers don't support them yet.
    esbuild: { target: 'es2022' },
    plugins: [
      topLevelAwait(),
        {
            name: 'server-wasm',
            configureServer(server) {
              server.middlewares.use((req, res, next) => {
                if (req.url.endsWith('.wasm')) {
                  const wasmFile = path.basename(req.url);
                  const wasmPath = path.resolve(
                        __dirname,
                        `node_modules/@bytecodealliance/jco/obj/${wasmFile}`
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
