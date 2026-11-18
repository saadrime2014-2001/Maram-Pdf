import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  ScanText,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ConvertMode, OcrPageResult } from '../types/pdf';
import {
  buildSearchablePdfFromOcr,
  bundleImagesAsZip,
  downloadBlob,
  extractDocxText,
  extractTextFromPdf,
  formatBytes,
  imagesToPdf,
  pdfToImages,
  renderSinglePdfPage,
  getPdfPageCount,
  runOcrOnImageDataUrl,
  shareFileIfSupported,
  textToDocxBlob,
  textToPdfBytes,
} from '../utils/pdfEngine';

interface ConverterStudioProps {
  initialMode: ConvertMode;
  activePdf: { name: string; bytes: Uint8Array } | null;
  currentLang: 'ar' | 'en' | 'fr' | 'es';
  onSaveToHistory: (
    name: string,
    bytes: Uint8Array,
    pageCount: number,
    actionLabel: string
  ) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenPdfInEditor: (name: string, bytes: Uint8Array) => void;
}

interface ImageQueueItem {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

const translations = {
  ar: {
    modes: [
      { id: 'img-to-pdf', label: 'صور ← PDF' },
      { id: 'ocr', label: 'التعرف الضوئي OCR' },
      { id: 'pdf-to-img', label: 'PDF ← صور' },
      { id: 'pdf-to-word', label: 'PDF ← Word' },
      { id: 'word-to-pdf', label: 'Word / نص ← PDF' },
    ],
    processing: 'جاري المعالجة...',
    wait: 'يرجى الانتظار',
    // Mode 1
    imgToPdfTitle: 'تحويل الصور إلى ملف PDF',
    imgToPdfDesc: 'التقط صوراً بالكاميرا أو اختر من معرض الهاتف ورتبها بسهولة',
    camera: 'الكاميرا',
    addImages: 'إضافة صور',
    pickImagesPrompt: 'اضغط لاختيار الصور من جهازك',
    pageSize: 'مقاس الصفحة',
    standardA4: 'A4 قياسي',
    imageSize: 'مقاس الصورة',
    margins: 'الهوامش',
    noMargin: 'بدون',
    normalMargin: 'عادي',
    wideMargin: 'واسع',
    createPdf: 'إنشاء ملف PDF',
    download: 'تنزيل',
    share: 'مشاركة',
    openInEditor: 'فتح الملف في المحرر',
    // OCR
    ocrTitle: 'التعرف الضوئي على النص (OCR)',
    ocrDesc: 'استخرج النصوص العربية والإنجليزية من الصور أو ملفات PDF الممسوحة ضوئياً وحوّلها إلى مستند قابل للبحث والتحرير.',
    shootPage: 'تصوير صفحة',
    imageOrPdf: 'صورة أو PDF',
    docLang: 'لغة المستند',
    auto: 'تلقائي',
    arabic: 'العربية',
    english: 'English',
    extractTextNow: 'استخراج النص الآن',
    editableText: 'النص المستخرج القابل للتعديل',
    copy: 'نسخ',
    createSearchablePdf: 'إنشاء PDF قابل للبحث والنسخ',
    exportWord: 'تصدير Word (.docx)',
    downloadTxt: 'تنزيل نص (.txt)',
    cleanTextPdf: 'PDF نصي نظيف',
    // PDF to Images
    pdfToImgTitle: 'تحويل PDF إلى صور',
    changeFile: 'تغيير الملف',
    selectPdf: 'اختيار PDF',
    convertNow: 'تحويل الآن',
    downloadAllZip: 'تنزيل الكل (ZIP)',
    // PDF to Word
    pdfToWordTitle: 'تحويل PDF إلى Word أو نص',
    extractTexts: 'استخراج النصوص',
    ocrHint: 'الملف ممسوح كصورة؟ جرّب OCR',
    // Word to PDF
    wordToPdfTitle: 'تحويل Word أو نص إلى PDF',
    wordToPdfDesc: 'ارفع ملف DOCX أو TXT أو اكتب مستندك مباشرة بخط عربي واضح',
    uploadWordTxt: 'رفع ملف Word / TXT',
    docTitlePlaceholder: 'عنوان المستند (اختياري)',
    docTextPlaceholder: 'اكتب أو الصق النص هنا لتحويله إلى صفحات PDF منسقة...',
  },
  en: {
    modes: [
      { id: 'img-to-pdf', label: 'Images → PDF' },
      { id: 'ocr', label: 'OCR Scan' },
      { id: 'pdf-to-img', label: 'PDF → Images' },
      { id: 'pdf-to-word', label: 'PDF → Word' },
      { id: 'word-to-pdf', label: 'Word / Text → PDF' },
    ],
    processing: 'Processing...',
    wait: 'Please wait',
    imgToPdfTitle: 'Convert Images to PDF',
    imgToPdfDesc: 'Capture photos with camera or choose from gallery and arrange easily',
    camera: 'Camera',
    addImages: 'Add Images',
    pickImagesPrompt: 'Click to choose images from device',
    pageSize: 'Page Size',
    standardA4: 'Standard A4',
    imageSize: 'Image Size',
    margins: 'Margins',
    noMargin: 'None',
    normalMargin: 'Normal',
    wideMargin: 'Wide',
    createPdf: 'Create PDF',
    download: 'Download',
    share: 'Share',
    openInEditor: 'Open in Editor',
    ocrTitle: 'Optical Character Recognition (OCR)',
    ocrDesc: 'Extract multilingual texts from images or scanned PDFs into editable & searchable docs.',
    shootPage: 'Shoot Page',
    imageOrPdf: 'Image or PDF',
    docLang: 'Document Language',
    auto: 'Auto',
    arabic: 'Arabic',
    english: 'English',
    extractTextNow: 'Extract Text Now',
    editableText: 'Extracted Editable Text',
    copy: 'Copy',
    createSearchablePdf: 'Create Searchable PDF',
    exportWord: 'Export Word (.docx)',
    downloadTxt: 'Download Text (.txt)',
    cleanTextPdf: 'Clean Text PDF',
    pdfToImgTitle: 'Convert PDF to Images',
    changeFile: 'Change File',
    selectPdf: 'Select PDF',
    convertNow: 'Convert Now',
    downloadAllZip: 'Download All (ZIP)',
    pdfToWordTitle: 'Convert PDF to Word or Text',
    extractTexts: 'Extract Texts',
    ocrHint: 'Scanned file? Try OCR',
    wordToPdfTitle: 'Convert Word or Text to PDF',
    wordToPdfDesc: 'Upload DOCX, TXT or type your document directly',
    uploadWordTxt: 'Upload Word / TXT',
    docTitlePlaceholder: 'Document title (optional)',
    docTextPlaceholder: 'Type or paste text here to format into PDF pages...',
  },
  fr: {
    modes: [
      { id: 'img-to-pdf', label: 'Images → PDF' },
      { id: 'ocr', label: 'Scan OCR' },
      { id: 'pdf-to-img', label: 'PDF → Images' },
      { id: 'pdf-to-word', label: 'PDF → Word' },
      { id: 'word-to-pdf', label: 'Word / Texte → PDF' },
    ],
    processing: 'Traitement en cours...',
    wait: 'Veuillez patienter',
    imgToPdfTitle: 'Convertir des images en PDF',
    imgToPdfDesc: 'Capturez des photos ou choisissez depuis la galerie et organisez',
    camera: 'Caméra',
    addImages: 'Ajouter des images',
    pickImagesPrompt: 'Cliquez pour choisir des images',
    pageSize: 'Format de page',
    standardA4: 'A4 Standard',
    imageSize: 'Taille originale',
    margins: 'Marges',
    noMargin: 'Aucune',
    normalMargin: 'Normale',
    wideMargin: 'Large',
    createPdf: 'Créer le PDF',
    download: 'Télécharger',
    share: 'Partager',
    openInEditor: 'Ouvrir dans l’éditeur',
    ocrTitle: 'Reconnaissance optique de caractères (OCR)',
    ocrDesc: 'Extrayez du texte multilingue d’images ou de PDF scannés.',
    shootPage: 'Prendre une photo',
    imageOrPdf: 'Image ou PDF',
    docLang: 'Langue du document',
    auto: 'Auto',
    arabic: 'Arabe',
    english: 'Anglais',
    extractTextNow: 'Extraire le texte',
    editableText: 'Texte extrait modifiable',
    copy: 'Copier',
    createSearchablePdf: 'Créer un PDF interrogeable',
    exportWord: 'Exporter Word (.docx)',
    downloadTxt: 'Télécharger Texte (.txt)',
    cleanTextPdf: 'PDF texte propre',
    pdfToImgTitle: 'Convertir PDF en images',
    changeFile: 'Changer de fichier',
    selectPdf: 'Sélectionner un PDF',
    convertNow: 'Convertir',
    downloadAllZip: 'Tout télécharger (ZIP)',
    pdfToWordTitle: 'Convertir PDF en Word ou Texte',
    extractTexts: 'Extraire les textes',
    ocrHint: 'Fichier scanné ? Essayez l’OCR',
    wordToPdfTitle: 'Convertir Word ou Texte en PDF',
    wordToPdfDesc: 'Téléchargez un fichier DOCX, TXT ou tapez directement',
    uploadWordTxt: 'Télécharger Word / TXT',
    docTitlePlaceholder: 'Titre du document (optionnel)',
    docTextPlaceholder: 'Tapez ou collez le texte ici...',
  },
  es: {
    modes: [
      { id: 'img-to-pdf', label: 'Imágenes → PDF' },
      { id: 'ocr', label: 'Escaneo OCR' },
      { id: 'pdf-to-img', label: 'PDF → Imágenes' },
      { id: 'pdf-to-word', label: 'PDF → Word' },
      { id: 'word-to-pdf', label: 'Word / Texto → PDF' },
    ],
    processing: 'Procesando...',
    wait: 'Por favor espere',
    imgToPdfTitle: 'Convertir imágenes a PDF',
    imgToPdfDesc: 'Captura fotos con la cámara o elige de la galería y organízalas',
    camera: 'Cámara',
    addImages: 'Añadir imágenes',
    pickImagesPrompt: 'Haz clic para elegir imágenes',
    pageSize: 'Tamaño de página',
    standardA4: 'A4 Estándar',
    imageSize: 'Tamaño de imagen',
    margins: 'Márgenes',
    noMargin: 'Ninguno',
    normalMargin: 'Normal',
    wideMargin: 'Ancho',
    createPdf: 'Crear PDF',
    download: 'Descargar',
    share: 'Compartir',
    openInEditor: 'Abrir en el editor',
    ocrTitle: 'Reconocimiento óptico de caracteres (OCR)',
    ocrDesc: 'Extrae textos multilingües de imágenes o PDFs escaneados de forma editable.',
    shootPage: 'Capturar página',
    imageOrPdf: 'Imagen o PDF',
    docLang: 'Idioma del documento',
    auto: 'Automático',
    arabic: 'Árabe',
    english: 'Inglés',
    extractTextNow: 'Extraer texto ahora',
    editableText: 'Texto extraído editable',
    copy: 'Copiar',
    createSearchablePdf: 'Crear PDF con capacidad de búsqueda',
    exportWord: 'Exportar Word (.docx)',
    downloadTxt: 'Descargar texto (.txt)',
    cleanTextPdf: 'PDF de texto limpio',
    pdfToImgTitle: 'Convertir PDF a imágenes',
    changeFile: 'Cambiar archivo',
    selectPdf: 'Seleccionar PDF',
    convertNow: 'Convertir ahora',
    downloadAllZip: 'Descargar todo (ZIP)',
    pdfToWordTitle: 'Convertir PDF a Word o Texto',
    extractTexts: 'Extraer textos',
    ocrHint: '¿Archivo escaneado? Prueba OCR',
    wordToPdfTitle: 'Convertir Word o Texto a PDF',
    wordToPdfDesc: 'Sube un archivo DOCX, TXT o escribe tu documento directamente',
    uploadWordTxt: 'Subir Word / TXT',
    docTitlePlaceholder: 'Título del documento (opcional)',
    docTextPlaceholder: 'Escribe o pega el texto aquí para formatearlo en PDF...',
  },
};

export const ConverterStudio: React.FC<ConverterStudioProps> = ({
  initialMode,
  activePdf,
  currentLang,
  onSaveToHistory,
  onNotify,
  onOpenPdfInEditor,
}) => {
  const t = translations[currentLang];
  const [mode, setMode] = useState<ConvertMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Images -> PDF state
  const [imgQueue, setImgQueue] = useState<ImageQueueItem[]>([]);
  const [pageSize, setPageSize] = useState<'a4' | 'fit'>('a4');
  const [margin, setMargin] = useState<number>(24);
  const [imgPdfResult, setImgPdfResult] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  // PDF -> Images state
  const [localPdf, setLocalPdf] = useState<{ name: string; bytes: Uint8Array } | null>(
    activePdf
  );
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png');
  const [exportedImages, setExportedImages] = useState<
    Array<{ pageNumber: number; dataUrl: string; blob: Blob }>
  >([]);

  // PDF -> Word / Text state
  const [extractedPages, setExtractedPages] = useState<
    Array<{ pageNumber: number; text: string }>
  >([]);
  const [editableText, setEditableText] = useState('');

  // Word / Text -> PDF state
  const [docTitle, setDocTitle] = useState('');
  const [docText, setDocText] = useState('');
  const [textPdfResult, setTextPdfResult] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  // OCR state
  const [ocrSource, setOcrSource] = useState<
    | { kind: 'pdf'; name: string; bytes: Uint8Array; pageCount: number }
    | { kind: 'images'; name: string; images: ImageQueueItem[] }
    | null
  >(
    activePdf
      ? { kind: 'pdf', name: activePdf.name, bytes: activePdf.bytes, pageCount: 1 }
      : null
  );
  const [ocrLang, setOcrLang] = useState<'auto' | 'ar' | 'en'>('auto');
  const [ocrResults, setOcrResults] = useState<OcrPageResult[]>([]);
  const [ocrCombinedText, setOcrCombinedText] = useState('');
  const [searchablePdf, setSearchablePdf] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);

  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const wordInputRef = useRef<HTMLInputElement | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement | null>(null);
  const ocrCameraInputRef = useRef<HTMLInputElement | null>(null);

  const currentPdf = localPdf || activePdf;

  const readFileAsDataUrl = (file: File): Promise<ImageQueueItem> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () =>
          resolve({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            dataUrl,
            width: img.naturalWidth || 1000,
            height: img.naturalHeight || 1000,
          });
        img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('تعذر فتح الملف'));
      reader.readAsDataURL(file);
    });

  const handleAddImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const loaded = await Promise.all(Array.from(files).map(readFileAsDataUrl));
      setImgQueue((prev) => [...prev, ...loaded]);
      setImgPdfResult(null);
    } catch {
      onNotify('error', 'تعذر قراءة إحدى الصور المختارة.');
    }
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImgQueue((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const handleConvertImagesToPdf = async () => {
    if (imgQueue.length === 0) return;
    setBusy(true);
    setProgressMsg(t.processing);
    try {
      const bytes = await imagesToPdf(imgQueue, { pageSize, margin });
      const fileName = `images_${Date.now().toString().slice(-4)}.pdf`;
      setImgPdfResult({ name: fileName, bytes });
      await onSaveToHistory(fileName, bytes, imgQueue.length, 'Images to PDF');
      onNotify('success', 'تم تحويل الصور إلى ملف PDF بنجاح.');
    } catch {
      onNotify('error', 'حدث خطأ أثناء إنشاء ملف PDF.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handlePickPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setLocalPdf({ name: file.name, bytes });
    setExportedImages([]);
    setExtractedPages([]);
    setEditableText('');
    e.target.value = '';
  };

  const handlePdfToImages = async () => {
    if (!currentPdf) return;
    setBusy(true);
    setProgressMsg(t.processing);
    try {
      const imgs = await pdfToImages(currentPdf.bytes, imgFormat, 2);
      setExportedImages(imgs);
      onNotify('success', `تم تحويل ${imgs.length} صفحات إلى صور.`);
    } catch {
      onNotify('error', 'تعذر تحويل الملف إلى صور.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleDownloadImagesZip = async () => {
    if (!currentPdf || exportedImages.length === 0) return;
    const zipBlob = await bundleImagesAsZip(exportedImages, imgFormat, currentPdf.name);
    const zipName = `${currentPdf.name.replace(/\.pdf$/i, '')}_images.zip`;
    downloadBlob(zipBlob, zipName);
  };

  const handleExtractDigitalText = async () => {
    if (!currentPdf) return;
    setBusy(true);
    setProgressMsg(t.processing);
    try {
      const pages = await extractTextFromPdf(currentPdf.bytes);
      setExtractedPages(pages);
      const joined = pages.map((p) => p.text).filter(Boolean).join('\n\n');
      setEditableText(joined);
      if (!joined.trim()) {
        onNotify('info', 'هذا الملف يبدو ممسوحاً ضوئياً كصور. استخدم تبويب التعرف الضوئي OCR.');
      } else {
        onNotify('success', 'تم استخراج النصوص بنجاح.');
      }
    } catch {
      onNotify('error', 'تعذر استخراج النصوص من هذا الملف.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleDownloadWordFromText = async (textContent: string, baseName: string) => {
    const paragraphs = textContent.split(/\n{2,}/).map((t, i) => ({
      pageNumber: i + 1,
      text: t,
    }));
    const blob = await textToDocxBlob(
      paragraphs.length > 0 ? paragraphs : [{ pageNumber: 1, text: textContent }],
      baseName
    );
    downloadBlob(blob, `${baseName}.docx`);
    onNotify('success', 'تم تنزيل ملف Word (.docx).');
  };

  const handleUploadWordOrText = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setProgressMsg(t.processing);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'docx') {
        const text = await extractDocxText(await file.arrayBuffer());
        setDocText(text);
        setDocTitle(file.name.replace(/\.docx$/i, ''));
      } else {
        const text = await file.text();
        setDocText(text);
        setDocTitle(file.name.replace(/\.(txt|md)$/i, ''));
      }
      setTextPdfResult(null);
      onNotify('success', 'تم استيراد محتوى المستند.');
    } catch {
      onNotify('error', 'تعذر قراءة الملف.');
    } finally {
      setBusy(false);
      setProgressMsg('');
      e.target.value = '';
    }
  };

  const handleBuildPdfFromText = async () => {
    if (!docText.trim()) return;
    setBusy(true);
    setProgressMsg(t.processing);
    try {
      const bytes = await textToPdfBytes(docText, docTitle);
      const count = await getPdfPageCount(bytes);
      const name = `${docTitle.trim() || 'document'}.pdf`;
      setTextPdfResult({ name, bytes });
      await onSaveToHistory(name, bytes, count, 'Text to PDF');
      onNotify('success', 'تم إنشاء ملف PDF بنجاح.');
    } catch {
      onNotify('error', 'حدث خطأ أثناء إنشاء ملف PDF.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleSelectOcrFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setOcrResults([]);
    setOcrCombinedText('');
    setSearchablePdf(null);

    const first = files[0];
    if (first.type === 'application/pdf' || first.name.toLowerCase().endsWith('.pdf')) {
      const bytes = new Uint8Array(await first.arrayBuffer());
      const pageCount = await getPdfPageCount(bytes);
      setOcrSource({ kind: 'pdf', name: first.name, bytes, pageCount });
    } else {
      const imgs = await Promise.all(Array.from(files).map(readFileAsDataUrl));
      setOcrSource({
        kind: 'images',
        name: imgs.length === 1 ? imgs[0].name : `${imgs.length}_images`,
        images: imgs,
      });
    }
  };

  const handleRunOcr = async () => {
    const src =
      ocrSource ||
      (currentPdf
        ? {
            kind: 'pdf' as const,
            name: currentPdf.name,
            bytes: currentPdf.bytes,
            pageCount: 0,
          }
        : null);
    if (!src) return;

    setBusy(true);
    setOcrResults([]);
    setSearchablePdf(null);

    try {
      const results: OcrPageResult[] = [];
      if (src.kind === 'images') {
        for (let i = 0; i < src.images.length; i++) {
          setProgressMsg(`${t.processing} (${i + 1}/${src.images.length})`);
          const res = await runOcrOnImageDataUrl(src.images[i].dataUrl, ocrLang);
          results.push({
            pageNumber: i + 1,
            fullText: res.fullText,
            detectedLanguage: res.detectedLanguage,
            lines: res.lines,
          });
        }
      } else {
        const total = src.pageCount || (await getPdfPageCount(src.bytes));
        const limit = Math.min(total, 10);
        for (let i = 0; i < limit; i++) {
          setProgressMsg(`${t.processing} (${i + 1}/${limit})`);
          const rendered = await renderSinglePdfPage(src.bytes, i, 1.8, 0);
          const res = await runOcrOnImageDataUrl(rendered.dataUrl, ocrLang);
          results.push({
            pageNumber: i + 1,
            fullText: res.fullText,
            detectedLanguage: res.detectedLanguage,
            lines: res.lines,
          });
        }
      }

      setOcrResults(results);
      setOcrCombinedText(
        results
          .map((r) => r.fullText)
          .filter(Boolean)
          .join('\n\n')
      );
      onNotify('success', 'تم استخراج النص بنجاح!');
    } catch {
      onNotify('error', 'تعذر إتمام التعرف الضوئي.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleCreateSearchablePdf = async () => {
    const src =
      ocrSource ||
      (currentPdf
        ? { kind: 'pdf' as const, name: currentPdf.name, bytes: currentPdf.bytes, pageCount: 1 }
        : null);
    if (!src || ocrResults.length === 0) return;

    setBusy(true);
    setProgressMsg(t.processing);
    try {
      const syncedResults = ocrResults.map((r, idx) =>
        ocrResults.length === 1 && idx === 0
          ? { ...r, fullText: ocrCombinedText }
          : r
      );

      const bytes = await buildSearchablePdfFromOcr(
        src.kind === 'pdf'
          ? { kind: 'pdf', bytes: src.bytes }
          : { kind: 'images', images: src.images },
        syncedResults
      );
      const count = await getPdfPageCount(bytes);
      const base = src.name.replace(/\.[^.]+$/, '');
      const outName = `${base}_searchable.pdf`;
      setSearchablePdf({ name: outName, bytes });
      await onSaveToHistory(outName, bytes, count, 'OCR Searchable PDF');
      onNotify('success', 'تم إنشاء ملف PDF قابل للبحث بنجاح.');
    } catch {
      onNotify('error', 'حدث خطأ أثناء بناء PDF.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  return (
    <div className={`max-w-6xl mx-auto px-4 md:px-6 py-5 pb-24 md:pb-12 space-y-6 ${currentLang === 'ar' ? 'text-right' : 'text-left'}`}>
      {/* Mode Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 rounded-2xl overflow-x-auto no-scrollbar">
        {t.modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id as ConvertMode)}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs md:text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              mode === m.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {busy && (
        <div className="rounded-2xl bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between text-sm">
          <span>{progressMsg || t.processing}</span>
          <span className="text-xs text-slate-300">{t.wait}</span>
        </div>
      )}

      {/* MODE 1: Images -> PDF */}
      {mode === 'img-to-pdf' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t.imgToPdfTitle}</h2>
                <p className="text-sm text-slate-500">{t.imgToPdfDesc}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs md:text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-red-600" />
                  <span>{t.camera}</span>
                </button>
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-medium hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{t.addImages}</span>
                </button>
              </div>
            </div>

            {imgQueue.length === 0 ? (
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                className="w-full py-14 rounded-2xl border-2 border-dashed border-slate-200 hover:border-red-300 bg-slate-50/70 flex flex-col items-center justify-center gap-2 text-slate-600 cursor-pointer transition-colors"
              >
                <Upload className="w-7 h-7 text-red-600" />
                <span className="text-sm font-semibold text-slate-800">
                  {t.pickImagesPrompt}
                </span>
                <span className="text-xs text-slate-500">PNG · JPG · WEBP</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {imgQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2 flex flex-col gap-2"
                  >
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white border border-slate-100">
                      <img
                        src={item.dataUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-mono-num text-slate-600">
                        #{idx + 1}
                      </span>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(idx, 1)}
                          disabled={idx === imgQueue.length - 1}
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center text-slate-600 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setImgQueue((q) => q.filter((x) => x.id !== item.id))
                          }
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <h3 className="text-base font-bold text-slate-900">{t.pageSize}</h3>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPageSize('a4')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                  pageSize === 'a4' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {t.standardA4}
              </button>
              <button
                type="button"
                onClick={() => setPageSize('fit')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                  pageSize === 'fit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {t.imageSize}
              </button>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-600 mb-2">{t.margins}</span>
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                {[
                  { val: 0, label: t.noMargin },
                  { val: 24, label: t.normalMargin },
                  { val: 48, label: t.wideMargin },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setMargin(opt.val)}
                    className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                      margin === opt.val
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={imgQueue.length === 0 || busy}
              onClick={handleConvertImagesToPdf}
              className="w-full min-h-[48px] rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 cursor-pointer"
            >
              {t.createPdf} ({imgQueue.length})
            </button>

            {imgPdfResult && (
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <p className="text-xs text-slate-600 font-mono-num">
                  {formatBytes(imgPdfResult.bytes.byteLength)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadBlob(
                        new Blob([imgPdfResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                        imgPdfResult.name
                      )
                    }
                    className="min-h-[44px] rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.download}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      shareFileIfSupported(
                        new Blob([imgPdfResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                        imgPdfResult.name
                      ).then((ok) => {
                        if (!ok) {
                          downloadBlob(
                            new Blob([imgPdfResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                            imgPdfResult.name
                          );
                        }
                      })
                    }
                    className="min-h-[44px] rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{t.share}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPdfInEditor(imgPdfResult.name, imgPdfResult.bytes)
                  }
                  className="w-full min-h-[42px] rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  {t.openInEditor}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: OCR */}
      {mode === 'ocr' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t.ocrTitle}</h2>
              <p className="text-sm text-slate-500 mt-1">{t.ocrDesc}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => ocrCameraInputRef.current?.click()}
                className="min-h-[48px] px-3 rounded-xl border border-slate-200 text-slate-800 text-xs md:text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-red-600" />
                <span>{t.shootPage}</span>
              </button>
              <button
                type="button"
                onClick={() => ocrFileInputRef.current?.click()}
                className="min-h-[48px] px-3 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{t.imageOrPdf}</span>
              </button>
            </div>

            {(ocrSource || currentPdf) && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {ocrSource ? ocrSource.name : currentPdf?.name}
                </p>
              </div>
            )}

            <div>
              <span className="block text-xs font-medium text-slate-600 mb-2">{t.docLang}</span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                {[
                  { id: 'auto' as const, label: t.auto },
                  { id: 'ar' as const, label: t.arabic },
                  { id: 'en' as const, label: t.english },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setOcrLang(l.id)}
                    className={`min-h-[40px] rounded-lg text-xs font-semibold cursor-pointer ${
                      ocrLang === l.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={(!ocrSource && !currentPdf) || busy}
              onClick={handleRunOcr}
              className="w-full min-h-[48px] rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ScanText className="w-4 h-4" />
              <span>{t.extractTextNow}</span>
            </button>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">{t.editableText}</h3>
              {ocrCombinedText && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(ocrCombinedText);
                    onNotify('success', 'Copied.');
                  }}
                  className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t.copy}</span>
                </button>
              )}
            </div>

            <textarea
              rows={11}
              value={ocrCombinedText}
              onChange={(e) => setOcrCombinedText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3.5 text-sm leading-relaxed text-slate-900 focus:outline-none focus:border-red-600"
            />

            {ocrResults.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCreateSearchablePdf}
                    className="sm:col-span-3 min-h-[48px] rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{t.createSearchablePdf}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadWordFromText(
                        ocrCombinedText,
                        (ocrSource?.name || 'ocr').replace(/\.[^.]+$/, '')
                      )
                    }
                    className="min-h-[44px] rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.exportWord}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadBlob(
                        new Blob([ocrCombinedText], { type: 'text/plain;charset=utf-8' }),
                        `ocr.txt`
                      )
                    }
                    className="min-h-[44px] rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{t.downloadTxt}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const bytes = await textToPdfBytes(ocrCombinedText);
                      downloadBlob(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }), 'ocr.pdf');
                    }}
                    className="min-h-[44px] rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{t.cleanTextPdf}</span>
                  </button>
                </div>

                {searchablePdf && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900">
                      PDF Ready ({formatBytes(searchablePdf.bytes.byteLength)})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlob(
                          new Blob([searchablePdf.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                          searchablePdf.name
                        )
                      }
                      className="min-h-[38px] px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      {t.download}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 3: PDF -> Images */}
      {mode === 'pdf-to-img' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t.pdfToImgTitle}</h2>
              <p className="text-sm text-slate-500">
                {currentPdf ? currentPdf.name : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                {(['png', 'jpeg'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setImgFormat(fmt)}
                    className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold uppercase cursor-pointer ${
                      imgFormat === fmt ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-xs md:text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                {currentPdf ? t.changeFile : t.selectPdf}
              </button>
              {currentPdf && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePdfToImages}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs md:text-sm font-semibold hover:bg-red-700 cursor-pointer"
                >
                  {t.convertNow}
                </button>
              )}
            </div>
          </div>

          {exportedImages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  {exportedImages.length} images
                </span>
                <button
                  type="button"
                  onClick={handleDownloadImagesZip}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.downloadAllZip}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {exportedImages.map((item) => (
                  <div
                    key={item.pageNumber}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2"
                  >
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white">
                      <img
                        src={item.dataUrl}
                        alt={`Page ${item.pageNumber}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadBlob(item.blob, `page_${item.pageNumber}.${imgFormat}`)}
                      className="w-full min-h-[36px] rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-100 cursor-pointer"
                    >
                      {t.download}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 4: PDF -> Word */}
      {mode === 'pdf-to-word' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t.pdfToWordTitle}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-xs md:text-sm font-medium text-slate-800 cursor-pointer"
              >
                {currentPdf ? t.changeFile : t.selectPdf}
              </button>
              {currentPdf && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleExtractDigitalText}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs md:text-sm font-semibold hover:bg-red-700 cursor-pointer"
                >
                  {t.extractTexts}
                </button>
              )}
            </div>
          </div>

          {extractedPages.length > 0 && (
            <div className="space-y-4">
              <textarea
                rows={10}
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3.5 text-sm leading-relaxed text-slate-900 focus:outline-none focus:border-red-600"
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDownloadWordFromText(editableText, 'document')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Word (.docx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('ocr')}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-red-600 text-xs font-semibold hover:bg-red-50 cursor-pointer"
                >
                  {t.ocrHint}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 5: Word / Text -> PDF */}
      {mode === 'word-to-pdf' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t.wordToPdfTitle}</h2>
              <p className="text-sm text-slate-500">{t.wordToPdfDesc}</p>
            </div>
            <button
              type="button"
              onClick={() => wordInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-medium flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{t.uploadWordTxt}</span>
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder={t.docTitlePlaceholder}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:outline-none focus:border-red-600"
            />
            <textarea
              rows={9}
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder={t.docTextPlaceholder}
              className="w-full rounded-xl border border-slate-200 p-3.5 text-sm leading-relaxed text-slate-900 focus:outline-none focus:border-red-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!docText.trim() || busy}
              onClick={handleBuildPdfFromText}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 cursor-pointer"
            >
              {t.createPdf}
            </button>

            {textPdfResult && (
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    new Blob([textPdfResult.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                    textPdfResult.name
                  )
                }
                className="min-h-[48px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t.download}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleAddImages(e.target.files); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleAddImages(e.target.files); e.target.value = ''; }} />
      <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handlePickPdf} />
      <input ref={wordInputRef} type="file" accept=".docx,.txt,.md" className="hidden" onChange={handleUploadWordOrText} />
      <input ref={ocrFileInputRef} type="file" accept="image/*,application/pdf,.pdf" multiple className="hidden" onChange={(e) => { handleSelectOcrFiles(e.target.files); e.target.value = ''; }} />
      <input ref={ocrCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleSelectOcrFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
};
