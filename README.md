# معمل الأسنان — نظام متابعة الحالات

مشروع React (Vite) متصل بـ **Supabase** فعليًا — تسجيل دخول حقيقي بباسورد، وملفات بترفع
وتتنزّل من سيرفر حقيقي، والبيانات متزامنة بين أي حد بيستخدم الموقع.

## التشغيل

1. افتح الفولدر ده في VS Code.
2. من الـ Terminal:

   ```bash
   npm install
   npm run dev
   ```

3. هيديك رابط زي `http://localhost:5173` — افتحه في المتصفح.

## الإعداد على Supabase (اتعمل بالفعل)

المشروع متوصل بمشروع Supabase بتاعك، والمفاتيح موجودة جاهزة في ملف `.env`.
لو حبيت تنقل المشروع لجهاز/حساب Supabase تاني، انسخ `.env.example` باسم `.env`
واملأ فيه:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

هتلاقيهم في Supabase تحت: **Settings → Data API** (للـ URL) و **Settings → API Keys**
(للـ anon key، من تاب Legacy API Keys).

### الجداول والصلاحيات

الكود بيفترض إن الجداول والصلاحيات دي موجودة في قاعدة البيانات:
- `profiles` (id, name, role)
- `cases` (id, doctor_name, case_name, uploaded_by, created_at, done, prova_filled, final_filled)
- `case_stage_files` (case_id, stage, doctor_name, case_name, crown_count, shade, note, file_path, file_name, uploaded_at)
- Storage bucket اسمه `case-files` (Public)
- تسجيل الدخول بالإيميل (Email provider) مفعّل في Authentication

لو عملت مشروع Supabase جديد من الصفر، هتحتاج تعمل الجداول والصلاحيات دي تاني
(الكود بتاعها اتبعتلك في المحادثة).

## بناء نسخة نهائية (للنشر)

```bash
npm run build
```

هيطلعلك فولدر `dist` جاهز ترفعه على أي استضافة (Vercel, Netlify, إلخ). لما ترفعه،
لازم تضيف نفس متغيرات `.env` في إعدادات الاستضافة نفسها (مش هتترفع مع الكود
لأنها في `.gitignore`).

## هيكل المشروع

```
src/
  App.jsx            ← الكود الكامل للتطبيق (الشاشات، اللوجيك)
  supabaseClient.js  ← الاتصال بـ Supabase
  main.jsx           ← نقطة الدخول لـ React
  index.css          ← Tailwind + الخطوط
.env                 ← مفاتيح Supabase (سري، متترفعش على git)
index.html
```

## ملاحظات مهمة

- **تسجيل الدخول بقى باسم واحد بس (بالإنجليزي) وباسورد** — مفيش إيميل ومفيش خانة
  اسم منفصلة. اللي بيكتبوه هو نفسه اللي هيظهر ليهم وللكل في الموقع.
  الشكل المسموح: حروف إنجليزي ومسافات بس (زي `Sara Ahmed`)، 3 حروف على الأقل.
  داخليًا الكود بيحوّله لإيميل وهمي (زي `sara.ahmed@dentallab.local`) عشان نظام
  الحماية بتاع Supabase شغال بالإيميل من ورا الكواليس، بس ده مش ظاهر للمستخدم خالص.
- **مهم جدًا:** لازم تتأكد إن **"Confirm email" مقفول (Disabled)** في Supabase تحت
  Authentication → Sign In / Providers → Email. لو شغال، التسجيل مش هيكمل لأن
  الإيميلات الوهمية مش هتقدر تستقبل رسالة تأكيد فعلية.
- **الملفات**: بترفع فعليًا على Supabase Storage، وأي حد عنده حساب يقدر ينزّلها.
- **تحديث لحظي بين المستخدمين**: حاليًا كل مستخدم بيشوف آخر تحديث لما يفتح
  الصفحة أو يرجع للرئيسية — مش لحظي أوتوماتيك أثناء ما هو واقف في نفس الشاشة.
  لو عايز تحديث فوري (Realtime) قوللي وأضيفهولك.
