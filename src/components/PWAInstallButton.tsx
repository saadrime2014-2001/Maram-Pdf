import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-semibold hover:bg-slate-800 flex items-center gap-2 cursor-pointer whitespace-nowrap"
      >
        <Smartphone className="w-4 h-4" />
        <span>تثبيت التطبيق على الهاتف</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs md:text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-red-600" />
          <span>تثبيت على آيفون</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">التثبيت على iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                <li>اضغط على زر <strong>المشاركة</strong> في شريط متصفح Safari.</li>
                <li>مرّر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية</strong>.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer"
              >
                حسناً
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
