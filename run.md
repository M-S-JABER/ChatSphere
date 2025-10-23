📋 **دليل التثبيت المحلي التفصيلي**

سأشرح لك خطوات تثبيت المشروع على جهازك المحلي بالتفصيل.

------------------------------------------------------------------------

## 📌 المتطلبات الأساسية (Prerequisites)

قبل البدء، تأكد من تثبيت البرامج التالية:

1.  **Node.js (الإصدار 18 أو أحدث)**
    -   التحميل من: <https://nodejs.org/>

    -   للتحقق من التثبيت:

        ``` bash
        node --version
        npm --version
        ```
2.  **PostgreSQL (قاعدة البيانات)**
    -   التحميل من: <https://www.postgresql.org/download/>

    -   أو تشغيله عبر Docker:

        ``` bash
        docker run --name whatsapp-db -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=whatsapp -p 5432:5432 -d postgres
        ```
3.  **Git (لتحميل المشروع)**
    -   التحميل من: <https://git-scm.com/downloads>

------------------------------------------------------------------------

## 📥 الخطوة 1: تحميل المشروع

### 🟢 الطريقة 1: من Replit (تحميل مباشر)

1.  افتح مشروعك في Replit\
2.  اذهب إلى **Files explorer**\
3.  انقر بزر الماوس الأيمن على المجلد الرئيسي\
4.  اختر **Download folder**

### 🟣 الطريقة 2: باستخدام Git

``` bash
git clone [رابط-المستودع]
cd [اسم-المشروع]
```

### 🔵 الطريقة 3: عبر SSH من Replit

قم بإعداد مفتاح SSH، ثم استخدم `rsync` أو `scp` لنقل الملفات.

------------------------------------------------------------------------

## 📦 الخطوة 2: تثبيت الحزم

``` bash
npm install
```

سيتم تثبيت أكثر من 80 حزمة تشمل: - React و TypeScript - Express.js -
Drizzle ORM - Passport.js - WebSocket

⏳ قد تستغرق العملية بضع دقائق حسب سرعة الإنترنت.

------------------------------------------------------------------------

## 🗄️ الخطوة 3: إعداد قاعدة البيانات

### أ) إنشاء قاعدة البيانات

**محلياً:**

``` bash
psql -U postgres
CREATE DATABASE whatsapp_chat;
CREATE USER whatsapp_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_chat TO whatsapp_user;
\q
```

**عبر Docker:**

``` bash
docker ps
```

### ب) إعداد ملف `.env`

``` bash
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/whatsapp_chat
SESSION_SECRET=your-very-long-random-secret-key
NODE_ENV=development
```

لتوليد مفتاح سري:

``` bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ج) إنشاء الجداول

``` bash
npm run db:push
```

سيتم إنشاء الجداول: `users`, `whatsapp_instances`, `conversations`,
`messages`, `sessions`

------------------------------------------------------------------------

## 🚀 الخطوة 4: تشغيل التطبيق

``` bash
npm run dev
```

ثم افتح: <http://localhost:5000>

------------------------------------------------------------------------

## 👤 الخطوة 5: إنشاء مستخدم Admin

### الطريقة 1: من داخل PostgreSQL

``` sql
INSERT INTO users (id, username, password, role)
VALUES (gen_random_uuid(), 'admin', '$scrypt$N=16384,r=8,p=1$your_hashed_password_here', 'admin');
```

### الطريقة 2: عبر سكريبت Node.js

``` js
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import pkg from 'pg';
const { Client } = pkg;
const scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}
async function createAdmin() {
  const client = new Client({ connectionString: 'postgresql://postgres:yourpassword@localhost:5432/whatsapp_chat' });
  await client.connect();
  const hashedPassword = await hashPassword('password123');
  await client.query('INSERT INTO users (id, username, password, role) VALUES (gen_random_uuid(), $1, $2, $3)', ['admin', hashedPassword, 'admin']);
  console.log('✅ Admin user created successfully!');
  await client.end();
}
createAdmin().catch(console.error);
```

------------------------------------------------------------------------

## 🔐 الخطوة 6: تسجيل الدخول

افتح <http://localhost:5000/auth>\
اسم المستخدم: `admin`\
كلمة المرور: `password123`

------------------------------------------------------------------------

## ⚙️ الخطوة 7: إعداد حسابات واتساب (Meta Cloud API)

1.  انتقل إلى الإعدادات (Settings)\
2.  اختر **Create Instance**\
3.  أدخل بياناتك من Meta Developer Console
    -   **Instance Name**
    -   **Phone Number ID**
    -   **Access Token**
    -   **Webhook Verify Token**
    -   **App Secret** (اختياري)

------------------------------------------------------------------------

## 🧩 الأوامر المهمة

  الأمر               الوصف
  ------------------- ----------------------
  `npm run dev`       تشغيل في وضع التطوير
  `npm run build`     بناء للإنتاج
  `npm run start`     تشغيل النسخة المبنية
  `npm run db:push`   تحديث قاعدة البيانات
  `npm run check`     فحص TypeScript

------------------------------------------------------------------------

## 🐛 حل المشاكل الشائعة

-   **Cannot find module** → أعد تثبيت الحزم:

    ``` bash
    rm -rf node_modules package-lock.json
    npm install
    ```

-   **Database connection failed** → تحقق من `DATABASE_URL`

-   **Port 5000 already in use** → أغلق العملية:

    ``` bash
    lsof -ti:5000 | xargs kill -9
    ```

-   **Session secret not configured** → تأكد من وجود `SESSION_SECRET`

------------------------------------------------------------------------

## 📂 هيكل المشروع

    whatsapp-chat/
    ├── client/
    │   └── src/
    │       ├── components/
    │       ├── pages/
    │       └── lib/
    ├── server/
    │   ├── auth.ts
    │   ├── routes.ts
    │   ├── storage.ts
    │   └── providers/
    ├── shared/
    │   └── schema.ts
    ├── .env
    ├── package.json
    └── vite.config.ts

------------------------------------------------------------------------

## 🎉 انتهيت!

الآن يمكنك: - ✅ إرسال واستقبال رسائل واتساب - ✅ إدارة عدة حسابات
واتساب بزنس - ✅ مشاهدة الإحصائيات - ✅ أرشفة المحادثات - ✅ إضافة
مستخدمين جدد

> 💡 **نصيحة:** غيّر كلمات المرور الافتراضية قبل النشر على الإنترنت!
