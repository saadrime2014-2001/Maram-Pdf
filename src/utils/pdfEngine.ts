import { PDFDocument, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type {
  ImageAnnotation,
  OcrPageResult,
  PageAnnotation,
  PdfPagePreview,
  StrokeAnnotation,
  TextAnnotation,
  TextFontFamily,
  WatermarkConfig,
} from '../types/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

let cachedUnicodeFontBytes: Uint8Array | null = null;

async function getUnicodeFontBytes(): Promise<Uint8Array | null> {
  if (cachedUnicodeFontBytes) return cachedUnicodeFontBytes;
  try {
    const res = await fetch('/fonts/DejaVuSans.ttf');
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    cachedUnicodeFontBytes = new Uint8Array(buf);
    return cachedUnicodeFontBytes;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function formatRelativeTime(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} س`;
  return new Date(timestamp).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

export async function getPdfPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function renderPdfThumbnails(
  bytes: Uint8Array,
  scale = 0.5
): Promise<PdfPagePreview[]> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  const previews: PdfPagePreview[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }
    previews.push({
      id: `page_${i - 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      originalIndex: i - 1,
      rotation: 0,
      deleted: false,
      thumbnailUrl: canvas.toDataURL('image/jpeg', 0.82),
      width: viewport.width / scale,
      height: viewport.height / scale,
    });
  }

  await loadingTask.destroy();
  return previews;
}

export async function renderSinglePdfPage(
  bytes: Uint8Array,
  pageIndex: number,
  scale = 2,
  extraRotation = 0
): Promise<{ dataUrl: string; width: number; height: number }> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageIndex + 1);
  const totalRot = (page.rotate + extraRotation) % 360;
  const viewport = page.getViewport({ scale, rotation: totalRot });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  }
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  await loadingTask.destroy();
  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

export interface DetectedTextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

export async function extractPageTextBlocks(
  bytes: Uint8Array,
  pageIndex: number
): Promise<DetectedTextBlock[]> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const linesMap = new Map<
    number,
    Array<{ str: string; x: number; y: number; w: number; h: number }>
  >();

  for (const rawItem of content.items) {
    if (!('str' in rawItem) || !rawItem.str.trim()) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, rawItem.transform);
    const x = tx[4];
    const y = tx[5];
    const fontHeight = Math.max(8, Math.hypot(tx[2], tx[3]) || rawItem.height || 12);
    const bucketY = Math.round(y / 6) * 6;
    const group = linesMap.get(bucketY) || [];
    group.push({
      str: rawItem.str,
      x,
      y,
      w: rawItem.width || fontHeight * rawItem.str.length * 0.5,
      h: fontHeight,
    });
    linesMap.set(bucketY, group);
  }

  const blocks: DetectedTextBlock[] = [];
  for (const [, items] of Array.from(linesMap.entries()).sort((a, b) => a[0] - b[0])) {
    items.sort((a, b) => a.x - b.x);
    const joined = items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
    if (!joined) continue;
    const minX = Math.min(...items.map((it) => it.x));
    const maxX = Math.max(...items.map((it) => it.x + it.w));
    const avgY = items.reduce((s, it) => s + it.y, 0) / items.length;
    const avgH = items.reduce((s, it) => s + it.h, 0) / items.length;

    blocks.push({
      text: joined,
      x: Math.max(0.02, Math.min(0.85, minX / viewport.width)),
      y: Math.max(0.02, Math.min(0.95, (avgY - avgH * 0.85) / viewport.height)),
      width: Math.max(0.15, Math.min(0.92, (maxX - minX) / viewport.width + 0.04)),
      fontSize: Math.max(14, Math.min(48, Math.round((avgH / viewport.width) * 1000))),
    });
  }

  await loadingTask.destroy();
  return blocks.slice(0, 40);
}

export async function mergePdfFiles(
  files: Array<{ name: string; bytes: Uint8Array }>
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
    const indices = src.getPageIndices();
    const copied = await merged.copyPages(src, indices);
    copied.forEach((p) => merged.addPage(p));
  }
  return await merged.save();
}

export async function extractPdfPages(
  bytes: Uint8Array,
  pageIndices: number[]
): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const dest = await PDFDocument.create();
  const validIndices = pageIndices.filter((idx) => idx >= 0 && idx < src.getPageCount());
  const copied = await dest.copyPages(src, validIndices);
  copied.forEach((p) => dest.addPage(p));
  return await dest.save();
}

export async function splitAllPagesToZip(
  bytes: Uint8Array,
  baseName: string
): Promise<Blob> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const zip = new JSZip();
  const cleanName = baseName.replace(/\.pdf$/i, '') || 'document';

  for (let i = 0; i < src.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(src, [i]);
    single.addPage(copied);
    const out = await single.save();
    zip.file(`${cleanName}_page_${i + 1}.pdf`, out);
  }

  return await zip.generateAsync({ type: 'blob' });
}

function resolveCanvasFont(family: TextFontFamily, px: number, bold: boolean): string {
  const weight = bold ? '700' : '500';
  if (family === 'serif') {
    return `${weight} ${px}px Georgia, "Times New Roman", serif`;
  }
  if (family === 'mono') {
    return `${weight} ${px}px "JetBrains Mono", ui-monospace, monospace`;
  }
  return `${weight} ${px}px "IBM Plex Sans Arabic", "Plus Jakarta Sans", system-ui, sans-serif`;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

async function renderAnnotationsOverlayPng(
  widthPt: number,
  heightPt: number,
  annotations: PageAnnotation[],
  watermark?: WatermarkConfig
): Promise<Uint8Array | null> {
  if (annotations.length === 0 && (!watermark || !watermark.enabled || !watermark.text.trim())) {
    return null;
  }

  const scale = 2.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(100, Math.round(widthPt * scale));
  canvas.height = Math.max(100, Math.round(heightPt * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  for (const ann of annotations) {
    if (ann.type === 'pen' || ann.type === 'highlight') {
      const stroke = ann as StrokeAnnotation;
      if (stroke.points.length < 2) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = stroke.type === 'highlight' ? 0.34 : 1;
      ctx.lineWidth = (stroke.width / 1000) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * canvas.width, stroke.points[i].y * canvas.height);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const ann of annotations) {
    if (ann.type === 'image' || ann.type === 'signature') {
      const imgAnn = ann as ImageAnnotation;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.globalAlpha = imgAnn.opacity ?? 1;
          ctx.drawImage(
            img,
            imgAnn.x * canvas.width,
            imgAnn.y * canvas.height,
            imgAnn.width * canvas.width,
            imgAnn.height * canvas.height
          );
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = imgAnn.dataUrl;
      });
    }
  }

  for (const ann of annotations) {
    if (ann.type === 'text') {
      const txt = ann as TextAnnotation;
      if (!txt.text.trim()) continue;
      ctx.save();
      const px = Math.max(12, Math.round((txt.fontSize / 1000) * canvas.width));
      ctx.font = resolveCanvasFont(txt.fontFamily, px, txt.bold);
      const boxW = Math.max(80, (txt.width || 0.4) * canvas.width);
      const lines = wrapTextLines(ctx, txt.text, boxW - px * 0.6);
      const lineHeight = px * 1.38;
      const boxH = Math.max(lineHeight + px * 0.4, lines.length * lineHeight + px * 0.4);
      const xPos = txt.x * canvas.width;
      const yPos = txt.y * canvas.height;

      if (txt.backgroundColor === '#FFFFFF') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(xPos, yPos, boxW, boxH);
      }

      ctx.fillStyle = txt.color;
      ctx.textBaseline = 'top';
      const isRtl = containsArabic(txt.text);
      ctx.direction = isRtl ? 'rtl' : 'ltr';
      ctx.textAlign = txt.align;

      let drawX = xPos + px * 0.3;
      if (txt.align === 'center') drawX = xPos + boxW / 2;
      if (txt.align === 'right') drawX = xPos + boxW - px * 0.3;

      lines.forEach((line, idx) => {
        ctx.fillText(line, drawX, yPos + px * 0.2 + idx * lineHeight);
      });
      ctx.restore();
    }
  }

  if (watermark && watermark.enabled && watermark.text.trim()) {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((watermark.angle * Math.PI) / 180);
    ctx.globalAlpha = watermark.opacity;
    ctx.fillStyle = watermark.color;
    const wmSize = Math.round(canvas.width * 0.065);
    ctx.font = `700 ${wmSize}px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = containsArabic(watermark.text) ? 'rtl' : 'ltr';
    ctx.fillText(watermark.text, 0, 0);
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

export async function applyPageOperationsAndAnnotations(
  sourceBytes: Uint8Array,
  pages: PdfPagePreview[],
  annotationsByPageId: Record<string, PageAnnotation[]>,
  watermark?: WatermarkConfig
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();

  const activePages = pages.filter((p) => !p.deleted);
  if (activePages.length === 0) {
    throw new Error('لا يمكن حفظ ملف فارغ بدون صفحات.');
  }

  const copiedPages = await outDoc.copyPages(
    srcDoc,
    activePages.map((p) => p.originalIndex)
  );

  for (let i = 0; i < activePages.length; i++) {
    const pageMeta = activePages[i];
    const pdfPage = copiedPages[i];
    const currentRot = pdfPage.getRotation().angle;
    const nextRot = (currentRot + pageMeta.rotation) % 360;
    if (pageMeta.rotation !== 0) {
      pdfPage.setRotation(degrees(nextRot));
    }
    outDoc.addPage(pdfPage);

    const { width, height } = pdfPage.getSize();
    const isQuarterTurn = pageMeta.rotation === 90 || pageMeta.rotation === 270;
    const visualW = isQuarterTurn ? height : width;
    const visualH = isQuarterTurn ? width : height;

    const anns = annotationsByPageId[pageMeta.id] || [];
    const overlayPng = await renderAnnotationsOverlayPng(visualW, visualH, anns, watermark);

    if (overlayPng) {
      const embedded = await outDoc.embedPng(overlayPng);
      if (pageMeta.rotation === 0) {
        pdfPage.drawImage(embedded, { x: 0, y: 0, width, height });
      } else {
        const tempDoc = await PDFDocument.create();
        const tp = tempDoc.addPage([visualW, visualH]);
        void tp;
        pdfPage.drawImage(embedded, { x: 0, y: 0, width, height });
      }
    }
  }

  return await outDoc.save();
}

export async function compressPdf(
  bytes: Uint8Array,
  quality: 'high' | 'medium' | 'compact'
): Promise<Uint8Array> {
  const scale = quality === 'high' ? 1.5 : quality === 'medium' ? 1.15 : 0.85;
  const jpegQuality = quality === 'high' ? 0.82 : quality === 'medium' ? 0.64 : 0.45;

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const origViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(renderViewport.width));
    canvas.height = Math.max(1, Math.floor(renderViewport.height));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;
    }

    const jpgDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
    const jpgBytes = dataUrlToUint8Array(jpgDataUrl);
    const embedded = await outDoc.embedJpg(jpgBytes);
    const outPage = outDoc.addPage([origViewport.width, origViewport.height]);
    outPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });
  }

  await loadingTask.destroy();
  return await outDoc.save();
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function applyDocumentScanFilter(
  dataUrl: string,
  mode: 'original' | 'magic-color' | 'bw-scan' = 'magic-color'
): Promise<string> {
  if (mode === 'original') return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1200;
      canvas.height = img.naturalHeight || 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;

      if (mode === 'bw-scan') {
        const contrast = 1.65;
        const intercept = 128 * (1 - contrast);
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          let v = gray * contrast + intercept;
          if (v > 210) v = 255;
          v = Math.min(255, Math.max(0, v));
          d[i] = d[i + 1] = d[i + 2] = v;
        }
      } else {
        const contrast = 1.3;
        const brightness = 18;
        const intercept = 128 * (1 - contrast) + brightness;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, Math.max(0, d[i] * contrast + intercept));
          d[i + 1] = Math.min(255, Math.max(0, d[i + 1] * contrast + intercept));
          d[i + 2] = Math.min(255, Math.max(0, d[i + 2] * contrast + intercept));
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function imagesToPdf(
  images: Array<{ dataUrl: string; width: number; height: number }>,
  options: { pageSize: 'a4' | 'fit'; margin: number }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const A4_W = 595.28;
  const A4_H = 841.89;

  for (const imgItem of images) {
    const normalizedBytes = await convertDataUrlToJpegOrPngBytes(imgItem.dataUrl);
    const embedded = normalizedBytes.isPng
      ? await doc.embedPng(normalizedBytes.bytes)
      : await doc.embedJpg(normalizedBytes.bytes);

    const imgW = embedded.width;
    const imgH = embedded.height;

    if (options.pageSize === 'fit') {
      const m = options.margin;
      const page = doc.addPage([imgW + m * 2, imgH + m * 2]);
      page.drawImage(embedded, { x: m, y: m, width: imgW, height: imgH });
    } else {
      const isLandscape = imgW > imgH * 1.15;
      const pageW = isLandscape ? A4_H : A4_W;
      const pageH = isLandscape ? A4_W : A4_H;
      const page = doc.addPage([pageW, pageH]);
      const availW = pageW - options.margin * 2;
      const availH = pageH - options.margin * 2;
      const ratio = Math.min(availW / imgW, availH / imgH);
      const drawW = imgW * ratio;
      const drawH = imgH * ratio;
      page.drawImage(embedded, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }
  }

  return await doc.save();
}

async function convertDataUrlToJpegOrPngBytes(
  dataUrl: string
): Promise<{ bytes: Uint8Array; isPng: boolean }> {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return { bytes: dataUrlToUint8Array(dataUrl), isPng: false };
  }
  if (dataUrl.startsWith('data:image/png')) {
    return { bytes: dataUrlToUint8Array(dataUrl), isPng: true };
  }
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1000;
      canvas.height = img.naturalHeight || 1000;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      resolve({ bytes: dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.92)), isPng: false });
    };
    img.src = dataUrl;
  });
}

export async function pdfToImages(
  bytes: Uint8Array,
  format: 'png' | 'jpeg',
  scale = 2
): Promise<Array<{ pageNumber: number; dataUrl: string; blob: Blob }>> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  const results: Array<{ pageNumber: number; dataUrl: string; blob: Blob }> = [];
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }
    const dataUrl = canvas.toDataURL(mime, 0.92);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), mime, 0.92)
    );
    results.push({ pageNumber: i, dataUrl, blob });
  }

  await loadingTask.destroy();
  return results;
}

export async function bundleImagesAsZip(
  images: Array<{ pageNumber: number; blob: Blob }>,
  format: 'png' | 'jpeg',
  baseName: string
): Promise<Blob> {
  const zip = new JSZip();
  const cleanName = baseName.replace(/\.pdf$/i, '') || 'document';
  const ext = format === 'png' ? 'png' : 'jpg';
  for (const item of images) {
    zip.file(`${cleanName}_page_${item.pageNumber}.${ext}`, item.blob);
  }
  return await zip.generateAsync({ type: 'blob' });
}

export async function extractTextFromPdf(
  bytes: Uint8Array
): Promise<Array<{ pageNumber: number; text: string }>> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  const pages: Array<{ pageNumber: number; text: string }> = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = '';
    const lines: string[] = [];

    for (const rawItem of content.items) {
      if (!('str' in rawItem)) continue;
      const y = rawItem.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 6) {
        if (line.trim()) lines.push(line.trim());
        line = rawItem.str;
      } else {
        line += (line && rawItem.str ? ' ' : '') + rawItem.str;
      }
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push({ pageNumber: i, text: lines.join('\n') });
  }

  await loadingTask.destroy();
  return pages;
}

export async function textToDocxBlob(
  pages: Array<{ pageNumber: number; text: string }>,
  docTitle: string
): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      text: docTitle,
      heading: HeadingLevel.HEADING_1,
      bidirectional: containsArabic(docTitle),
    }),
  ];

  for (const p of pages) {
    const paragraphs = p.text.split('\n');
    for (const line of paragraphs) {
      const trimmed = line.trim();
      if (!trimmed) {
        children.push(new Paragraph({ text: '' }));
        continue;
      }
      children.push(
        new Paragraph({
          bidirectional: containsArabic(trimmed),
          children: [
            new TextRun({
              text: trimmed,
              size: 24,
              rightToLeft: containsArabic(trimmed),
            }),
          ],
        })
      );
    }
    if (p.pageNumber < pages.length) {
      children.push(new Paragraph({ text: '' }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });
  return await Packer.toBlob(doc);
}

export async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

export async function textToPdfBytes(text: string, title?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const SCALE = 2;
  const CW = Math.round(PAGE_W * SCALE);
  const CH = Math.round(PAGE_H * SCALE);
  const MARGIN = 96;
  const MAX_TEXT_W = CW - MARGIN * 2;
  const FONT_PX = 28;
  const LINE_H = 44;

  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) throw new Error('Canvas unavailable');
  tempCtx.font = `400 ${FONT_PX}px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif`;

  const allLines: Array<{ text: string; isTitle?: boolean }> = [];
  if (title && title.trim()) {
    allLines.push({ text: title.trim(), isTitle: true });
    allLines.push({ text: '' });
  }

  const rawParas = text.split('\n');
  for (const para of rawParas) {
    if (!para.trim()) {
      allLines.push({ text: '' });
      continue;
    }
    const wrapped = wrapTextLines(tempCtx, para, MAX_TEXT_W);
    for (const w of wrapped) {
      allLines.push({ text: w });
    }
  }

  const linesPerPage = Math.floor((CH - MARGIN * 2) / LINE_H);
  const chunks: Array<Array<{ text: string; isTitle?: boolean }>> = [];
  for (let i = 0; i < allLines.length; i += linesPerPage) {
    chunks.push(allLines.slice(i, i + linesPerPage));
  }
  if (chunks.length === 0) chunks.push([{ text: '' }]);

  for (const chunk of chunks) {
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = '#0F172A';
      ctx.textBaseline = 'top';

      chunk.forEach((lineObj, idx) => {
        if (!lineObj.text) return;
        const isAr = containsArabic(lineObj.text);
        ctx.direction = isAr ? 'rtl' : 'ltr';
        ctx.textAlign = isAr ? 'right' : 'left';
        ctx.font = lineObj.isTitle
          ? `700 38px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif`
          : `400 ${FONT_PX}px "IBM Plex Sans Arabic", "Plus Jakarta Sans", sans-serif`;
        const x = isAr ? CW - MARGIN : MARGIN;
        const y = MARGIN + idx * LINE_H;
        ctx.fillText(lineObj.text, x, y);
      });
    }
    const jpgBytes = dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.92));
    const embedded = await doc.embedJpg(jpgBytes);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawImage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  }

  return await doc.save();
}

async function preprocessImageForOcr(dataUrl: string): Promise<{
  processedUrl: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 2200;
      const minDim = 1200;
      let w = img.naturalWidth || 1000;
      let h = img.naturalHeight || 1000;

      if (Math.max(w, h) > maxDim) {
        const ratio = maxDim / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      } else if (Math.max(w, h) < minDim) {
        const ratio = minDim / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ processedUrl: dataUrl, width: w, height: h });
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      const contrast = 1.45;
      const intercept = 128 * (1 - contrast);

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const adjusted = Math.min(255, Math.max(0, gray * contrast + intercept));
        d[i] = adjusted;
        d[i + 1] = adjusted;
        d[i + 2] = adjusted;
      }
      ctx.putImageData(imageData, 0, 0);

      resolve({
        processedUrl: canvas.toDataURL('image/png'),
        width: w,
        height: h,
      });
    };
    img.onerror = () => resolve({ processedUrl: dataUrl, width: 1000, height: 1000 });
    img.src = dataUrl;
  });
}

export async function runOcrOnImageDataUrl(
  dataUrl: string,
  languageHint: 'auto' | 'ar' | 'en' = 'auto'
): Promise<{
  fullText: string;
  detectedLanguage: string;
  lines: Array<{ text: string; xPercent: number; yPercent: number }>;
}> {
  const { processedUrl, width, height } = await preprocessImageForOcr(dataUrl);

  const tessLang =
    languageHint === 'ar' ? 'ara' : languageHint === 'en' ? 'eng' : 'ara+eng';
  const worker = await createWorker(tessLang);

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
    });

    const { data } = await worker.recognize(processedUrl);
    const fullText = (data.text || '').trim();
    const hasArabic = containsArabic(fullText);

    const lines = (data.lines || [])
      .filter((l) => l.text && l.text.trim())
      .map((l) => ({
        text: l.text.trim(),
        xPercent: l.bbox ? Math.round((l.bbox.x0 / width) * 100) : 8,
        yPercent: l.bbox ? Math.round((l.bbox.y0 / height) * 100) : 10,
      }));

    return {
      fullText,
      detectedLanguage: hasArabic ? 'العربية' : 'English',
      lines,
    };
  } finally {
    await worker.terminate();
  }
}

export async function buildSearchablePdfFromOcr(
  source:
    | { kind: 'pdf'; bytes: Uint8Array }
    | { kind: 'images'; images: Array<{ dataUrl: string; width: number; height: number }> },
  ocrPages: OcrPageResult[]
): Promise<Uint8Array> {
  const outDoc = await PDFDocument.create();
  outDoc.registerFontkit(fontkit);

  const fontBytes = await getUnicodeFontBytes();
  const unicodeFont = fontBytes ? await outDoc.embedFont(fontBytes) : null;

  if (source.kind === 'pdf') {
    const srcDoc = await PDFDocument.load(source.bytes, { ignoreEncryption: true });
    const copied = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copied.forEach((p, idx) => {
      outDoc.addPage(p);
      const ocr = ocrPages.find((o) => o.pageNumber === idx + 1);
      if (ocr && unicodeFont) {
        embedInvisibleSearchableText(p, unicodeFont, ocr);
      }
    });
  } else {
    const A4_W = 595.28;
    const A4_H = 841.89;
    for (let idx = 0; idx < source.images.length; idx++) {
      const imgItem = source.images[idx];
      const norm = await convertDataUrlToJpegOrPngBytes(imgItem.dataUrl);
      const embedded = norm.isPng
        ? await outDoc.embedPng(norm.bytes)
        : await outDoc.embedJpg(norm.bytes);
      const isLandscape = embedded.width > embedded.height * 1.15;
      const pageW = isLandscape ? A4_H : A4_W;
      const pageH = isLandscape ? A4_W : A4_H;
      const page = outDoc.addPage([pageW, pageH]);
      const ratio = Math.min(pageW / embedded.width, pageH / embedded.height);
      const drawW = embedded.width * ratio;
      const drawH = embedded.height * ratio;
      page.drawImage(embedded, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH,
      });

      const ocr = ocrPages.find((o) => o.pageNumber === idx + 1);
      if (ocr && unicodeFont) {
        embedInvisibleSearchableText(page, unicodeFont, ocr);
      }
    }
  }

  return await outDoc.save();
}

function embedInvisibleSearchableText(
  page: ReturnType<PDFDocument['addPage']>,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  ocr: OcrPageResult
) {
  const { width, height } = page.getSize();
  const linesToWrite =
    ocr.lines.length > 0
      ? ocr.lines
      : ocr.fullText
          .split('\n')
          .filter((l) => l.trim())
          .map((text, idx, arr) => ({
            text,
            xPercent: 8,
            yPercent: 8 + ((idx + 1) / Math.max(1, arr.length + 1)) * 84,
          }));

  for (const line of linesToWrite) {
    if (!line.text || !line.text.trim()) continue;
    const safeX = Math.max(12, Math.min(width - 40, (line.xPercent / 100) * width));
    const safeY = Math.max(16, Math.min(height - 16, height - (line.yPercent / 100) * height));
    try {
      page.drawText(line.text, {
        x: safeX,
        y: safeY,
        size: 10,
        font,
        opacity: 0,
      });
    } catch {
      // Skip characters unsupported by embedded TTF font
    }
  }
}

export async function createSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const SCALE = 2;

  const samplePages = [
    {
      kicker: 'مستند تعريفي · صفحة ١ من ٣',
      title: 'تقرير العمل الشهري — نوفمبر ٢٠٢٦',
      body: [
        'هذا ملف PDF تجريبي جاهز لاختبار أدوات التعديل والتحويل والتوقيع مباشرة من هاتفك.',
        'يمكنك إعادة ترتيب الصفحات، حذف أي صفحة، تعديل النصوص، إدراج الصور أو التوقيع، أو استخراج النص.',
        'ملخص الأداء: تم إنجاز ١٤ مشروعاً رقمياً بنسبة التزام بلغت ٩٨٪ خلال الربع الحالي.',
      ],
    },
    {
      kicker: 'قسم البيانات · صفحة ٢ من ٣',
      title: 'نموذج اعتماد وتوقيع إلكتروني',
      body: [
        'الاسم الكامل: ................................................',
        'التاريخ: ١٦ نوفمبر ٢٠٢٦',
        'الملاحظات: استخدم أداة القلم أو التوقيع المحفوظ في الأسفل لإضافة توقيعك على هذه الصفحة.',
      ],
    },
    {
      kicker: 'الملحق الختامي · صفحة ٣ من ٣',
      title: 'خطة التحويل والمشاركة السريعة',
      body: [
        '١. تحويل المستند إلى صور PNG عالية الدقة للمشاركة الفورية.',
        '٢. تصدير النصوص العربية والإنجليزية إلى ملف Word قابل للتحرير (.docx).',
        '٣. ضغط حجم الملف ليصبح مناسباً للإرسال عبر البريد وتطبيقات المراسلة.',
      ],
    },
  ];

  for (const sp of samplePages) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(PAGE_W * SCALE);
    canvas.height = Math.round(PAGE_H * SCALE);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#D92D20';
      ctx.fillRect(90, 95, canvas.width - 180, 6);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748B';
      ctx.font = '500 24px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(sp.kicker, canvas.width - 90, 145);

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 44px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText(sp.title, canvas.width - 90, 210);

      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(90, 255, canvas.width - 180, 2);

      let y = 320;
      ctx.fillStyle = '#1E293B';
      ctx.font = '400 28px "IBM Plex Sans Arabic", sans-serif';
      for (const para of sp.body) {
        const lines = wrapTextLines(ctx, para, canvas.width - 180);
        for (const l of lines) {
          ctx.fillText(l, canvas.width - 90, y);
          y += 48;
        }
        y += 28;
      }
    }
    const jpgBytes = dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.92));
    const embedded = await doc.embedJpg(jpgBytes);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawImage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  }

  return await doc.save();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const isCapacitor = !!(window as Record<string, any>).Capacitor?.isNativePlatform?.();
  if (isCapacitor) {
    try {
      const base64Data = await blobToBase64(blob);
      await Filesystem.writeFile({
        path: `WaraqaPDF/${filename}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      alert(`تم حفظ الملف في المستندات: Documents/WaraqaPDF/${filename}`);
      return;
    } catch (e) {
      console.error('Native save failed, falling back:', e);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareFileIfSupported(blob: Blob, filename: string): Promise<boolean> {
  const isCapacitor = !!(window as Record<string, any>).Capacitor?.isNativePlatform?.();
  if (isCapacitor) {
    try {
      const base64Data = await blobToBase64(blob);
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });
      await Share.share({
        title: filename,
        text: 'تم الإنشاء بواسطة تطبيق ورقة PDF',
        url: saved.uri,
        dialogTitle: 'مشاركة أو طباعة المستند',
      });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false;
    }
    await navigator.share({
      title: filename,
      files: [file],
    });
    return true;
  } catch {
    return false;
  }
}

export async function printPdfBytes(bytes: Uint8Array, filename = 'document.pdf'): Promise<void> {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const isCapacitor = !!(window as Record<string, any>).Capacitor?.isNativePlatform?.();

  if (isCapacitor) {
    const shared = await shareFileIfSupported(blob, filename);
    if (shared) return;
  }

  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 300);
  };
}
