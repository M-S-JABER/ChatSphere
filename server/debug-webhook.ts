import { storage } from './storage';
import { MetaProvider } from './providers/meta';

export class WebhookDebugger {
  static async debugWebhookFlow(instanceId: string, payload: any, headers: any, query: any) {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      instanceId,
      payload: JSON.stringify(payload, null, 2),
      headers: JSON.stringify(headers, null, 2),
      query: JSON.stringify(query, null, 2),
      analysis: {} as any
    };

    try {
      // 1. فحص الـ provider
      const instanceConfig = await storage.getDefaultWhatsappInstance();
      const provider = new MetaProvider(
        instanceConfig?.accessToken,
        instanceConfig?.phoneNumberId,
        instanceConfig?.webhookVerifyToken ?? undefined,
        instanceConfig?.appSecret ?? undefined
      );

      debugInfo.analysis.instanceData = {
        id: instanceConfig?.id ?? 'default',
        name: instanceConfig?.name ?? 'Default WhatsApp Instance',
        isActive: instanceConfig?.isActive ?? true,
        hasAppSecret: !!(instanceConfig?.appSecret || process.env.META_APP_SECRET),
        hasVerifyToken: !!(instanceConfig?.webhookVerifyToken || process.env.META_VERIFY_TOKEN),
        webhookBehavior: instanceConfig?.webhookBehavior ?? 'auto',
        phoneNumberId: instanceConfig?.phoneNumberId ?? process.env.META_PHONE_NUMBER_ID ?? '',
        source: instanceConfig?.source ?? (process.env.META_TOKEN || process.env.META_PHONE_NUMBER_ID ? 'env' : 'custom'),
      };

      // 3. فحص تحليل الرسائل
      debugInfo.analysis.payloadStructure = {
        hasEntry: !!payload.entry,
        entryCount: payload.entry ? payload.entry.length : 0,
        entries: payload.entry ? payload.entry.map((entry: any) => ({
          hasChanges: !!entry.changes,
          changesCount: entry.changes ? entry.changes.length : 0,
          changes: entry.changes ? entry.changes.map((change: any) => ({
            hasValue: !!change.value,
            hasMessages: !!change.value?.messages,
            messagesCount: change.value?.messages ? change.value.messages.length : 0,
            messages: change.value?.messages ? change.value.messages.map((msg: any) => ({
              from: msg.from,
              type: msg.type,
              hasText: !!msg.text,
              hasImage: !!msg.image,
              textBody: msg.text?.body,
              imageCaption: msg.image?.caption
            })) : []
          })) : []
        })) : []
      };

      // 4. فحص تحليل الرسائل
      const events = provider.parseIncoming(payload);
      debugInfo.analysis.parsedEvents = {
        count: events.length,
        events: events.map(event => ({
          from: event.from,
          hasBody: !!event.body,
          body: event.body,
          hasMedia: !!event.media,
          media: event.media,
          hasRaw: !!event.raw
        }))
      };

      // 5. فحص التحقق من التوقيع
      if (instanceConfig?.appSecret || process.env.META_APP_SECRET) {
        const rawBody = JSON.stringify(payload);
        const signatureValid = provider.verifyWebhookSignature({ headers }, rawBody);
        debugInfo.analysis.signatureVerification = {
          hasAppSecret: true,
          signatureValid,
          signatureHeader: headers['x-hub-signature-256']
        };
      } else {
        debugInfo.analysis.signatureVerification = {
          hasAppSecret: false,
          signatureValid: true
        };
      }

      // 6. فحص سلوك الـ webhook
      debugInfo.analysis.webhookBehavior = 'auto';

    } catch (error: any) {
      debugInfo.analysis.error = error.message;
      debugInfo.analysis.stack = error.stack;
    }

    return debugInfo;
  }

  static async logWebhookDebug(instanceId: string, payload: any, headers: any, query: any) {
    const debugInfo = await this.debugWebhookFlow(instanceId, payload, headers, query);
    
    // حفظ في قاعدة البيانات
    await storage.logWebhookEvent({
      headers,
      query,
      body: payload,
      response: { 
        status: 200, 
        body: 'debug_logged',
        debugInfo 
      }
    });

    // طباعة في الكونسول
    console.log('🔍 WEBHOOK DEBUG INFO:');
    console.log(JSON.stringify(debugInfo, null, 2));
    
    return debugInfo;
  }
}
