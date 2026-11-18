import React from 'react';
import {
  Camera,
  FileText,
  ImagePlus,
  Layers,
  Minimize2,
  PenLine,
  ScanText,
  Scissors,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { ConvertMode, EditMode, StoredPdfFile } from '../types/pdf';
import { formatBytes, formatRelativeTime } from '../utils/pdfEngine';

interface HomeHubProps {
  recentFiles: StoredPdfFile[];
  currentLang: 'ar' | 'en' | 'fr' | 'es';
  onPickPdf: () => void;
  onLoadSamplePdf: () => void;
  onStartConvert: (mode: ConvertMode) => void;
  onStartEdit: (mode: EditMode) => void;
  onOpenRecentFile: (file: StoredPdfFile) => void;
}

// قاموس الترجمات للغات الأربع
const translations = {
  ar: {
    badge: 'استوديو PDF متكامل يعمل بالكامل على هاتفك',
    title: 'حرّر، امسح بالكاميرا، وحوّل مستنداتك بلمسة واحدة',
    desc: 'صوّر أوراقك بكاميرا الهاتف وحوّلها لملف PDF احترافي، أو عدّل نصوص ومستندات PDF وأضف توقيعك واستخرج النصوص بسرعة وخصوصية تامة.',
    pickPdf: 'اختيار ملف PDF',
    cameraScan: 'سكان بالكاميرا',
    ocrScan: 'مسح ضوئي OCR',
    sampleTry: 'تجربة بملف جاهز',
    dropBox: 'اضغط لرفع ملف PDF أو اسحبه هنا',
    dropDesc: 'دعم كامل للغات العربية، الإنجليزية، الفرنسية والإسبانية دون إنترنت',
    quickTools: 'الأدوات السريعة',
    compress: 'ضغط الحجم',
    recentFiles: 'أحدث الملفات',
    open: 'فتح',
    pagesCount: 'صفحات',
    devAr: 'تطوير: عبد القادر العواد الحيمودي',
    devEn: 'Developed by Abdelkader El aouad El haimoudi',
    tools: [
      {
        title: 'مسح بالكاميرا (Scan to PDF)',
        desc: 'صوّر المستندات والوثائق الورقية بكاميرا الهاتف وحوّلها فوراً إلى PDF واضح ومقروء.',
      },
      {
        title: 'تعديل النصوص والصفحات',
        desc: 'عدّل النصوص وخطوطها وألوانها، أدرج صوراً وتوقيعاً، ورتب أو احذف الصفحات.',
      },
      {
        title: 'التعرف الضوئي (OCR)',
        desc: 'استخرج النصوص متعددة اللغات من الصور وملفات PDF الممسوحة واجعلها قابلة للبحث.',
      },
      {
        title: 'صور إلى PDF',
        desc: 'حوّل صور الهاتف إلى مستند PDF منسق بمقاس A4 أو بالحجم الأصلي.',
      },
      {
        title: 'دمج ملفات PDF',
        desc: 'اجمع عدة مستندات PDF في ملف واحد بالترتيب الذي تختاره.',
      },
      {
        title: 'تقسيم واستخراج',
        desc: 'استخرج صفحات محددة أو افصل كل صفحة في ملف مستقل داخل حزمة ZIP.',
      },
      {
        title: 'PDF إلى Word أو صور',
        desc: 'حوّل المستند إلى صور PNG/JPG عالية الدقة أو ملف قابل للتحرير.',
      },
    ],
  },
  en: {
    badge: 'Complete PDF studio working fully on your phone',
    title: 'Edit, scan, and convert your documents in one touch',
    desc: 'Capture paperwork with your phone camera into a professional PDF, edit PDF texts, add your signature, and extract text securely.',
    pickPdf: 'Choose PDF file',
    cameraScan: 'Camera Scan',
    ocrScan: 'OCR Scan',
    sampleTry: 'Try sample file',
    dropBox: 'Click to upload PDF or drag here',
    dropDesc: 'Full offline support for Arabic, English, French and Spanish',
    quickTools: 'Quick Tools',
    compress: 'Compress',
    recentFiles: 'Recent Files',
    open: 'Open',
    pagesCount: 'pages',
    devAr: 'تطوير: عبد القادر العواد الحيمودي',
    devEn: 'Developed by Abdelkader El aouad El haimoudi',
    tools: [
      {
        title: 'Scan to PDF',
        desc: 'Capture physical documents with your phone camera into clear PDFs.',
      },
      {
        title: 'Edit Text & Pages',
        desc: 'Edit texts, fonts, colors, insert images, signatures, and manage pages.',
      },
      {
        title: 'OCR Text Recognition',
        desc: 'Extract multilingual text from images and scanned PDFs easily.',
      },
      {
        title: 'Images to PDF',
        desc: 'Convert phone images into formatted A4 or original size PDF documents.',
      },
      {
        title: 'Merge PDFs',
        desc: 'Combine multiple PDF documents into a single file in your preferred order.',
      },
      {
        title: 'Split & Extract',
        desc: 'Extract specific pages or split each page into a separate file in a ZIP.',
      },
      {
        title: 'PDF to Word or Images',
        desc: 'Convert your document into high-res PNG/JPG images or editable files.',
      },
    ],
  },
  fr: {
    badge: 'Studio PDF complet fonctionnant entièrement sur votre téléphone',
    title: 'Éditez, scannez et convertissez vos documents en un geste',
    desc: 'Photographiez vos documents avec votre téléphone en PDF professionnel, modifiez les textes, signez et extrayez du texte en toute sécurité.',
    pickPdf: 'Choisir un PDF',
    cameraScan: 'Scan Caméra',
    ocrScan: 'Scan OCR',
    sampleTry: 'Essayer un exemple',
    dropBox: 'Cliquez pour téléverser un PDF ou glissez-le ici',
    dropDesc: 'Support complet hors ligne pour arabe, anglais, français et espagnol',
    quickTools: 'Outils rapides',
    compress: 'Compresser',
    recentFiles: 'Fichiers récents',
    open: 'Ouvrir',
    pagesCount: 'pages',
    devAr: 'تطوير: عبد القادر العواد الحيمودي',
    devEn: 'Developed by Abdelkader El aouad El haimoudi',
    tools: [
      {
        title: 'Scanner en PDF',
        desc: 'Capturez des documents papier avec votre caméra en PDF clairs.',
      },
      {
        title: 'Éditer Texte & Pages',
        desc: 'Modifiez textes, polices, couleurs, insérez des signatures et gérez les pages.',
      },
      {
        title: 'Reconnaissance OCR',
        desc: 'Extrayez du texte multilingue à partir d’images et de PDF scannés.',
      },
      {
        title: 'Images vers PDF',
        desc: 'Convertissez des images en documents PDF formatés A4 ou taille d’origine.',
      },
      {
        title: 'Fusionner des PDF',
        desc: 'Combinez plusieurs documents PDF en un seul fichier dans l’ordre voulu.',
      },
      {
        title: 'Diviser & Extraire',
        desc: 'Extrayez des pages spécifiques ou séparez chaque page dans un fichier ZIP.',
      },
      {
        title: 'PDF vers Word ou Images',
        desc: 'Convertissez votre document en images PNG/JPG haute résolution.',
      },
    ],
  },
  es: {
    badge: 'Estudio PDF completo que funciona totalmente en tu teléfono',
    title: 'Edita, escanea y convierte tus documentos con un solo toque',
    desc: 'Captura documentos con la cámara de tu teléfono en un PDF profesional, edita textos, añade tu firma y extrae texto de forma segura.',
    pickPdf: 'Elegir archivo PDF',
    cameraScan: 'Escanear',
    ocrScan: 'Escaneo OCR',
    sampleTry: 'Probar muestra',
    dropBox: 'Haz clic para subir un PDF o arrástralo aquí',
    dropDesc: 'Soporte completo sin conexión para árabe, inglés, francés y español',
    quickTools: 'Herramientas rápidas',
    compress: 'Comprimir',
    recentFiles: 'Archivos recientes',
    open: 'Abrir',
    pagesCount: 'páginas',
    devAr: 'تطوير: عبد القادر العواد الحيمودي',
    devEn: 'Developed by Abdelkader El aouad El haimoudi',
    tools: [
      {
        title: 'Escanear a PDF',
        desc: 'Captura documentos físicos con la cámara en PDFs claros y legibles.',
      },
      {
        title: 'Editar Textos y Páginas',
        desc: 'Edita textos, fuentes, colores, inserta firmas y organiza páginas.',
      },
      {
        title: 'Reconocimiento OCR',
        desc: 'Extrae texto multilingüe de imágenes y PDFs escaneados fácilmente.',
      },
      {
        title: 'Imágenes a PDF',
        desc: 'Convierte imágenes del teléfono en documentos PDF formateados.',
      },
      {
        title: 'Unir PDFs',
        desc: 'Combina varios documentos PDF en un solo archivo en el orden deseado.',
      },
      {
        title: 'Dividir y Extraer',
        desc: 'Extrae páginas específicas o separa cada página en un archivo ZIP.',
      },
      {
        title: 'PDF a Word o Imágenes',
        desc: 'Convierte tu documento en imágenes PNG/JPG de alta resolución.',
      },
    ],
  },
};

export const HomeHub: React.FC<HomeHubProps> = ({
  recentFiles,
  currentLang,
  onPickPdf,
  onLoadSamplePdf,
  onStartConvert,
  onStartEdit,
  onOpenRecentFile,
}) => {
  const t = translations[currentLang];

  const toolsConfig = [
    {
      icon: Camera,
      accent: 'bg-rose-50 text-rose-600',
      onClick: () => onStartConvert('img-to-pdf'),
    },
    {
      icon: PenLine,
      accent: 'bg-red-50 text-red-600',
      onClick: () => onStartEdit('pages'),
    },
    {
      icon: ScanText,
      accent: 'bg-amber-50 text-amber-700',
      onClick: () => onStartConvert('ocr'),
    },
    {
      icon: ImagePlus,
      accent: 'bg-sky-50 text-sky-700',
      onClick: () => onStartConvert('img-to-pdf'),
    },
    {
      icon: Layers,
      accent: 'bg-emerald-50 text-emerald-700',
      onClick: () => onStartEdit('merge'),
    },
    {
      icon: Scissors,
      accent: 'bg-violet-50 text-violet-700',
      onClick: () => onStartEdit('split'),
    },
    {
      icon: FileText,
      accent: 'bg-slate-100 text-slate-700',
      onClick: () => onStartConvert('pdf-to-word'),
    },
  ];

  const tools = t.tools.map((item, index) => ({
    ...item,
    ...toolsConfig[index],
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-24 md:pb-12 space-y-8">
      {/* Decorated Modern Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-red-950 text-white p-6 md:p-10 shadow-lg border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        <div className="pointer-events-none absolute -top-
