# HM Creative Website — Implementation Prompt

Repo: https://github.com/HanzaMughal/hm-creative

یہ prompt پورے پراجیکٹ کی موجودہ ضروریات کو یکجا کرتا ہے۔ نیچے دی گئی ہر تبدیلی کو اسی ترتیب میں لاگو کریں، اور کوئی بھی موجودہ فیچر (media upload/edit/delete وغیرہ جو پہلے سے ٹھیک کام کر رہا ہے) کو نہ چھیڑیں۔

---

## 1) Admin Panel — نیا "Settings" سیکشن (Editable Profile Content)

Admin panel میں ایک نیا **Settings** section بنائیں جہاں سے یہ سب fields directly edit اور save ہو سکیں (Firebase Realtime Database میں):

- Profile Name (Hamza Mughal)
- Profile Picture (upload/replace)
- About Me text (پورا bio paragraph)
- Reviews/Testimonials (add / edit / delete هر review — name, text, rating اگر ہو)
- Contact Email
- Working Hours / Timing (مثلاً "Mon–Sat, 9 AM–10 PM PKT")
- کوئی بھی باقی static text جو ابھی hardcoded ہے (headline, tagline وغیرہ) اسے بھی اسی settings node کے تحت editable بنائیں

**تقاضے:**
- Form submit پر Realtime Database کے مخصوص node (مثلاً `/siteSettings`) پر write ہو
- Frontend اسی node سے real-time یا load-time پر data fetch کر کے دکھائے (hardcoded values ہٹا دیں)
- Save پر validation (خالی fields, invalid email format نہ جانے دیں)
- صرف authenticated admin ہی اس node کو write کر سکے (نیچے rules سیکشن دیکھیں)

---

## 2) نیا فیچر — Portfolio Browsing Tabs

Frontend اور Admin panel دونوں میں ایک نیا tab-based browsing section شامل کریں:

**Tabs:**
- **Video Ads** — موجودہ ویڈیو پورٹ فولیو (جیسا ابھی ہے)
- **Website Portfolio** — نیا section

**Website Portfolio کیسے کام کرے:**
- Admin panel میں ایک "Add Website" فارم ہو جہاں Hamza اپنی بنائی ہوئی سائٹ کا Vercel (یا کوئی بھی) لنک اور title/thumbnail شامل کرے
- یہ لنک Realtime Database میں محفوظ ہو (frontend پر کبھی raw URL کے طور پر ظاہر نہ ہو)
- Frontend پر user کو صرف thumbnail/title نظر آئے؛ click کرنے پر وہ site **اسی ایپ کے اندر ایک embedded browser view (iframe جیسا)** میں کھلے — نئے ٹیب یا address bar میں اصل URL کبھی ظاہر نہ ہو
- **Technical note جو address کرنی ہے:** بہت سی سائٹس (خصوصاً Vercel پر deploy شدہ) `X-Frame-Options` یا CSP کی وجہ سے iframe میں load نہیں ہوتیں۔ اس کے لیے:
  - پہلے چیک کریں کہ target sites iframe-embeddable ہیں یا نہیں
  - اگر نہیں تو ایک server-side proxy/rendering approach یا Vercel کی اپنی settings میں headers adjust کرنے کا آپشن دیکھیں
  - fallback کے طور پر ایک "in-app browser" جیسا simple wrapper بنایا جا سکتا ہے جو صرف اندرونی navigation دکھائے اور URL bar میں اصل link چھپا رکھے

---

## 3) Backend / Auth Cleanup

- Backend: **Firebase Realtime Database** (Firestore نہیں — پرانی بات جہاں Firestore rules کا ذکر تھا اسے Realtime Database rules میں تبدیل سمجھیں)
- Auth: **صرف Email/Password authentication رکھیں**
- **Google Sign-In فی الحال ہٹا دیں** (ٹھیک کام نہیں کر رہا) — بعد میں الگ سے debug کر کے دوبارہ شامل کیا جا سکتا ہے

---

## 4) Firebase Realtime Database — Security Rules

موجودہ rules کو review کر کے ان اصولوں پر دوبارہ لکھیں:

- Public/frontend صرف **read** کر سکے (site content, portfolio items)
- **Write صرف authenticated admin UID** کے لیے ہو (`auth != null && auth.uid == '<admin-uid>'` جیسا pattern)
- ہر node (`siteSettings`, `portfolio`, `videoAds`, `websitePortfolio`, `reviews` وغیرہ) کے لیے الگ سے validate کریں کہ:
  - غلط data type نہ لکھا جا سکے (`.validate` rules)
  - کوئی بھی anonymous user براہ راست database میں لکھ نہ سکے
- Contact form submissions کے لیے rate-limiting نوعیت کا rule سوچیں (مثلاً ایک node پر بار بار write کو محدود کرنا مشکل ہے پلین rules سے، اس لیے یہ frontend/Cloud Function level پر بھی handle کریں)

---

## 5) Security Fixes (پہلے بتائے گئے، یہاں شامل کریں)

- **Contact form:** honeypot field یا reCAPTCHA شامل کریں؛ client اور server دونوں طرف validation
- **API/Firebase keys:** اگر public keys frontend میں ہیں تو Firebase project settings میں domain restriction/allowlist لگائیں
- **`.gitignore` میں یہ شامل کریں (اگر پہلے سے نہیں ہیں):**
  ```
  .env
  .env.local
  .env*.local
  firebase-adminsdk-*.json
  serviceAccountKey.json
  node_modules/
  .vercel
  ```
- Repo میں چیک کریں کوئی credentials/API keys پہلے سے commit تو نہیں ہوئیں — اگر ہوئی ہیں تو rotate/remove کریں (git history سے بھی)
- Vercel پر HTTP security headers شامل کریں: CSP, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy
- Stats counters ("0 Projects Done" وغیرہ), empty portfolio section, اور missing social links کو fix کریں

---

## Priority Order (تجویز کردہ)

1. Firebase Auth cleanup (Google ہٹانا) + Realtime Database rules
2. Admin Settings section (profile/about/reviews/email/timing)
3. Security fixes (.gitignore, headers, form protection)
4. Website Portfolio tabs + embedded browsing feature (سب سے پیچیدہ، آخر میں)
