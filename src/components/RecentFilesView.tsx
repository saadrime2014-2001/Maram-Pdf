import React from 'react';
import {
  Download,
  FileText,
  PenLine,
  Printer,
  ScanText,
  Share2,
  Trash2,
} from 'lucide-react';
import type { StoredPdfFile } from '../types/pdf';
import {
  downloadBlob,
  formatBytes,
  formatRelativeTime,
  printPdfBytes,
  shareFileIfSupported,
} from '../utils/pdfEngine';

interface RecentFilesViewProps {
  files: StoredPdfFile[];
  currentLang: 'ar' | 'en' | 'fr' | 'es';
  onOpenInEditor: (file: StoredPdfFile) => void;
  onOpenInOcr: (file: StoredPdfFile) => void;
  onDeleteFile: (id: string) => void;
  onPickNewFile: () => void;
}

const translations = {
  ar: {
    title: 'ملفاتي المحفوظة',
    subtitle: 'تُحفظ ملفاتك محلياً على جهازك لفتحها أو طباعتها أو مشاركتها في أي وقت',
    newFileBtn: 'فتح ملف جديد',
    emptyTitle: 'لا توجد ملفات محفوظة بعد',
    emptyDesc: 'أي ملف تقوم بتعديله أو دمجه أو تحويله سيظهر هنا تلقائياً لسهولة الوصول إليه عبر الهاتف.',
    edit: 'تعديل',
    pages: 'صفحات',
  },
  en: {
    title: 'My Saved Files',
    subtitle: 'Your files are saved locally on your device to open, print, or share anytime',
    newFileBtn: 'Open New File',
    emptyTitle: 'No saved files yet',
    emptyDesc: 'Any file you edit, merge, or convert will automatically appear here for easy access.',
    edit: 'Edit',
    pages: 'pages',
  },
  fr: {
    title: 'Mes Fichiers Enregistrés',
    subtitle: 'Vos fichiers sont sauvegardés localement sur votre appareil',
    newFileBtn: 'Ouvrir un nouveau fichier',
    emptyTitle: 'Aucun fichier enregistré',
    emptyDesc: 'Tout fichier modifié, fusionné ou converti apparaîtra automatiquement ici.',
    edit: 'Éditer',
    pages: 'pages',
  },
  es: {
    title: 'Mis Archivos Guardados',
    subtitle: 'Tus archivos se guardan localmente en tu dispositivo para abrirlos o compartirlos',
    newFileBtn: 'Abrir Nuevo Archivo',
    emptyTitle: 'No hay archivos guardados aún',
    emptyDesc: 'Cualquier archivo que edites, unas o conviertas aparecerá automáticamente aquí.',
    edit: 'Editar',
    pages: 'páginas',
  },
};

export const RecentFilesView: React.FC<RecentFilesViewProps> = ({
  files,
  currentLang,
  onOpenInEditor,
  onOpenInOcr,
  onDeleteFile,
  onPickNewFile,
}) => {
  const t = translations[currentLang];

  return (
    <div className={`max-w-4xl mx-auto px-4 md:px-6 py-5 pb-24 md:pb-12 space-y-5 ${currentLang === 'ar' ? 'text-right' : 'text-left'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.title}</h1>
          <p className="text-sm text-slate-500">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onPickNewFile}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs md:text-sm font-semibold hover:bg-red-700 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {t.newFileBtn}
        </button>
      </div>

      {files.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-base font-semibold text-slate-800">{t.emptyTitle}</p>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">{t.emptyDesc}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {files.map((file) => (
            <div
              key={file.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
            >
              <button
                type="button"
                onClick={() => onOpenInEditor(file)}
                className={`flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer ${currentLang === 'ar' ? 'text-right' : 'text-left'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 tabular-nums mt-0.5">
                    <span>{file.actionLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{file.pageCount} {t.pages}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">{formatBytes(file.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeTime(file.updatedAt)}</span>
                  </div>
                </div>
              </button>

              <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenInEditor(file)}
                  aria-label={t.edit}
                  className="min-h-[42px] px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-white flex items-center gap-1.5 cursor-pointer"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>{t.edit}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInOcr(file)}
                  aria-label="OCR"
                  title="OCR"
                  className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-white cursor-pointer"
                >
                  <ScanText className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => printPdfBytes(file.bytes, file.name)}
                  aria-label="Print"
                  title="Print"
                  className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-white cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    shareFileIfSupported(
                      new Blob([file.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                      file.name
                    ).then((ok) => {
                      if (!ok) {
                        downloadBlob(
                          new Blob([file.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                          file.name
                        );
                      }
                    })
                  }
                  aria-label="Share"
                  title="Share"
                  className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-white cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadBlob(
                      new Blob([file.bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
                      file.name
                    )
                  }
                  aria-label="Download"
                  title="Download"
                  className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFile(file.id)}
                  aria-label="Delete"
                  title="Delete"
                  className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
