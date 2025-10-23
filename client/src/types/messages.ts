import type { Message } from "@shared/schema";

export type ReplySummary = {
  id: string;
  body: string | null;
  direction: string;
  createdAt: string;
};

export type ChatMessage = Message & {
  replyTo?: ReplySummary | null;
};
