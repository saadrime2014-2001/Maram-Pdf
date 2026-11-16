import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function addDirectoryToZip(zip: JSZip, fsDir: string, zipPrefix: string) {
  if (!fs.existsSync(fsDir)) return;
  const entries = fs.readdirSync(fsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.env')) {
      continue;
    }
    const fullPath = path.join(fsDir, entry.name);
    const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipPath);
    } else if (entry.isFile()) {
      zip.file(zipPath, fs.readFileSync(fullPath));
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/export-apk-archive', async (_req, res) => {
    try {
      const zip = new JSZip();
      const rootFiles = [
        'package.json',
        'capacitor.config.json',
        'index.html',
        'tsconfig.json',
        'vite.config.ts',
        'server.ts',
        'metadata.json',
        'BUILD_APK_AR.md',
        '.env.example',
        '.gitignore',
      ];

      for (const file of rootFiles) {
        const fullPath = path.join(__dirname, file);
        if (fs.existsSync(fullPath)) {
          zip.file(file, fs.readFileSync(fullPath));
        }
      }

      addDirectoryToZip(zip, path.join(__dirname, '.github'), '.github');
      addDirectoryToZip(zip, path.join(__dirname, 'src'), 'src');
      addDirectoryToZip(zip, path.join(__dirname, 'public'), 'public');

      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="waraqa-pdf-github-apk.zip"'
      );
      res.send(buffer);
    } catch (err) {
      console.error('Archive export error:', err);
      res.status(500).json({ error: 'تعذر تجهيز الأرشيف حالياً.' });
    }
  });

  app.post('/api/ocr', async (req, res) => {
    try {
      const { imageBase64, mimeType, languageHint } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        languageHint?: 'auto' | 'ar' | 'en';
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'بيانات الصورة مطلوبة لإجراء التعرف الضوئي على النص.' });
        return;
      }

      const ai = getAiClient();
      const langInstruction =
        languageHint === 'ar'
          ? 'Focus on Arabic script and numbers accurately, preserving right-to-left reading order.'
          : languageHint === 'en'
            ? 'Focus on English/Latin text and numbers accurately.'
            : 'Detect and accurately transcribe all Arabic, English, and mixed-language text, preserving natural reading order and paragraph breaks.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              text: `Perform high-accuracy OCR on this document page or image. ${langInstruction}
Return a JSON object containing:
1. "fullText": The complete transcribed text preserving paragraphs, headings, lists, and tables cleanly. If no readable text exists, return an empty string.
2. "detectedLanguage": A short label such as "العربية", "English", or "العربية والإنجليزية".
3. "lines": Up to 80 visual text lines/blocks ordered top-to-bottom, each with:
   - "text": the line text
   - "xPercent": horizontal start position (0 to 100 from left edge of image)
   - "yPercent": vertical baseline position (0 to 100 from top edge of image)`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullText: {
                type: Type.STRING,
                description: 'Complete transcribed text from the image preserving paragraphs.',
              },
              detectedLanguage: {
                type: Type.STRING,
                description: 'Detected document language.',
              },
              lines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    xPercent: { type: Type.NUMBER },
                    yPercent: { type: Type.NUMBER },
                  },
                  required: ['text', 'xPercent', 'yPercent'],
                },
              },
            },
            required: ['fullText', 'detectedLanguage', 'lines'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      let parsed: {
        fullText?: string;
        detectedLanguage?: string;
        lines?: Array<{ text: string; xPercent: number; yPercent: number }>;
      } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { fullText: raw, detectedLanguage: 'غير محدد', lines: [] };
      }

      res.json({
        fullText: parsed.fullText ?? '',
        detectedLanguage: parsed.detectedLanguage ?? 'غير محدد',
        lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR processing failed';
      console.error('OCR API error:', message);
      res.status(500).json({
        error: 'تعذر إتمام التعرف الضوئي على النص حالياً. تأكد من جودة الصورة أو إعدادات الخدمة.',
        details: message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
