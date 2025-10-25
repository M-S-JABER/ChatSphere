export interface SendMessageResponse {
  id?: string;
  status: string;
}

export type IncomingMediaType = "image" | "video" | "audio" | "document" | "unknown";

export interface IncomingMediaDescriptor {
  provider: "meta" | string;
  type: IncomingMediaType;
  mediaId?: string;
  url?: string;
  mimeType?: string;
  filename?: string;
  sha256?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  pageCount?: number;
  previewUrl?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface IncomingMessageEvent {
  from: string;
  body?: string;
  media?: IncomingMediaDescriptor;
  providerMessageId?: string;
  timestamp?: string;
  raw?: any;
}

export interface IWhatsAppProvider {
  send(to: string, body?: string, mediaUrl?: string): Promise<SendMessageResponse>;
  verifyWebhook(request: any): boolean;
  parseIncoming(payload: any): IncomingMessageEvent[];
}
