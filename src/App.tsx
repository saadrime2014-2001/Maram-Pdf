import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { HomeHub } from './components/HomeHub';
import { ConverterStudio } from './components/ConverterStudio';
import { PdfEditorStudio } from './components/PdfEditorStudio';
import { RecentFilesView } from './components/RecentFilesView';
import type {
  AppSection,
  ConvertMode,
  EditMode,
  StoredPdfFile,
  ToastMessage,
} from './types/pdf';
import {
  deleteRecentFile,
  listRecentFiles,
  saveRecentFile,
} from './utils/localStore';
import { createSamplePdf, getPdfPageCount } from './utils/pdfEngine';

// قاموس الترجمات للغات الأربع
const t = {
  ar: {
    opened: 'ملف مفتوح',
    openError: 'تعذر فتح ملف PDF. تأكد من سلامة الملف.',
    imported: 'تم استيراد ملف PDF بنجاح.',
    importError: 'تعذر قراءة ملف PDF المُمرر من النظام.',
    sampleReady: 'تم تجهيز المستند التجريبي. اضغط على أي صفحة لتعديلها.',
    sampleError: 'تعذر إنشاء الملف التجريبي.',
    deleted: 'تم حذف الملف من السجل المحلي.',
  },
  en: {
    opened: 'Opened file',
    openError: 'Could not open PDF. Please check the file.',
    imported: 'PDF imported successfully.',
    importError: 'Could not read system PDF file.',
    sampleReady: 'Sample document ready. Tap any page to edit.',
    sampleError: 'Could not create sample file.',
    deleted: 'File deleted from local history.',
  },
  fr: {
    opened: 'Fichier ouvert',
    openError: 'Impossible d\'ouvrir le PDF. Vérifiez le fichier.',
    imported: 'PDF importé avec succès.',
    importError: 'Impossible de lire le fichier PDF système.',
    sampleReady: 'Document exemple prêt. Touchez une page pour modifier.',
    sampleError: 'Impossible de créer le fichier exemple.',
    deleted: 'Fichier supprimé de l\'historique local.',
  },
  es: {
    opened: 'Archivo abierto',
    openError: 'No se pudo abrir el PDF. Compruebe el archivo.',
    imported: 'PDF importado con éxito.',
    importError: 'No se pudo leer el archivo PDF del sistema.',
    sampleReady: 'Documento de muestra listo. Toca cualquier página.',
    sampleError: 'No se pudo crear el archivo de muestra.',
    deleted: 'Archivo eliminado del historial local.',
  },
};

export default function App() {
  const [section, setSection] = useState<AppSection>('home');
  const [convertMode, setConvertMode] = useState<ConvertMode>('img-to-pdf');
  const [editMode, setEditMode] = useState<EditMode>('pages');
  const [lang, setLang] = useState<'ar' | 'en' | 'fr' | 'es'>('es'); // تم تعيين الإسبانية كاللغة الافتتاحية
  const [activePdf, setActivePdf] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);
  const [recentFiles, setRecentFiles] = useState<StoredPdfFile[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [annotatorActive, setAnnotatorActive] = useState(false);

  const globalPdfInputRef = useRef<HTMLInputElement | null>(null);

  // تحديث اتجاه الصفحة بناءً على اللغة
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const notify = useCallback(
    (type: ToastMessage['type'], text: string) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [...prev.slice(-2), { id, type, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  const refreshRecentFiles = useCallback(async () => {
    const items = await listRecentFiles();
    setRecentFiles(items);
  }, []);

  useEffect(() => {
    refreshRecentFiles();
  }, [refreshRecentFiles]);

  const handleSaveToHistory = useCallback(
    async (
      name: string,
      bytes: Uint8Array,
      pageCount: number,
      actionLabel: string
    ) => {
      await saveRecentFile({
        name,
        bytes,
        pageCount,
        size: bytes.byteLength,
        actionLabel,
      });
      await refreshRecentFiles();
    },
    [refreshRecentFiles]
  );

  const openPdfBuffer = useCallback(
    async (name: string, bytes: Uint8Array, targetSection: AppSection = 'edit') => {
      try {
        const count = await getPdfPageCount(bytes);
        setActivePdf({ name, bytes });
        await handleSaveToHistory(name, bytes, count, t[lang].opened);
        setSection(targetSection);
      } catch {
        notify('error', t[lang].openError);
      }
    },
    [handleSaveToHistory, notify, lang]
  );

  useEffect(() => {
    const checkIncomingPdf = async () => {
      const params = new URLSearchParams(window.location.search);
      const sharedUri = params.get('openPdfUri');
      if (!sharedUri) return;

      window.history.replaceState({}, '', window.location.pathname);

      try {
        const decodedUri = decodeURIComponent(sharedUri);
        const cap = (window as Record<string, any>).Capacitor;
        const convertedUrl = cap?.convertFileSrc
          ? cap.convertFileSrc(decodedUri)
          : decodedUri;

        const response = await fetch(convertedUrl);
        if (!response.ok) throw new Error('Failed to read file URI');

        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const rawName = decodedUri.split('/').pop()?.split('?')[0] || '';
        const fileName = rawName.toLowerCase().endsWith('.pdf')
          ? decodeURIComponent(rawName)
          : 'document.pdf';

        await openPdfBuffer(fileName, bytes, 'edit');
        setEditMode('pages');
        notify('success', t[lang].imported);
      } catch {
        notify('error', t[lang].importError);
      }
    };

    checkIncomingPdf();
  }, [openPdfBuffer, notify, lang]);

  const handleGlobalFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await openPdfBuffer(file.name, bytes, 'edit');
    setEditMode('pages');
    e.target.value = '';
  };

  const handleLoadSamplePdf = async () => {
    try {
      const bytes = await createSamplePdf();
      await openPdfBuffer('sample.pdf', bytes, 'edit');
      setEditMode('pages');
      notify('success', t[lang].sampleReady);
    } catch {
      notify('error', t[lang].sampleError);
    }
  };

  const handleDeleteRecent = async (id: string) => {
    await deleteRecentFile(id);
    await refreshRecentFiles();
    notify('info', t[lang].deleted);
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900 flex flex-col">
      {!annotatorActive && (
        <TopBar
          activeSection={section}
          onNavigate={setSection}
          onOpenFilePicker={() => globalPdfInputRef.current?.click()}
          currentLang={lang}
          onLanguageChange={setLang}
          subViewTitle={
            section !== 'home'
              ? section === 'convert'
                ? 'Converter / تحويل'
                : section === 'edit'
                  ? 'Editor / محرر'
                  : 'Files / ملفاتي'
              : undefined
          }
          onBackFromSubView={
            section !== 'home' ? () => setSection('home') : undefined
          }
        />
      )}

      <main className="flex-1">
        {section === 'home' && (
          <HomeHub
            recentFiles={recentFiles}
            currentLang={lang}
            onPickPdf={() => globalPdfInputRef.current?.click()}
            onLoadSamplePdf={handleLoadSamplePdf}
            onStartConvert={(mode) => {
              setConvertMode(mode);
              setSection('convert');
            }}
            onStartEdit={(mode) => {
              setEditMode(mode);
              setSection('edit');
            }}
            onOpenRecentFile={(f) => {
              setActivePdf({ name: f.name, bytes: f.bytes });
              setEditMode('pages');
              setSection('edit');
            }}
          />
        )}

        {section === 'convert' && (
          <ConverterStudio
            key={convertMode}
            initialMode={convertMode}
            activePdf={activePdf}
            currentLang={lang}
            onSaveToHistory={handleSaveToHistory}
            onNotify={notify}
            onOpenPdfInEditor={(name, bytes) => {
              setActivePdf({ name, bytes });
              setEditMode('pages');
              setSection('edit');
            }}
          />
        )}

        {section === 'edit' && (
          <PdfEditorStudio
            initialMode={editMode}
            activePdf={activePdf}
            currentLang={lang}
            onSelectNewPdf={() => globalPdfInputRef.current?.click()}
            onLoadSamplePdf={handleLoadSamplePdf}
            onSaveToHistory={handleSaveToHistory}
            onNotify={notify}
            onAnnotatorActiveChange={setAnnotatorActive}
          />
        )}

        {section === 'files' && (
          <RecentFilesView
            files={recentFiles}
            currentLang={lang}
            onOpenInEditor={(f) => {
              setActivePdf({ name: f.name, bytes: f.bytes });
              setEditMode('pages');
              setSection('edit');
            }}
            onOpenInOcr={(f) => {
              setActivePdf({ name: f.name, bytes: f.bytes });
              setConvertMode('ocr');
              setSection('convert');
            }}
            onDeleteFile={handleDeleteRecent}
            onPickNewFile={() => globalPdfInputRef.current?.click()}
          />
        )}
      </main>

      {!annotatorActive && (
        <BottomNav
          activeSection={section}
          currentLang={lang}
          onNavigate={setSection}
          fileCount={recentFiles.length}
        />
      )}

      {toasts.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 space-y-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`rounded-xl px-4 py-3 text-xs md:text-sm font-medium shadow-lg border pointer-events-auto ${
                t.type === 'error'
                  ? 'bg-red-950 text-white border-red-800'
                  : t.type === 'success'
                    ? 'bg-slate-900 text-white border-slate-800'
                    : 'bg-white text-slate-900 border-slate-200'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      <input
        ref={globalPdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleGlobalFilePicked}
      />
    </div>
  );
}
