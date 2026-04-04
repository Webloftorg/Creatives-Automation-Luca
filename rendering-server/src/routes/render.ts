import { Router, type Request, type Response } from 'express';
import { withPage } from '../utils/browser.js';

const router = Router();

interface RenderBody {
  html: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

router.post('/api/render', async (req: Request, res: Response) => {
  const { html, width, height, deviceScaleFactor = 2 } = req.body as RenderBody;

  if (!html || !width || !height) {
    res.status(400).json({ error: 'Missing required fields: html, width, height' });
    return;
  }

  try {
    const png = await withPage(async (page) => {
      await page.setViewport({ width, height, deviceScaleFactor });
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
      return await page.screenshot({
        type: 'jpeg',
        quality: 90,
        clip: { x: 0, y: 0, width, height },
      });
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(png);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Render failed';
    res.status(500).json({ error: message });
  }
});

export default router;
