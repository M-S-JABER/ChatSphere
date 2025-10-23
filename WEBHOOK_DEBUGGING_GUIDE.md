# 🔍 دليل تشخيص مشاكل استلام الرسائل - ChatSphere

## 📋 المشاكل الشائعة والحلول

### 1. 🚨 المشاكل الأساسية

#### أ) **لا يتم استلام الرسائل نهائياً**

**الأسباب المحتملة:**
- الـ webhook غير مُعد بشكل صحيح في Meta
- الـ instance غير نشط
- مشكلة في إعدادات الـ webhook behavior
- مشكلة في التحقق من التوقيع

**خطوات التشخيص:**
1. اذهب إلى `/diagnostics` في التطبيق
2. اختر الـ instance المطلوب
3. تحقق من حالة الـ "Instance Status"
4. تأكد من أن جميع المؤشرات خضراء

#### ب) **الرسائل تصل لكن لا تظهر في التطبيق**

**الأسباب المحتملة:**
- مشكلة في تحليل الـ payload
- مشكلة في قاعدة البيانات
- مشكلة في WebSocket

**خطوات التشخيص:**
1. تحقق من "Recent Events" في صفحة التشخيص
2. ابحث عن أخطاء في الـ response
3. تحقق من console logs في الخادم

### 2. 🔧 أدوات التشخيص المتاحة

#### أ) **صفحة التشخيص الرئيسية** (`/diagnostics`)
- فحص حالة الـ instance
- اختبار إرسال رسائل
- تشخيص webhook payloads
- عرض الأحداث الأخيرة

#### ب) **Endpoints للتشخيص**

**فحص حالة الـ webhook:**
```bash
GET /api/webhook/status/{instanceId}
```

**اختبار إرسال رسالة:**
```bash
POST /api/test-message
{
  "to": "+1234567890",
  "body": "Test message",
  "instanceId": "optional"
}
```

**تشخيص webhook payload:**
```bash
POST /webhook/debug/{instanceId}
{
  "entry": [...]
}
```

### 3. 📊 تحليل Logs

#### أ) **Server Logs**
ابحث عن هذه الرسائل في console:

```
🚀 Webhook POST received for instance: {instanceId}
✅ Instance found: {name} (Active: {isActive})
🔐 Verifying webhook signature...
✅ Webhook signature verified
🔄 Parsing incoming events...
📨 Parsed {count} events
💬 Processing event from: {phone}
💾 Saving message to database...
✅ Message saved with ID: {messageId}
📡 Broadcasting message to WebSocket clients...
✅ Message broadcasted
🎉 Webhook processing completed in {duration}ms
```

#### ب) **MetaProvider Logs**
```
🔍 MetaProvider.parseIncoming - Raw payload: {...}
📥 MetaProvider.parseIncoming - Processing {count} entries
📋 MetaProvider.parseIncoming - Processing entry: {...}
🔄 MetaProvider.parseIncoming - Processing change: {...}
💬 MetaProvider.parseIncoming - Processing {count} messages
📨 MetaProvider.parseIncoming - Processing message: {...}
📝 MetaProvider.parseIncoming - Text message from {phone}: {body}
✅ MetaProvider.parseIncoming - Parsed {count} events
```

### 4. 🛠️ خطوات الإصلاح

#### أ) **إصلاح مشكلة الـ webhook verification**

1. **تحقق من إعدادات Meta:**
   - تأكد من أن الـ webhook URL صحيح
   - تحقق من الـ verify token
   - تأكد من الـ app secret (اختياري)

2. **اختبار الـ webhook:**
   ```bash
   curl -X GET "https://your-domain.com/webhook/meta/{instanceId}?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your_token"
   ```

#### ب) **إصلاح مشكلة تحليل الرسائل**

1. **تحقق من هيكل الـ payload:**
   ```json
   {
     "entry": [
       {
         "changes": [
           {
             "value": {
               "messages": [
                 {
                   "from": "1234567890",
                   "type": "text",
                   "text": {
                     "body": "Hello"
                   }
                 }
               ]
             }
           }
         ]
       }
     ]
   }
   ```

2. **استخدم أداة التشخيص:**
   - اذهب إلى `/diagnostics`
   - اختر "Debug Webhook"
   - أدخل الـ payload
   - اضغط "Debug Payload"

#### ج) **إصلاح مشكلة قاعدة البيانات**

1. **تحقق من الاتصال:**
   ```bash
   # تحقق من متغير البيئة
   echo $DATABASE_URL
   ```

2. **تحقق من الجداول:**
   ```sql
   SELECT * FROM whatsapp_instances WHERE id = 'your-instance-id';
   SELECT * FROM conversations WHERE phone = 'phone-number';
   SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;
   ```

### 5. 🔍 تشخيص متقدم

#### أ) **فحص WebSocket**
```javascript
// في console المتصفح
const ws = new WebSocket('ws://10.255.255.254:5000/ws');
ws.onmessage = (event) => {
  console.log('WebSocket message:', JSON.parse(event.data));
};
```

#### ب) **فحص Network Requests**
1. افتح Developer Tools
2. اذهب إلى Network tab
3. أرسل رسالة
4. تحقق من requests إلى `/api/message/send`

#### ج) **فحص Database Queries**
```sql
-- فحص الرسائل الأخيرة
SELECT m.*, c.phone, c.display_name 
FROM messages m 
JOIN conversations c ON m.conversation_id = c.id 
ORDER BY m.created_at DESC 
LIMIT 20;

-- فحص webhook events
SELECT * FROM webhook_events 
WHERE instance_id = 'your-instance-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 6. 🚨 رسائل الخطأ الشائعة

#### أ) **"Instance not found"**
- تحقق من أن الـ instance ID صحيح
- تأكد من أن الـ instance موجود في قاعدة البيانات

#### ب) **"Invalid signature"**
- تحقق من الـ app secret
- تأكد من أن الـ signature header موجود
- تحقق من أن الـ raw body يتم حفظه بشكل صحيح

#### ج) **"No events parsed from payload"**
- تحقق من هيكل الـ payload
- تأكد من وجود `entry` و `changes` و `messages`
- استخدم أداة التشخيص لفحص الـ payload

#### د) **"WebSocket connection failed"**
- تحقق من أن الخادم يعمل
- تأكد من أن الـ WebSocket server نشط
- تحقق من firewall settings

### 7. 📝 سجل التشخيص

#### أ) **قائمة فحص سريعة:**
- [ ] الـ instance نشط
- [ ] الـ webhook URL صحيح
- [ ] الـ verify token صحيح
- [ ] الـ app secret صحيح (إذا مُستخدم)
- [ ] قاعدة البيانات متصلة
- [ ] WebSocket يعمل
- [ ] لا توجد أخطاء في console

#### ب) **معلومات مفيدة للتشخيص:**
```bash
# معلومات النظام
node --version
npm --version

# متغيرات البيئة
echo $DATABASE_URL
echo $SESSION_SECRET
echo $META_TOKEN
echo $META_PHONE_NUMBER_ID
echo $META_VERIFY_TOKEN
echo $META_APP_SECRET

# حالة الخادم
curl http://127.0.0.1:8080/health
```

### 8. 🆘 طلب المساعدة

عند طلب المساعدة، قدم هذه المعلومات:

1. **معلومات النظام:**
   - نسخة Node.js
   - نظام التشغيل
   - متغيرات البيئة (بدون قيم حساسة)

2. **معلومات المشكلة:**
   - وصف المشكلة
   - خطوات إعادة الإنتاج
   - رسائل الخطأ

3. **معلومات التشخيص:**
   - نتائج صفحة `/diagnostics`
   - logs من الخادم
   - نتائج اختبار الـ webhook

4. **معلومات الـ instance:**
   - الـ instance ID
   - حالة الـ instance
   - إعدادات الـ webhook

---

## 🎯 خلاصة

تم إضافة نظام تشخيص شامل يتضمن:

1. **تسجيل مفصل** في جميع مراحل معالجة الرسائل
2. **أدوات تشخيص** في الواجهة الأمامية
3. **Endpoints للتشخيص** في الخادم
4. **فحص شامل** لحالة النظام
5. **أدوات اختبار** للرسائل والـ webhooks

استخدم هذه الأدوات لتشخيص وحل مشاكل استلام الرسائل بسرعة وفعالية.
