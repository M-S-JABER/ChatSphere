export interface SendMessageResponse {
  id?: string;
  status: string;
}

export interface IncomingMessageEvent {
  from: string;
  body?: string;
  media?: {
    url: string;
    filename?: string;
  };
  raw?: any;
}

export interface IWhatsAppProvider {
  send(to: string, body?: string, mediaUrl?: string): Promise<SendMessageResponse>;
  verifyWebhook(request: any): boolean;
  parseIncoming(payload: any): IncomingMessageEvent[];
}
