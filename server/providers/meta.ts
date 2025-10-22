import { IWhatsAppProvider, SendMessageResponse, IncomingMessageEvent } from "./base";
import crypto from "crypto";

export class MetaProvider implements IWhatsAppProvider {
  private token: string;
  private phoneNumberId: string;
  private verifyToken: string;
  private appSecret: string;

  constructor(
    token?: string,
    phoneNumberId?: string,
    verifyToken?: string,
    appSecret?: string
  ) {
    this.token = token || process.env.META_TOKEN || "";
    this.phoneNumberId = phoneNumberId || process.env.META_PHONE_NUMBER_ID || "";
    this.verifyToken = verifyToken || process.env.META_VERIFY_TOKEN || "";
    this.appSecret = appSecret || process.env.META_APP_SECRET || "";

    if (!this.token || !this.phoneNumberId) {
      console.warn("Meta credentials not configured. Sending messages will fail.");
    }
  }

  async send(to: string, body?: string, mediaUrl?: string): Promise<SendMessageResponse> {
    if (!this.token || !this.phoneNumberId) {
      throw new Error("Meta credentials not configured. Please set META_TOKEN and META_PHONE_NUMBER_ID environment variables.");
    }

    const cleanPhone = to.replace(/\D/g, "");

    const messagePayload: any = {
      messaging_product: "whatsapp",
      to: cleanPhone,
    };

    if (mediaUrl) {
      messagePayload.type = "image";
      messagePayload.image = { link: mediaUrl };
      if (body) {
        messagePayload.image.caption = body;
      }
    } else if (body) {
      messagePayload.type = "text";
      messagePayload.text = { body };
    }

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Meta API error: ${error}`);
    }

    const data = await response.json();
    return { id: data.messages?.[0]?.id, status: "sent" };
  }

  verifyWebhook(request: any): boolean {
    const mode = request.query?.["hub.mode"];
    const token = request.query?.["hub.verify_token"];
    return mode === "subscribe" && token === this.verifyToken;
  }

  verifyWebhookSignature(request: any, rawBody: string): boolean {
    const signature = request.headers?.["x-hub-signature-256"];
    if (!signature) {
      console.warn("Missing X-Hub-Signature-256 header");
      return !this.appSecret;
    }

    if (!this.appSecret) {
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", this.appSecret)
        .update(rawBody)
        .digest("hex");

      const signatureHash = signature.replace("sha256=", "");

      return crypto.timingSafeEqual(
        Buffer.from(signatureHash),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error("Meta signature verification error:", error);
      return false;
    }
  }

  parseIncoming(payload: any): IncomingMessageEvent[] {
    const events: IncomingMessageEvent[] = [];

    console.log('🔍 MetaProvider.parseIncoming - Raw payload:', JSON.stringify(payload, null, 2));

    if (!payload.entry) {
      console.warn('⚠️ MetaProvider.parseIncoming - No entry in payload');
      return events;
    }

    console.log(`📥 MetaProvider.parseIncoming - Processing ${payload.entry.length} entries`);

    for (const entry of payload.entry) {
      console.log('📋 MetaProvider.parseIncoming - Processing entry:', JSON.stringify(entry, null, 2));
      
      if (!entry.changes) {
        console.warn('⚠️ MetaProvider.parseIncoming - No changes in entry');
        continue;
      }

      for (const change of entry.changes) {
        console.log('🔄 MetaProvider.parseIncoming - Processing change:', JSON.stringify(change, null, 2));
        
        if (change.value?.messages) {
          console.log(`💬 MetaProvider.parseIncoming - Processing ${change.value.messages.length} messages`);
          
          for (const msg of change.value.messages) {
            console.log('📨 MetaProvider.parseIncoming - Processing message:', JSON.stringify(msg, null, 2));
            
            const event: IncomingMessageEvent = {
              from: msg.from,
              raw: msg,
            };

            if (msg.type === "text") {
              event.body = msg.text?.body;
              console.log(`📝 MetaProvider.parseIncoming - Text message from ${msg.from}: ${event.body}`);
            } else if (msg.type === "image") {
              event.media = { url: msg.image?.link || msg.image?.id };
              event.body = msg.image?.caption;
              console.log(`🖼️ MetaProvider.parseIncoming - Image message from ${msg.from}: ${event.body || 'No caption'}`);
            } else {
              console.log(`❓ MetaProvider.parseIncoming - Unknown message type: ${msg.type}`);
            }

            events.push(event);
          }
        } else {
          console.warn('⚠️ MetaProvider.parseIncoming - No messages in change.value');
        }
      }
    }

    console.log(`✅ MetaProvider.parseIncoming - Parsed ${events.length} events`);
    return events;
  }
}
