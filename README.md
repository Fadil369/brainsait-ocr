# BrainSAIT OCR / برين سايت للتعرف الضوئي على النصوص

[![CI/CD Pipeline](https://github.com/Fadil369/brainsait-ocr/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Fadil369/brainsait-ocr/actions/workflows/ci-cd.yml)

Advanced OCR application built with Cloudflare Workers and Mistral AI, supporting Arabic and English text extraction from documents and images.

تطبيق متقدم للتعرف الضوئي على النصوص مبني باستخدام Cloudflare Workers و Mistral AI، يدعم استخراج النصوص العربية والإنجليزية من المستندات والصور.

## 🚀 Live Demo / العرض التوضيحي المباشر

- **Application / التطبيق**: https://18a6df4d.brainsait-ocr.pages.dev
- **API / واجهة البرمجة**: https://brainsait-ocr-worker.fadil.workers.dev

## ✨ Features / المميزات

### English
- **Multi-language OCR**: Arabic and English text extraction
- **Multiple formats**: PDF, PNG, JPG, JPEG, WEBP support
- **AI-powered**: Mistral Pixtral-12B-2409 model integration
- **Caching system**: Intelligent result caching for performance
- **User management**: Authentication and subscription tiers
- **Batch processing**: Process multiple files simultaneously
- **Export options**: JSON and Markdown export formats

### العربية
- **تعرف ضوئي متعدد اللغات**: استخراج النصوص العربية والإنجليزية
- **صيغ متعددة**: دعم PDF, PNG, JPG, JPEG, WEBP
- **مدعوم بالذكاء الاصطناعي**: تكامل مع نموذج Mistral Pixtral-12B-2409
- **نظام تخزين مؤقت**: تخزين مؤقت ذكي للنتائج لتحسين الأداء
- **إدارة المستخدمين**: المصادقة وطبقات الاشتراك
- **معالجة مجمعة**: معالجة ملفات متعددة في آن واحد
- **خيارات التصدير**: تصدير بصيغ JSON و Markdown

## 🏗️ Architecture / البنية التقنية

### English
- **Frontend**: Vanilla JavaScript with Tailwind CSS
- **Backend**: Cloudflare Workers (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV for caching
- **AI**: Mistral AI API integration
- **Deployment**: Cloudflare Pages + Workers

### العربية
- **الواجهة الأمامية**: JavaScript خالص مع Tailwind CSS
- **الخادم الخلفي**: Cloudflare Workers (إطار عمل Hono)
- **قاعدة البيانات**: Cloudflare D1 (SQLite)
- **التخزين**: Cloudflare KV للتخزين المؤقت
- **الذكاء الاصطناعي**: تكامل مع Mistral AI API
- **النشر**: Cloudflare Pages + Workers

## 🛠️ Development / التطوير

### English
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to Cloudflare
npm run deploy

# Run tests
npm test

# Lint code
npm run lint
```

### العربية
```bash
# تثبيت التبعيات
npm install

# تشغيل خادم التطوير
npm run dev

# النشر على Cloudflare
npm run deploy

# تشغيل الاختبارات
npm test

# فحص الكود
npm run lint
```

## 📋 Environment Variables / متغيرات البيئة

```bash
JWT_SECRET=your_jwt_secret
MISTRAL_API_KEY=your_mistral_api_key
```

## 🗄️ Database / قاعدة البيانات

### English
The application uses Cloudflare D1 database with the following tables:
- Users management and authentication
- OCR processing history
- Subscription and credits tracking

### العربية
يستخدم التطبيق قاعدة بيانات Cloudflare D1 مع الجداول التالية:
- إدارة المستخدمين والمصادقة
- تاريخ معالجة التعرف الضوئي
- تتبع الاشتراكات والأرصدة

## 🚀 Getting Started / البدء السريع

### English
1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables
4. Configure Cloudflare D1 database
5. Deploy to Cloudflare Workers and Pages

### العربية
1. استنساخ المستودع
2. تثبيت التبعيات باستخدام `npm install`
3. إعداد متغيرات البيئة
4. تكوين قاعدة بيانات Cloudflare D1
5. النشر على Cloudflare Workers و Pages

## 📄 License / الترخيص

This project is licensed under the MIT License / هذا المشروع مرخص تحت رخصة MIT

---

Built with ❤️ using BrainSAIT technology / مبني بـ ❤️ باستخدام تقنية برين سايت

**BrainSAIT** - Empowering intelligence through technology / تمكين الذكاء من خلال التكنولوجيا