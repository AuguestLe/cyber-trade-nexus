import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config.js';
import { createApp } from './app.js';
import { createProvider } from './providers/index.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const indexHtml = path.join(distDir, 'index.html');
const hasBuild = fs.existsSync(indexHtml);

const provider = createProvider();
const app = createApp(provider);

if (hasBuild) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(indexHtml);
  });
  console.log(`[nexus] 托管静态产物：${distDir}`);
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send('NEXUS API 已启动。开发模式请访问 http://127.0.0.1:5173；或先执行 npm run build。');
  });
}

const server = app.listen(CONFIG.port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`[nexus] API 就绪：http://127.0.0.1:${CONFIG.port}/api/health`);
  console.log(`[nexus] 演示数据 seed=${CONFIG.seed} provider=${CONFIG.provider}`);
});

function shutdown(signal) {
  console.log(`[nexus] 收到 ${signal}，正在关闭...`);
  provider.shutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
