import {
  conversations,
  messages,
  users,
  webhooks,
  webhookEvents,
  appSettings,
  type Conversation,
  type Message,
  type User,
  type Webhook,
  type WebhookEvent,
  type InsertConversation,
  type InsertMessage,
  type InsertUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export type WhatsappInstanceConfig = {
  id: string;
  name: string;
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken?: string | null;
  appSecret?: string | null;
  webhookBehavior?: "auto" | "accept" | "reject";
  isActive?: boolean;
  updatedAt?: string;
  source?: "custom" | "env";
};

export type CustomWebhookResponseConfig = {
  get: {
    enabled: boolean;
    status: number;
    contentType: string;
    body: string;
  };
  post: {
    enabled: boolean;
    status: number;
    contentType: string;
    body: string;
  };
  updatedAt?: string;
};

export interface IStorage {
  getConversations(page?: number, pageSize?: number, archived?: boolean): Promise<{ items: Conversation[]; total: number }>;
  getConversationByPhone(phone: string): Promise<Conversation | undefined>;
  getConversationById(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationLastAt(id: string): Promise<void>;
  toggleConversationArchive(id: string, archived: boolean): Promise<Conversation>;
  
  getMessages(conversationId: string, page?: number, pageSize?: number): Promise<{ items: Message[]; total: number }>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: string): Promise<{ id: string; conversationId: string } | null>;
  
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<Pick<User, "username" | "role">>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  
  getStatistics(): Promise<any>;
  
  // Webhooks
  createWebhook(data: any): Promise<any>;
  deleteWebhook(id: string): Promise<void>;
  getAllWebhooks(): Promise<any[]>;

  // Webhook events
  logWebhookEvent(event: any): Promise<any>;
  getWebhookEvents(limit?: number): Promise<any[]>;

  // App settings
  getDefaultWhatsappInstance(): Promise<WhatsappInstanceConfig | null>;
  setDefaultWhatsappInstance(config: WhatsappInstanceConfig): Promise<void>;
  clearDefaultWhatsappInstance(): Promise<void>;
  getCustomWebhookResponse(): Promise<CustomWebhookResponseConfig>;
  setCustomWebhookResponse(config: CustomWebhookResponseConfig): Promise<void>;
  
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getConversations(page: number = 1, pageSize: number = 20, archived: boolean = false): Promise<{ items: Conversation[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const [items, totalResult] = await Promise.all([
      db
        .select()
        .from(conversations)
        .where(eq(conversations.archived, archived))
        .orderBy(desc(conversations.lastAt), desc(conversations.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(eq(conversations.archived, archived)),
    ]);

    return {
      items,
      total: totalResult[0]?.count || 0,
    };
  }

  async getConversationByPhone(phone: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.phone, phone));
    return conversation;
  }

  async getConversationById(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values(insertConversation)
      .returning();
    return conversation;
  }

  async updateConversationLastAt(id: string): Promise<void> {
    await db
      .update(conversations)
      .set({ lastAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, id));
  }

  async toggleConversationArchive(id: string, archived: boolean): Promise<Conversation> {
    const [conversation] = await db
      .update(conversations)
      .set({ archived, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return conversation;
  }

  async getMessages(
    conversationId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ items: Message[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [items, totalResult] = await Promise.all([
      db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(eq(messages.conversationId, conversationId)),
    ]);

    return {
      items,
      total: totalResult[0]?.count || 0,
    };
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage as any)
      .returning();
    return message;
  }

  async deleteMessage(id: string): Promise<{ id: string; conversationId: string } | null> {
    const [deleted] = await db
      .delete(messages)
      .where(eq(messages.id, id))
      .returning({ id: messages.id, conversationId: messages.conversationId });

    return deleted ?? null;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(users.createdAt);
  }

  async updateUser(id: string, updates: Partial<Pick<User, "username" | "role">>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db
      .delete(users)
      .where(eq(users.id, id));
  }

  async getStatistics(): Promise<any> {
    // Get total counts
    const [totalConversations] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations);

    const [totalMessages] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages);

    const [incomingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.direction, 'in'));

    const [outgoingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.direction, 'out'));

    // Get most active conversations (top 5)
    const topConversations = await db
      .select({
        phone: conversations.phone,
        displayName: conversations.displayName,
        messageCount: sql<number>`count(${messages.id})::int`,
      })
      .from(conversations)
      .leftJoin(messages, eq(messages.conversationId, conversations.id))
      .groupBy(conversations.id, conversations.phone, conversations.displayName)
      .orderBy(desc(sql`count(${messages.id})`))
      .limit(5);

    // Get messages by day (last 7 days)
    const messagesByDay = await db
      .select({
        date: sql<string>`DATE(${messages.createdAt})`,
        incoming: sql<number>`count(CASE WHEN ${messages.direction} = 'in' THEN 1 END)::int`,
        outgoing: sql<number>`count(CASE WHEN ${messages.direction} = 'out' THEN 1 END)::int`,
      })
      .from(messages)
      .where(sql`${messages.createdAt} >= NOW() - INTERVAL '7 days'`)
      .groupBy(sql`DATE(${messages.createdAt})`)
      .orderBy(sql`DATE(${messages.createdAt})`);

    // Get recent activity (last 10 messages)
    const recentActivity = await db
      .select({
        id: messages.id,
        direction: messages.direction,
        body: messages.body,
        createdAt: messages.createdAt,
        phone: conversations.phone,
        displayName: conversations.displayName,
      })
      .from(messages)
      .leftJoin(conversations, eq(messages.conversationId, conversations.id))
      .orderBy(desc(messages.createdAt))
      .limit(10);

    return {
      totals: {
        conversations: totalConversations?.count || 0,
        messages: totalMessages?.count || 0,
        incoming: incomingCount?.count || 0,
        outgoing: outgoingCount?.count || 0,
      },
      topConversations,
      messagesByDay,
      recentActivity,
    };
  }


  // Webhooks
  async createWebhook(data: any): Promise<any> {
    const [hook] = await db
      .insert(webhooks)
      .values({
        name: data.name,
        url: data.url,
        verifyToken: data.verifyToken || null,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      })
      .returning();
    return hook;
  }

  async deleteWebhook(id: string): Promise<void> {
    await db
      .delete(webhooks)
      .where(eq(webhooks.id, id));
  }

  async getAllWebhooks(): Promise<any[]> {
    return await db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
  }

  async updateWebhook(id: string, updates: Partial<{ name: string; url: string; verifyToken: string | null; isActive: boolean }>): Promise<any> {
    const [hook] = await db
      .update(webhooks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, id))
      .returning();
    return hook;
  }

  // Webhook events
  async logWebhookEvent(event: any): Promise<any> {
    const [row] = await db
      .insert(webhookEvents)
      .values({
        webhookId: event.webhookId || null,
        headers: event.headers || {},
        query: event.query || {},
        body: event.body || null,
        response: event.response || null,
      })
      .returning();
    return row;
  }

  async getWebhookEvents(limit: number = 200): Promise<any[]> {
    return await db.select().from(webhookEvents).orderBy(desc(webhookEvents.createdAt)).limit(limit);
  }

  async deleteWebhookEvents(): Promise<void> {
    await db.delete(webhookEvents);
  }

  async deleteWebhookEventById(id: string): Promise<void> {
    await db.delete(webhookEvents).where(eq(webhookEvents.id, id));
  }

  // Admin: update basic entities safely (users, instances, webhooks)
  async adminUpdateUser(id: string, updates: Partial<{ username: string; role: string }>) {
    const [user] = await db.update(users).set({ ...updates }).where(eq(users.id, id)).returning();
    return user;
  }


  async adminUpdateWebhook(id: string, updates: Partial<{ name: string; url: string; verifyToken?: string | null; isActive?: boolean }>) {
    const [hook] = await db.update(webhooks).set({ ...updates, updatedAt: new Date() }).where(eq(webhooks.id, id)).returning();
    return hook;
  }

  async getDefaultWhatsappInstance(): Promise<WhatsappInstanceConfig | null> {
    const stored = await this.getAppSetting("defaultWhatsappInstance");
    if (stored) {
      return {
        id: stored.id || "default",
        name: stored.name || "Default WhatsApp Instance",
        phoneNumberId: stored.phoneNumberId || "",
        accessToken: stored.accessToken || "",
        webhookVerifyToken: stored.webhookVerifyToken ?? null,
        appSecret: stored.appSecret ?? null,
        webhookBehavior: stored.webhookBehavior || "auto",
        isActive: typeof stored.isActive === "boolean" ? stored.isActive : true,
        updatedAt: stored.updatedAt,
        source: "custom",
      };
    }

    if (process.env.META_TOKEN || process.env.META_PHONE_NUMBER_ID) {
      return {
        id: "default",
        name: "Default WhatsApp Instance",
        phoneNumberId: process.env.META_PHONE_NUMBER_ID || "",
        accessToken: process.env.META_TOKEN || "",
        webhookVerifyToken: process.env.META_VERIFY_TOKEN || null,
        appSecret: process.env.META_APP_SECRET || null,
        webhookBehavior: "auto",
        isActive: true,
        source: "env",
      };
    }

    return null;
  }

  async setDefaultWhatsappInstance(config: WhatsappInstanceConfig): Promise<void> {
    const payload: WhatsappInstanceConfig = {
      ...config,
      id: "default",
      name: config.name || "Default WhatsApp Instance",
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      webhookVerifyToken: config.webhookVerifyToken ?? null,
      appSecret: config.appSecret ?? null,
      webhookBehavior: config.webhookBehavior || "auto",
      isActive: typeof config.isActive === "boolean" ? config.isActive : true,
      updatedAt: new Date().toISOString(),
      source: "custom",
    };

    await this.setAppSetting("defaultWhatsappInstance", payload);
  }

  async clearDefaultWhatsappInstance(): Promise<void> {
    await db.delete(appSettings).where(eq(appSettings.key, "defaultWhatsappInstance"));
  }

  private defaultCustomWebhookResponse(): CustomWebhookResponseConfig {
    return {
      get: {
        enabled: true,
        status: 200,
        contentType: "text/plain",
        body: "{{query.hub.challenge}}",
      },
      post: {
        enabled: true,
        status: 200,
        contentType: "application/json",
        body: "{{json body}}",
      },
    };
  }

  async getCustomWebhookResponse(): Promise<CustomWebhookResponseConfig> {
    const stored = await this.getAppSetting("customWebhookResponse");
    if (!stored) {
      return this.defaultCustomWebhookResponse();
    }
    return {
      ...this.defaultCustomWebhookResponse(),
      ...stored,
    };
  }

  async setCustomWebhookResponse(config: CustomWebhookResponseConfig): Promise<void> {
    const payload: CustomWebhookResponseConfig = {
      get: {
        enabled: config.get?.enabled ?? true,
        status: typeof config.get?.status === "number" ? config.get.status : 200,
        contentType: config.get?.contentType || "text/plain",
        body: typeof config.get?.body === "string" ? config.get.body : "{{query.hub.challenge}}",
      },
      post: {
        enabled: config.post?.enabled ?? true,
        status: typeof config.post?.status === "number" ? config.post.status : 200,
        contentType: config.post?.contentType || "application/json",
        body: typeof config.post?.body === "string" ? config.post.body : "{{json body}}",
      },
      updatedAt: new Date().toISOString(),
    };

    await this.setAppSetting("customWebhookResponse", payload);
  }

  // App settings (simple key/value JSON store)
  async getAppSetting(key: string): Promise<any | null> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row ? row.value : null;
  }

  async setAppSetting(key: string, value: any): Promise<void> {
    const existing = await db.select().from(appSettings).where(eq(appSettings.key, key));
    if (existing.length > 0) {
      await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value, updatedAt: new Date() });
    }
  }

}

export const storage = new DatabaseStorage();
