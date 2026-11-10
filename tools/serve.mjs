// Servidor estático para probar cosas sin el Worker (ej.: tools/model-viewer.html). Sirve public/ en la raíz y
// tools/ en /tools.   node tools/serve.mjs [puerto]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const port = Number(process.argv[2]) || 8790;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg' };
http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // el visor guarda la foto de un personaje para la tienda: PUT /models/<id>.webp
  if (req.method === 'PUT') {
    const m = url.match(/^\/models\/([a-z0-9-]+)\.webp$/);
    if (!m) return void res.writeHead(400).end('no');
    const parts = [];
    req.on('data', (d) => parts.push(d));
    req.on('end', () => {
      fs.writeFileSync(path.join(ROOT, 'public', 'models', `${m[1]}.webp`), Buffer.concat(parts));
      res.writeHead(200).end('ok');
    });
    return;
  }
  const base = url.startsWith('/tools/') ? ROOT : path.join(ROOT, 'public');
  const file = path.join(base, url === '/' ? '/tools/model-viewer.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('no');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}/tools/model-viewer.html`));
