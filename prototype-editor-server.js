#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

// 从目标原型目录启动服务，使插件可作为子文件夹分发。
const root = path.resolve(process.cwd());
const port = Number(process.argv[2]) || Number(process.env.PORT) || 4173;
const savePath = '/__prototype-editor__/overwrite';
const mimeTypes = { '.css':'text/css; charset=utf-8', '.html':'text/html; charset=utf-8', '.htm':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml' };

const send = (response, status, body, type = 'application/json; charset=utf-8') => {
  response.writeHead(status, { 'Content-Type':type, 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const isInsideRoot = target => {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
};
const backupName = target => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.parse(target);
  return path.join(file.dir, file.name + '.backup-' + stamp + file.ext);
};
const readBody = request => new Promise((resolve, reject) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', chunk => { body += chunk; if (body.length > 10 * 1024 * 1024) reject(new Error('文件内容超过 10MB 限制')); });
  request.on('end', () => resolve(body));
  request.on('error', reject);
});
const targetFor = sourcePath => {
  if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('缺少源文件路径');
  const decoded = decodeURIComponent(sourcePath);
  const target = path.isAbsolute(decoded) && isInsideRoot(decoded) ? decoded : path.resolve(root, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded));
  if (!isInsideRoot(target) || !['.html', '.htm'].includes(path.extname(target).toLowerCase())) throw new Error('只能覆盖当前项目目录内的 HTML 文件');
  return target;
};

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, '', 'text/plain');
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'POST' && url.pathname === savePath) {
      const payload = JSON.parse(await readBody(request));
      const target = targetFor(payload.path);
      const realTarget = await fs.realpath(target);
      if (!isInsideRoot(realTarget)) throw new Error('源文件不在允许目录内');
      const backup = backupName(realTarget);
      await fs.copyFile(realTarget, backup);
      const temp = realTarget + '.tmp-' + process.pid;
      await fs.writeFile(temp, payload.html, 'utf8');
      await fs.rename(temp, realTarget);
      return send(response, 200, { ok:true, backup:path.basename(backup) });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, { error:'不支持的请求方法' });
    const requested = decodeURIComponent(url.pathname === '/' ? '/demo.html' : url.pathname);
    const target = path.resolve(root, '.' + requested);
    if (!isInsideRoot(target)) return send(response, 403, { error:'禁止访问' });
    const content = await fs.readFile(target);
    response.writeHead(200, { 'Content-Type':mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream' });
    return request.method === 'HEAD' ? response.end() : response.end(content);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 400;
    return send(response, status, { ok:false, error:error.message || '保存失败' });
  }
});

server.listen(port, '127.0.0.1', () => console.log('原型编辑器本地服务已启动：http://localhost:' + port + '/demo.html'));
