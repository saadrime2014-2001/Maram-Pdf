export type AppSection = 'home' | 'convert' | 'edit' | 'files';

export type ConvertMode = 'img-to-pdf' | 'pdf-to-img' | 'pdf-to-word' | 'word-to-pdf' | 'ocr';

export type EditMode = 'pages' | 'merge' | 'split' | 'compress';

export type TextFontFamily = 'sans' | 'serif' | 'mono';

export interface PdfPagePreview {
  id: string;
  originalIndex: number; // 0-based index in source PDF
  rotation: number; // 0, 90, 180, 270
  deleted: boolean;
  thumbnailUrl: string;
  width: number;
  height: number;
}

export interface StrokeAnnotation {
  id: string;
  type: 'pen' | 'highlight';
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>; // normalized 0..1 coordinates
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  text: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number; // normalized 0..1 box width
  color: string;
  fontFamily: TextFontFamily;
  fontSize: number; // relative to 1000px reference width
  bold: boolean;
  align: 'right' | 'center' | 'left';
  backgroundColor: 'transparent' | '#FFFFFF';
}

export interface ImageAnnotation {
  id: string;
  type: 'image' | 'signature';
  dataUrl: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  width: number; // normalized 0..1
  height: number; // normalized 0..1
  opacity: number; // 0.1..1
}

export type PageAnnotation = StrokeAnnotation | TextAnnotation | ImageAnnotation;

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  opacity: number;
  color: string;
  angle: number;
}

export interface OcrLineItem {
  text: string;
  xPercent: number;
  yPercent: number;
}

export interface OcrPageResult {
  pageNumber: number;
  fullText: string;
  detectedLanguage: string;
  lines: OcrLineItem[];
}

export interface StoredPdfFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  size: number;
  updatedAt: number;
  actionLabel: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}
