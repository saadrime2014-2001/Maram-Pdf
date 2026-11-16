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

export default function App() {
  const [section, setSection] = useState<AppSection>('home');
  const [convertMode, setConvertMode] = useState<ConvertMode>('img-to-pdf');
  const [editMode, setEditMode] = useState<EditMode>('pages');
  const [activePdf, setActivePdf] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);
  const [recentFiles, setRecentFiles] = useState<StoredPdfFile[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [annotatorActive, setAnnotatorActive] = useState(false);

  const globalPdfInputRef = useRef<HTMLInputElement | null>(null);

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
        await handleSaveToHistory(name, bytes, count, 'ملف مفتوح');
        setSection(targetSection);
      } catch {
        notify('error', 'تعذر فتح ملف PDF. تأكد من سلامة الملف.');
      }
    },
    [handleSaveToHistory, notify]
  );

  // استقبال ملفات PDF القادمة من خيار "فتح بواسطة / Abrir con" في الأندرويد
  useEffect(() => {
    const checkIncomingPdf = async () => {
      const params = new URLSearchParams(window.location.search);
      const sharedUri = params.get('openPdfUri');
      if (!sharedUri) return;

      // تنظيف الرابط لمنع تكرار الفتح عند تحديث الصفحة
      window.
