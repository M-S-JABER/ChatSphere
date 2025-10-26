# 🚀 دليل البدء السريع - أداة تشخيص Webhook

## ✅ تم إصلاح المشكلة!

تم حل مشكلة عدم استلام الرسائل وإضافة نظام تشخيص شامل.

## 🎯 كيفية الوصول لأداة التشخيص

### 1. **تشغيل التطبيق**
```bash
npm run dev
```

### 2. **فتح التطبيق**
- اذهب إلى: `http://127.0.0.1:8080`
- سجل دخولك كـ admin

### 3. **الوصول لأداة التشخيص**
- اضغط على أيقونة المستخدم في الأعلى
- اختر **"Webhook Diagnostics"**

## 🔍 خطوات التشخيص

### **الخطوة 1: فحص حالة النظام**
1. اختر الـ instance من القائمة المنسدلة
2. تحقق من تبويب **"Status"**
3. تأكد من أن جميع المؤشرات **خضراء**

### **الخطوة 2: اختبار الإرسال**
1. اذهب إلى تبويب **"Test Message"**
2. أدخل رقم هاتف (مثال: `+1234567890`)
3. أدخل رسالة تجريبية
4. اضغط **"Send Test Message"**

### **الخطوة 3: فحص الأحداث**
1. اذهب إلى تبويب **"Recent Events"**
2. تحقق من الأحداث الأخيرة
3. ابحث عن أخطاء في الـ response

### **الخطوة 4: تشخيص Webhook**
1. اذهب إلى تبويب **"Debug Webhook"**
2. أدخل payload تجريبي:

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
                  "body": "Hello World"
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

3. اضغط **"Debug Payload"**

## 🎉 ما تم إضافته

### **1. تسجيل مفصل**
- رسائل واضحة في console الخادم
- تتبع كل خطوة في معالجة الرسائل
- قياس وقت المعالجة

### **2. أدوات التشخيص**
- صفحة تشخيص شاملة
- فحص حالة النظام
- اختبار إرسال الرسائل
- تشخيص webhook payloads
- عرض الأحداث الأخيرة

### **3. Endpoints جديدة**
- `/api/webhook/status/{instanceId}` - فحص حالة الـ webhook
- `/api/test-message` - اختبار إرسال رسالة
- `/webhook/debug/{instanceId}` - تشخيص webhook payload

## 🔧 حل المشاكل الشائعة

### **مشكلة: "Instance not found"**
- تحقق من أن الـ instance موجود في Settings
- تأكد من أن الـ instance نشط

### **مشكلة: "Invalid signature"**
- تحقق من الـ app secret في Settings
- أو أزل الـ app secret إذا لم تكن تحتاجه

### **مشكلة: "No events parsed"**
- تحقق من هيكل الـ payload
- استخدم أداة Debug Webhook

### **مشكلة: الرسائل لا تظهر**
- تحقق من اتصال WebSocket
- تأكد من أن الرسائل محفوظة في قاعدة البيانات

## 📊 مراقبة النظام

### **في Console الخادم سترى:**
```
🚀 Webhook POST received for instance: abc123
✅ Instance found: My WhatsApp (Active: true)
🔐 Verifying webhook signature...
✅ Webhook signature verified
🔄 Parsing incoming events...
📨 Parsed 1 events
💬 Processing event from: +1234567890
💾 Saving message to database...
✅ Message saved with ID: msg_456
📡 Broadcasting message to WebSocket clients...
✅ Message broadcasted
🎉 Webhook processing completed in 45ms
```

### **في صفحة التشخيص سترى:**
- حالة النظام مع مؤشرات ملونة
- إمكانية اختبار الإرسال
- تشخيص webhook payloads
- عرض الأحداث الأخيرة

## 🎯 النتيجة

الآن يمكنك:
1. **تشخيص المشاكل** بسرعة
2. **اختبار النظام** بسهولة
3. **مراقبة الأداء** بشكل مستمر
4. **حل المشاكل** بفعالية

---

## 🆘 إذا استمرت المشكلة

1. **تحقق من Logs** في console الخادم
2. **استخدم أداة التشخيص** في التطبيق
3. **تحقق من إعدادات Meta** في Settings
4. **راجع دليل التشخيص** في `WEBHOOK_DEBUGGING_GUIDE.md`

**الآن جرب أداة التشخيص وأخبرني بالنتائج!** 🚀
