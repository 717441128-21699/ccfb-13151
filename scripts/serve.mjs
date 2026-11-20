/** 极简静态服务器:npm run web 后打开 http://localhost:8420/apps/web/ */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT ?? 8420);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json',
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const path = normalize(join(root, url.endsWith('/') ? url + 'index.html' : url));
  if (!path.startsWith(root)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  readFile(path)
    .then((buf) => {
      res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
      res.end(buf);
    })
    .catch(() => res.writeHead(404).end('not found'));
}).listen(port, () => {
  console.log(`规则平台已启动: http://localhost:${port}/apps/web/`);
});
