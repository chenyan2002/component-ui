import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
    base: '/component-ui/',
    plugins: [
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
