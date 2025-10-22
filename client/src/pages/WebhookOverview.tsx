import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";

type Module = {
  title: string;
  description: string;
  bullets: string[];
};

const CORE_MODULES: Module[] = [
  {
    title: "webhook-server.js",
    description:
      "خادم ويبهوك خفيف يورّث من AbstractServer ويستضيف المسارات المخصصة لطلبات الويبهوك داخل n8n.",
    bullets: [
      "تهيئة الراوتر والميدلوير تتم في طبقات أعلى داخل n8n.",
      "يمثل نقطة الدخول الأساسية لكل طلب ويبهوك قبل تمريره إلى الخدمات المتخصصة.",
    ],
  },
  {
    title: "webhook.service.js",
    description: "طبقة البحث والتطابق عن الويبهوكات المسجلة في قاعدة البيانات.",
    bullets: [
      "findStaticWebhook(method, path) لمسارات ثابتة.",
      "findDynamicWebhook(path, method) لمسارات يبدأ أول مقطع فيها بـ UUID مع مقارنة دقيقة للأطوال.",
      "getWebhookMethods(path) لإرجاع قائمة الـ HTTP Methods المدعومة لمسار محدد.",
    ],
  },
  {
    title: "live-webhooks.js",
    description: "المسؤول عن تنفيذ الويبهوكات في وضع الإنتاج (Live).",
    bullets: [
      "يجلب الـ Workflow من المستودع ويحدد العقدة المرتبطة بالويبهوك.",
      "يتكامل مع node-types و workflow-execute-additional-data لإعداد سياق التنفيذ.",
      "يدعم عقد المحادثة CHAT_TRIGGER_NODE_TYPE ويستخلص خيارات التحكم في الوصول." ,
    ],
  },
  {
    title: "waiting-webhooks.js",
    description: "يدير الويبهوكات المنتظِرة (Wait/Resume) لاستئناف الـ workflows عند وصول نداء لاحق.",
    bullets: [
      "إنشاء مفاتيح تتبع و hashes للطلبات الواردة.",
      "مواءمة الطلبات مع نقاط التوقف في الـ workflow ثم استكمال التنفيذ من الموضع الصحيح.",
    ],
  },
  {
    title: "test-webhooks.js & test-webhook-registrations.service.js",
    description: "بيئة اختبار للويبهوكات مع بث لحظي للطلبات والردود.",
    bullets: [
      "تسجيل/إلغاء تسجيل الويبهوكات التجريبية بشكل مؤقت.",
      "إرسال الطلبات عبر نفس سلسلة التنفيذ لكن في قناة اختبار مع بث PubSub للواجهة.",
    ],
  },
  {
    title: "webhook-request-handler.js",
    description: "المعالج المركزي للطلبات بعد التعرف على الويبهوك المطلوب.",
    bullets: [
      "يمرر الطلب إلى WebhookService للحصول على التعريف المناسب.",
      "يُهيئ سياق التنفيذ ويطلق تشغيل الـ workflow ثم يبني الاستجابة النهائية." ,
    ],
  },
  {
    title: "webhook-request-sanitizer.js",
    description: "تنظيف وتطبيع بيانات الطلب (Headers/Body/Query) لتوحيدها لأي عميل خارجي.",
    bullets: ["يقلل مفاجآت اختلاف العملاء قبل وصول الطلب إلى العقدة النهائية."],
  },
  {
    title: "webhook-response.js",
    description: "مسؤول عن تكوين الاستجابة (Status, Headers, Body) مع دعم النمط القديم للردود.",
    bullets: ["يضمن التوافق مع إصدارات سابقة ويستجيب بصيغ مختلفة حسب إعداد العقدة."],
  },
  {
    title: "webhooks.controller.js",
    description: "REST Controller داخلي يوفر عمليات إدارية مثل POST /webhooks/find للتشخيص.",
    bullets: ["يساعد فرق التشغيل على التحقق من الويبهوكات المسجلة وإرجاع تفاصيلها."],
  },
  {
    title: "waiting / live / test integration",
    description: "أنماط التشغيل الثلاثة التي يدعمها النظام.",
    bullets: [
      "Live Webhooks: تنفيذ فعلي للـ workflows في الإنتاج.",
      "Waiting Webhooks: استئناف الـ workflows المتوقفة عند عقد الانتظار.",
      "Test Webhooks: تشغيل تجريبي مع بث مباشر للواجهة." ,
    ],
  },
];

const WORKFLOW_STEPS = [
  "الوصول إلى السيرفر المتخصص بالويبهوك.",
  "تنظيف الطلب عبر webhook-request-sanitizer.",
  "مطابقة المسار والميثود باستخدام WebhookService.",
  "تهيئة وتشغيل الـ workflow الواقعي أو الاختباري.",
  "بناء الرد باستخدام webhook-response وإعادته للعميل.",
];

export default function WebhookOverview() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" aria-label="العودة إلى المحادثات">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">نظرة شاملة على وحدة الويبهوك</h1>
            <p className="text-sm text-muted-foreground">
              دليل سريع لأهم الملفات والخدمات التي تدير استقبال وتشغيل الويبهوكات في n8n.
            </p>
          </div>
        </div>

        <Separator />

        <ScrollArea className="h-[calc(100vh-180px)] pr-2">
          <div className="space-y-6 pb-8">
            <Card>
              <CardHeader>
                <CardTitle>المحتويات الأساسية</CardTitle>
                <CardDescription>
                  ملف واحد لا يعمل بمفرده؛ كل خدمة متخصصة تتكامل مع الأخرى لتكوين دورة حياة ويبهوك مكتملة.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {CORE_MODULES.map((module) => (
                  <div key={module.title} className="rounded border p-4">
                    <h3 className="text-base font-semibold text-foreground">
                      {module.title}
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {module.description}
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {module.bullets.map((bullet, idx) => (
                        <li key={idx} className="leading-relaxed">• {bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مسار الطلب خطوة بخطوة</CardTitle>
                <CardDescription>
                  التسلسل الكامل منذ وصول HTTP Request حتى إرجاع الاستجابة للعميل.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
                  {WORKFLOW_STEPS.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>أنماط التشغيل والمصادقة</CardTitle>
                <CardDescription>
                  لماذا يوجد Live و Waiting و Test؟ وكيف تُدار صلاحيات الوصول لكل مسار؟
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div>
                  <h3 className="font-semibold text-foreground">أنماط الويبهوك</h3>
                  <ul className="mt-2 space-y-1">
                    <li>• Live: تشغيل فعلي للـ workflows النشطة في الإنتاج.</li>
                    <li>• Waiting: انتظار نداء لاحق لاستكمال Workflow متوقف.</li>
                    <li>• Test: تسجيل مؤقت مع بث مباشر للواجهة أثناء التطوير.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">المصادقة وضبط الوصول</h3>
                  <p>
                    قائمة السماح <code className="rounded bg-muted px-1 py-0.5">authAllowlistedNodes</code> تستثني عقدًا مثل
                    <code className="rounded bg-muted px-1 py-0.5">CHAT_TRIGGER_NODE_TYPE</code> من بعض القيود، بينما
                    الدالة <code className="rounded bg-muted px-1 py-0.5">findAccessControlOptions()</code> في LiveWebhooks
                    تستخلص سياسات الوصول المناسبة لكل مسار وميثود.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

