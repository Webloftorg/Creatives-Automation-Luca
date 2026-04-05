import express from 'express';
import cors from 'cors';
import renderRouter from './routes/render.js';
import { closeBrowser } from './utils/browser.js';

const app = express();
const PORT = process.env.RENDER_PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));

app.use(renderRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  console.log(`Rendering server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  server.close();
});

process.on('SIGINT', async () => {
  await closeBrowser();
  server.close();
});
