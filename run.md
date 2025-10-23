import pypandoc

# المحتوى الذي قدمه المستخدم
text = """📋 دليل التثبيت المحلي التفصيلي
سأشرح لك خطوات تثبيت المشروع على جهازك المحلي بالتفصيل:

📌 المتطلبات الأساسية (Prerequisites)
قبل البدء، تأكد من تثبيت هذه البرامج على جهازك:

1️⃣ Node.js (الإصدار 18 أو أحدث)
قم بتحميله من: https://nodejs.org/
بعد التثبيت، تحقق من الإصدار:
node --version
npm --version
2️⃣ PostgreSQL (قاعدة البيانات)
قم بتحميله من: https://www.postgresql.org/download/
أو استخدم Docker لتشغيل PostgreSQL:
docker run --name whatsapp-db -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=whatsapp -p 5432:5432 -d postgres
3️⃣ Git (لتحميل المشروع)
قم بتحميله من: https://git-scm.com/downloads
📥 الخطوة 1: تحميل المشروع
طريقة 1: من Replit (تحميل مباشر)
إذا كنت تستخدم حساب Explorer أو Staff على Replit:

افتح مشروعك في Replit
اذهب إلى Files explorer
انقر بزر الماوس الأيمن على المجلد الرئيسي
اختر "Download folder"
طريقة 2: استخدام Git Clone
إذا كان مشروعك متصل بـ GitHub:

git clone [رابط-المستودع-الخاص-بك]
cd [اسم-المشروع]
طريقة 3: استخدام SSH من Replit
# قم بإعداد SSH key في حساب Replit أولاً
# ثم استخدم rsync أو scp لتحميل الملفات
📦 الخطوة 2: تثبيت الحزم (Dependencies)
افتح Terminal في مجلد المشروع وقم بتشغيل:

# تثبيت جميع الحزم المطلوبة
npm install
هذا الأمر سيقوم بتثبيت أكثر من 80 حزمة بما في ذلك:

React و TypeScript (للواجهة)
Express.js (للخادم)
Drizzle ORM (للتعامل مع قاعدة البيانات)
Passport.js (للمصادقة)
WebSocket (للرسائل الفورية)
⏳ قد تستغرق هذه العملية 2-5 دقائق حسب سرعة الإنترنت.

🗄️ الخطوة 3: إعداد قاعدة البيانات
أ) إنشاء قاعدة بيانات PostgreSQL
إذا كنت تستخدم PostgreSQL محلي:
# افتح PostgreSQL CLI
psql -U postgres
# داخل psql، قم بإنشاء قاعدة بيانات جديدة
CREATE DATABASE whatsapp_chat;
# إنشاء مستخدم (اختياري)
CREATE USER whatsapp_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_chat TO whatsapp_user;
# اخرج من psql
\q
إذا كنت تستخدم Docker:
# قاعدة البيانات موجودة بالفعل من الخطوة السابقة
docker ps  # تحقق من أن الـ container يعمل
ب) إنشاء ملف المتغيرات البيئية (Environment Variables)
قم بإنشاء ملف جديد باسم .env في المجلد الرئيسي للمشروع:

# في Windows
notepad .env
# في Mac/Linux
nano .env
# أو
touch .env && open .env
أضف هذا المحتوى إلى ملف .env:

# Database Connection
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/whatsapp_chat
# أو إذا أنشأت مستخدم خاص:
# DATABASE_URL=postgresql://whatsapp_user:your_secure_password@localhost:5432/whatsapp_chat
# Session Secret (مفتاح سري عشوائي للجلسات)
SESSION_SECRET=your-very-long-random-secret-key-here-change-this
# Node Environment
NODE_ENV=development
💡 نصيحة: لتوليد SESSION_SECRET قوي، استخدم:

# في Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# أو في Linux/Mac
openssl rand -hex 32
ج) إنشاء جداول قاعدة البيانات
قم بتشغيل هذا الأمر لإنشاء جميع الجداول المطلوبة:

npm run db:push
هذا سيقوم بإنشاء الجداول التالية:

users (المستخدمين)
whatsapp_instances (حسابات واتساب البزنس)
conversations (المحادثات)
messages (الرسائل)
sessions (الجلسات)
✅ إذا رأيت رسالة نجاح، قاعدة البيانات جاهزة!

🚀 الخطوة 4: تشغيل التطبيق
تشغيل في وضع التطوير (Development Mode):
npm run dev
ستشاهد رسائل مثل:

[express] serving on port 5000
الآن افتح المتصفح وانتقل إلى:

http://localhost:5000
👤 الخطوة 5: إنشاء أول مستخدم Admin
التطبيق لا يسمح بالتسجيل العام، لذلك تحتاج لإنشاء مستخدم Admin يدوياً:

الطريقة 1: استخدام psql (الأسهل)
# افتح psql
psql -U postgres -d whatsapp_chat
# قم بتشغيل هذا الأمر (سيتم تشفير كلمة المرور تلقائياً)
# كلمة المرور هنا: password123
INSERT INTO users (id, username, password, role) 
VALUES (
  gen_random_uuid(),
  'admin',
  '$scrypt$N=16384,r=8,p=1$your_hashed_password_here',
  'admin'
);
الطريقة 2: إنشاء سكريبت Node.js مؤقت
قم بإنشاء ملف create-admin.js:

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
  const client = new Client({
    connectionString: 'postgresql://postgres:yourpassword@localhost:5432/whatsapp_chat'
  });
  
  await client.connect();
  
  const hashedPassword = await hashPassword('password123');
  
  await client.query(
    'INSERT INTO users (id, username, password, role) VALUES (gen_random_uuid(), $1, $2, $3)',
    ['admin', hashedPassword, 'admin']
  );
  
  console.log('✅ Admin user created successfully!');
  console.log('Username: admin');
  console.log('Password: password123');
  
  await client.end();
}
createAdmin().catch(console.error);
ثم قم بتشغيله:

node create-admin.js
🔐 الخطوة 6: تسجيل الدخول
افتح http://localhost:5000/auth
استخدم بيانات الدخول:
اسم المستخدم: admin
كلمة المرور: password123
✅ ستدخل إلى لوحة التحكم!
⚙️ الخطوة 7: إعداد حسابات واتساب (Meta Cloud API)
بعد تسجيل الدخول:

اذهب إلى Settings (الإعدادات)

انقر على Create Instance (إنشاء حساب جديد)

أدخل المعلومات من Meta Developer Console:

Instance Name: اسم تعريفي (مثل: "حساب المبيعات")
Phone Number ID: من Meta Dashboard
Access Token: من Meta Dashboard
Webhook Verify Token: أي نص سري تختاره
App Secret: (اختياري) من Meta App Settings
انقر Save

📋 الأوامر المهمة
الأمر	الوصف
npm run dev	تشغيل التطبيق في وضع التطوير
npm run build	بناء التطبيق للإنتاج
npm run start	تشغيل النسخة المبنية
npm run check	فحص أخطاء TypeScript
npm run db:push	تحديث قاعدة البيانات
🐛 حل المشاكل الشائعة
❌ "Cannot find module"
# أعد تثبيت الحزم
rm -rf node_modules package-lock.json
npm install
❌ "Database connection failed"
تأكد من أن PostgreSQL يعمل
تحقق من DATABASE_URL في ملف .env
تأكد من صحة اسم المستخدم وكلمة المرور
❌ "Port 5000 already in use"
# في Windows
netstat -ano | findstr :5000
taskkill /PID [رقم_العملية] /F
# في Mac/Linux
lsof -ti:5000 | xargs kill -9
❌ "Session secret not configured"
تأكد من وجود SESSION_SECRET في ملف .env
📂 هيكل المشروع
whatsapp-chat/
├── client/              # كود الواجهة (React)
│   └── src/
│       ├── components/  # المكونات
│       ├── pages/       # الصفحات
│       └── lib/         # أدوات مساعدة
├── server/              # كود الخادم (Express)
│   ├── auth.ts          # نظام المصادقة
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # قاعدة البيانات
│   └── providers/       # Meta API integration
├── shared/              # كود مشترك
│   └── schema.ts        # نماذج البيانات
├── .env                 # المتغيرات البيئية (لا تشاركه!)
├── package.json         # الحزم المثبتة
└── vite.config.ts       # إعدادات Vite
🎉 انتهيت!
الآن لديك التطبيق يعمل محلياً على جهازك! يمكنك:

✅ إرسال واستقبال رسائل واتساب
✅ إدارة عدة حسابات واتساب بزنس
✅ مشاهدة الإحصائيات
✅ أرشفة المحادثات
✅ إضافة مستخدمين جدد
💡 نصيحة أخيرة: لا تنسَ تغيير كلمات المرور الافتراضية قبل النشر على الإنترنت!
"""

# تحويل النص إلى ملف run.md
output_path = "/mnt/data/run.md"
pypandoc.convert_text(text, 'md', format='md', outputfile=output_path, extra_args=['--standalone'])

output_path
