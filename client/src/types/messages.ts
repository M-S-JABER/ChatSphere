import type { Message } from "@shared/schema";

export type ReplySummary = {
  id: string;
  content: string | null;
  direction: "inbound" | "outbound";
  senderLabel: string;
  createdAt: string;
};

export type ChatMessage = Message & {
  replyTo?: ReplySummary | null;
};
