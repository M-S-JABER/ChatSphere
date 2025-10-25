import {
  IWhatsAppProvider,
  SendMessageResponse,
  IncomingMessageEvent,
  IncomingMediaDescriptor,
  IncomingMediaType,
} from "./base";
import crypto from "crypto";
import path from "path";

export class MetaProvider implements IWhatsAppProvider {
  private token: string;
  private phoneNumberId: string;
  private verifyToken: string;
  private appSecret: string;
  private graphVersion: string;

  constructor(
    token?: string,
    phoneNumberId?: string,
    verifyToken?: string,
    appSecret?: string,
    graphVersion?: string,
  ) {
    this.token = token || process.env.META_TOKEN || "";
    this.phoneNumberId = phoneNumberId || process.env.META_PHONE_NUMBER_ID || "";
    this.verifyToken = verifyToken || process.env.META_VERIFY_TOKEN || "";
    this.appSecret = appSecret || process.env.META_APP_SECRET || "";
    this.graphVersion = graphVersion || process.env.META_GRAPH_VERSION || "v19.0";

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
      const normalizedUrl = mediaUrl.split("?")[0].split("#")[0];
      const extension = path.extname(normalizedUrl || "").toLowerCase();

      const asImage = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const asVideo = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
      const asAudio = [".mp3", ".mpeg", ".ogg", ".wav", ".aac"];
      const asDocument = [
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".txt",
        ".csv",
      ];

      const filename = path.basename(normalizedUrl || "attachment");

      if (asImage.includes(extension)) {
        messagePayload.type = "image";
        messagePayload.image = { link: mediaUrl };
        if (body) {
          messagePayload.image.caption = body;
        }
      } else if (asVideo.includes(extension)) {
        messagePayload.type = "video";
        messagePayload.video = { link: mediaUrl };
        if (body) {
          messagePayload.video.caption = body;
        }
      } else if (asAudio.includes(extension)) {
        messagePayload.type = "audio";
        messagePayload.audio = { link: mediaUrl };
      } else if (asDocument.includes(extension) || extension.length === 0) {
        messagePayload.type = "document";
        messagePayload.document = { link: mediaUrl, filename };
        if (body) {
          messagePayload.document.caption = body;
        }
      } else {
        messagePayload.type = "document";
        messagePayload.document = { link: mediaUrl, filename };
        if (body) {
          messagePayload.document.caption = body;
        }
      }
    } else if (body) {
      messagePayload.type = "text";
      messagePayload.text = { body };
    }

    const response = await fetch(
      `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      },
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
            
            const timestampSeconds = Number(msg.timestamp);
            const timestampIso = Number.isFinite(timestampSeconds)
              ? new Date(timestampSeconds * 1000).toISOString()
              : new Date().toISOString();

            const event: IncomingMessageEvent = {
              from: msg.from,
              raw: msg,
              providerMessageId: msg.id,
              timestamp: timestampIso,
            };

            if (msg.type === "text") {
              event.body = msg.text?.body;
              console.log(`📝 MetaProvider.parseIncoming - Text message from ${msg.from}: ${event.body}`);
            } else if (msg.type === "image") {
              event.media = this.buildMediaDescriptor("image", msg.image);
              event.body = msg.image?.caption ?? msg.caption;
              console.log(`🖼️ MetaProvider.parseIncoming - Image message from ${msg.from}: ${event.body || 'No caption'}`);
            } else if (msg.type === "document") {
              event.media = this.buildMediaDescriptor("document", msg.document);
              event.body = msg.document?.caption ?? msg.caption;
              console.log(
                `📄 MetaProvider.parseIncoming - Document message from ${msg.from}: ${msg.document?.filename || 'No filename'}`
              );
            } else if (msg.type === "video") {
              event.media = this.buildMediaDescriptor("video", msg.video);
              event.body = msg.video?.caption ?? msg.caption;
              console.log(`🎬 MetaProvider.parseIncoming - Video message from ${msg.from}`);
            } else if (msg.type === "audio") {
              event.media = this.buildMediaDescriptor("audio", msg.audio);
              console.log(`🎵 MetaProvider.parseIncoming - Audio message from ${msg.from}`);
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

  getAccessToken(): string {
    return this.token;
  }

  getGraphVersion(): string {
    return this.graphVersion;
  }

  async fetchMediaMetadata(mediaId: string): Promise<MetaMediaMetadata> {
    if (!this.token) {
      throw new Error("Meta access token is not configured");
    }

    const response = await fetch(
      `https://graph.facebook.com/${this.graphVersion}/${mediaId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch media metadata (${response.status}): ${body}`);
    }

    return (await response.json()) as MetaMediaMetadata;
  }

  async downloadMedia(url: string): Promise<{ buffer: Buffer; contentType?: string | null }> {
    if (!this.token) {
      throw new Error("Meta access token is not configured");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to download media (${response.status}): ${body}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type");
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }

  private buildMediaDescriptor(type: IncomingMediaType, payload: any): IncomingMediaDescriptor | undefined {
    if (!payload) return undefined;

    const descriptor: IncomingMediaDescriptor = {
      provider: "meta",
      type,
      mediaId: payload?.id ?? payload?.media_id ?? undefined,
      url: payload?.link ?? undefined,
      mimeType: payload?.mime_type ?? payload?.mimetype ?? undefined,
      filename: payload?.filename ?? undefined,
      sha256: payload?.sha256 ?? undefined,
      sizeBytes: payload?.file_size ?? payload?.filesize ?? undefined,
      width: payload?.width ?? undefined,
      height: payload?.height ?? undefined,
      durationSeconds: payload?.duration ?? undefined,
      pageCount: payload?.page_count ?? undefined,
      previewUrl: payload?.preview_url ?? undefined,
      thumbnailUrl: payload?.thumbnail_url ?? undefined,
      metadata: payload,
    };

    return descriptor;
  }
}

export interface MetaMediaMetadata {
  id: string;
  url: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
  width?: number;
  height?: number;
  voice?: boolean;
  messaging_product?: string;
  name?: string;
}
