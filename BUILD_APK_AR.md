# دليل تحويل أرشيف "ورقة PDF" إلى تطبيق APK عبر GitHub

تم تجهيز هذا الأرشيف بملف أتمتة حقيقي لـ **GitHub Actions** (`.github/workflows/build-apk.yml`) يقوم بتوليد مشروع أندرويد وبناء ملف **APK** تلقائياً بدون الحاجة لتثبيت Android Studio على جهازك.

---

## الطريقة 1: البناء التلقائي على GitHub (الأسهل والأسرع)

1. أنشئ مستودعاً جديداً على حسابك في **GitHub** (مثلاً باسم `waraqa-pdf`).
2. فك ضغط هذا الأرشيف وارفع جميع الملفات والمجلدات إلى المستودع (تأكد من وجود مجلد `.github/workflows/build-apk.yml` في الجذر).
   - عبر Git:
     ```bash
     git init
     git add .
     git commit -m "Initial Waraqa PDF app"
     git branch -M main
     git remote add origin https://github.com/USERNAME/waraqa-pdf.git
     git push -u origin main
     ```
3. افتح تبويب **Actions** في صفحة المستودع على GitHub.
4. ستجد عملية البناء **Build Waraqa PDF APK** تعمل تلقائياً (أو اضغط **Run workflow**).
5. بعد انتهاء البناء (حوالي دقيقتين)، انزل إلى قسم **Artifacts** في أسفل صفحة المهمة وحمّل **`waraqa-pdf-android-apk`** الذي يحتوي على ملف **`app-debug.apk`** الجاهز للتثبيت مباشرة على هاتفك الأندرويد!

### ملاحظة اختيارية لتفعيل التعرف الضوئي (OCR) داخل APK:
جميع أدوات تعديل PDF، التوقيع، الدمج، التقسيم، الضغط، وتحويل الصور وWord تعمل **100% محلياً داخل الهاتف بدون إنترنت**.
ولتفعيل خدمة الـ OCR السحابية داخل APK، أضف متغيراً في إعدادات مستودع GitHub (`Settings > Secrets and variables > Actions > Variables`) باسم:
- الاسم: `VITE_API_BASE_URL`
- القيمة: رابط التطبيق المنشور (مثلاً `https://your-app-url.run.app`)

---

## الطريقة 2: البناء محلياً عبر Capacitor و Android Studio

```bash
npm install
npm run build
npm install --no-save @capacitor/core@6 @capacitor/cli@6 @capacitor/android@6
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```
ستجد الملف الناتج في:
`android/app/build/outputs/apk/debug/app-debug.apk`
