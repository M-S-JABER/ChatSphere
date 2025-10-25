import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { storage, type WhatsappInstanceConfig } from "./storage";
import { MetaProvider } from "./providers/meta";
import { WebhookDebugger } from "./debug-webhook";
import { upload } from "./services/uploads";

function resolvePublicMediaUrl(req: Request, mediaPath: string): string {
  if (!mediaPath) {
    return mediaPath;
  }

  if (/^https?:\/\//i.test(mediaPath)) {
    return mediaPath;
  }

  const configuredBase =
    process.env.MEDIA_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.PUBLIC_APP_URL;

  if (configuredBase) {
    const base = configuredBase.replace(/\/+$/, "");
    const path = mediaPath.startsWith("/") ? mediaPath : `/${mediaPath}`;
    return `${base}${path}`;
  }

  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  if (!host) {
    return mediaPath;
  }

  const forwardedProto = req.get("x-forwarded-proto");
  let protocol = forwardedProto ? forwardedProto.split(",")[0]?.trim() : undefined;

  if (!protocol) {
    protocol = req.protocol;
  }

  if (!protocol) {
    protocol = "http";
  }

  protocol = protocol.replace(/:$/, "").toLowerCase();

  const path = mediaPath.startsWith("/") ? mediaPath : `/${mediaPath}`;
  return `${protocol}://${host}${path}`;
}

// Helper function to create a Meta provider using persisted settings (with env fallback)
async function createMetaProvider(): Promise<{
  provider: MetaProvider;
  instance: WhatsappInstanceConfig | null;
}> {
  const instance = await storage.getDefaultWhatsappInstance();

  if (instance) {
    if (instance.isActive === false) {
      throw new Error("Default WhatsApp instance is disabled.");
    }

    if (!instance.accessToken || !instance.phoneNumberId) {
      throw new Error("Default WhatsApp instance is missing required credentials.");
    }

    const provider = new MetaProvider(
      instance.accessToken,
      instance.phoneNumberId,
      instance.webhookVerifyToken ?? undefined,
      instance.appSecret ?? undefined
    );

    return { provider, instance };
  }

  const provider = new MetaProvider(
    process.env.META_TOKEN,
    process.env.META_PHONE_NUMBER_ID,
    process.env.META_VERIFY_TOKEN,
    process.env.META_APP_SECRET
  );

  return { provider, instance: null };
}

const wsClients = new Set<WebSocket>();

function broadcastMessage(event: string, data: any) {
  const message = JSON.stringify({ event, data });
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function toInstanceResponse(instance: WhatsappInstanceConfig | null) {
  if (!instance) {
    return null;
  }

  return {
    id: instance.id,
    name: instance.name,
    phoneNumberId: instance.phoneNumberId,
    webhookBehavior: instance.webhookBehavior ?? "auto",
    isActive: instance.isActive ?? true,
    source: instance.source ?? "custom",
    updatedAt: instance.updatedAt ?? null,
    accessTokenConfigured: !!instance.accessToken,
    webhookVerifyTokenConfigured: !!instance.webhookVerifyToken,
    appSecretConfigured: !!instance.appSecret,
    hasAppSecret: !!instance.appSecret,
    hasVerifyToken: !!instance.webhookVerifyToken,
  };
}

  

export async function registerRoutes(app: Express, requireAdmin: any): Promise<Server> {
  // Use persistent storage for webhook events and settings (no in-memory state)

  const normalizeWebhookPath = (inputPath: string): string => {
    const fallback = "/webhook/meta";
    if (typeof inputPath !== "string" || inputPath.trim().length === 0) {
      return fallback;
    }

    let normalized = inputPath.trim();

    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }

    normalized = normalized.replace(/\/{2,}/g, "/");

    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.replace(/\/+$/, "");
    }

    if (!normalized.startsWith("/webhook")) {
      normalized = `/webhook${normalized === "/" ? "" : normalized}`;
    }

    return normalized || fallback;
  };

  const normalizeForComparison = (value: string): string => {
    if (!value) return "/";
    let normalized = value.startsWith("/") ? value : `/${value}`;
    normalized = normalized.replace(/\/{2,}/g, "/");
    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.replace(/\/+$/, "");
    }
    return normalized || "/";
  };

  const metaWebhookSettings = await storage.getMetaWebhookSettings();
  let metaWebhookPath = normalizeWebhookPath(metaWebhookSettings.path);

  const pathsMatchMetaWebhook = (pathToCheck: string) =>
    normalizeForComparison(pathToCheck) === normalizeForComparison(metaWebhookPath);

  const updateMetaWebhookPath = (nextPath: string) => {
    metaWebhookPath = normalizeWebhookPath(nextPath);
  };

  // Admin endpoint to get/set API controls (persisted)
  app.get('/api/admin/api-controls', requireAdmin, async (req: Request, res: Response) => {
    const v = await storage.getAppSetting('apiControls');
    res.json(v || { testWebhookEnabled: true });
  });

  app.post('/api/admin/api-controls', requireAdmin, async (req: Request, res: Response) => {
    const { testWebhookEnabled } = req.body as { testWebhookEnabled?: boolean };
    const current = (await storage.getAppSetting('apiControls')) || { testWebhookEnabled: true };
    if (typeof testWebhookEnabled === 'boolean') current.testWebhookEnabled = testWebhookEnabled;
    await storage.setAppSetting('apiControls', current);
    res.json(current);
  });

  app.get("/api/admin/webhook-config", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const config = await storage.getMetaWebhookSettings();
      res.json({ config });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/webhook-config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const requestedPath = typeof req.body?.path === "string" ? req.body.path : "";
      if (!requestedPath.trim()) {
        return res.status(400).json({ error: "Path is required." });
      }

      const sanitizedPath = normalizeWebhookPath(requestedPath);
      await storage.setMetaWebhookSettings({ path: sanitizedPath });
      updateMetaWebhookPath(sanitizedPath);

      const updated = await storage.getMetaWebhookSettings();
      res.json({ config: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/admin/whatsapp/default-instance', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const instance = await storage.getDefaultWhatsappInstance();
      res.json({ instance: toInstanceResponse(instance) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/whatsapp/default-instance', requireAdmin, async (req: Request, res: Response) => {
    try {
      const current = await storage.getDefaultWhatsappInstance();
      const {
        name,
        phoneNumberId,
        accessToken,
        webhookVerifyToken,
        appSecret,
        webhookBehavior,
        isActive,
      } = req.body as Partial<{
        name: string;
        phoneNumberId: string;
        accessToken: string;
        webhookVerifyToken: string | null;
        appSecret: string | null;
        webhookBehavior: "auto" | "accept" | "reject";
        isActive: boolean;
      }>;

      const trimmedName = typeof name === "string" ? name.trim() : undefined;
      const trimmedPhoneNumberId = typeof phoneNumberId === "string" ? phoneNumberId.trim() : undefined;
      const trimmedAccessToken = typeof accessToken === "string" ? accessToken.trim() : undefined;

      const resolvedName =
        (trimmedName && trimmedName.length > 0
          ? trimmedName
          : current?.name) || "Default WhatsApp Instance";
      const resolvedPhoneNumberId =
        (trimmedPhoneNumberId && trimmedPhoneNumberId.length > 0
          ? trimmedPhoneNumberId
          : current?.phoneNumberId) || "";

      if (!resolvedPhoneNumberId) {
        return res.status(400).json({ error: "Phone Number ID is required." });
      }

      if (trimmedAccessToken === "") {
        return res.status(400).json({ error: "Access token cannot be empty." });
      }

      const resolvedAccessToken =
        trimmedAccessToken && trimmedAccessToken.length > 0
          ? trimmedAccessToken
          : current?.accessToken || "";

      if (!resolvedAccessToken) {
        return res.status(400).json({ error: "Access token is required." });
      }

      let resolvedVerifyToken = current?.webhookVerifyToken ?? null;
      if (webhookVerifyToken !== undefined) {
        if (webhookVerifyToken === null) {
          resolvedVerifyToken = null;
        } else if (typeof webhookVerifyToken === "string") {
          const trimmed = webhookVerifyToken.trim();
          resolvedVerifyToken = trimmed.length > 0 ? trimmed : null;
        }
      }

      let resolvedAppSecret = current?.appSecret ?? null;
      if (appSecret !== undefined) {
        if (appSecret === null) {
          resolvedAppSecret = null;
        } else if (typeof appSecret === "string") {
          const trimmed = appSecret.trim();
          resolvedAppSecret = trimmed.length > 0 ? trimmed : null;
        }
      }

      const allowedBehaviors: Array<"auto" | "accept" | "reject"> = ["auto", "accept", "reject"];
      const resolvedBehavior =
        typeof webhookBehavior === "string" && allowedBehaviors.includes(webhookBehavior)
          ? webhookBehavior
          : current?.webhookBehavior || "auto";

      const resolvedIsActive =
        typeof isActive === "boolean" ? isActive : current?.isActive ?? true;

      await storage.setDefaultWhatsappInstance({
        id: "default",
        name: resolvedName,
        phoneNumberId: resolvedPhoneNumberId,
        accessToken: resolvedAccessToken,
        webhookVerifyToken: resolvedVerifyToken,
        appSecret: resolvedAppSecret,
        webhookBehavior: resolvedBehavior,
        isActive: resolvedIsActive,
      });

      const updated = await storage.getDefaultWhatsappInstance();
      res.json({ instance: toInstanceResponse(updated) });
    } catch (error: any) {
      console.error("Failed to update default WhatsApp instance:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin endpoint to clear webhook events
  app.post('/api/webhooks/clear', requireAdmin, async (_req: Request, res: Response) => {
    await storage.deleteWebhookEvents();
    res.json({ ok: true });
  });

  // Admin endpoints to inspect webhook events and configure behavior
  app.get('/api/webhooks/events', requireAdmin, async (req: Request, res: Response) => {
    const { webhookId } = req.query;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const items = await storage.getWebhookEvents(
      limit && Number.isFinite(limit) ? limit : undefined,
      typeof webhookId === "string" && webhookId.trim().length > 0
        ? { webhookId: webhookId.trim() }
        : undefined
    );
    res.json({ items });
  });

  // Delete a single webhook event
  app.delete('/api/webhooks/events/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    await storage.deleteWebhookEventById(id);
    res.json({ ok: true });
  });

  // Bulk delete events for instance
  app.delete('/api/webhooks/events', requireAdmin, async (req: Request, res: Response) => {
    await storage.deleteWebhookEvents();
    res.json({ ok: true });
  });

  // Admin data editor endpoints (read lists)
  app.get('/api/admin/users', requireAdmin, async (_req: Request, res: Response) => {
    const items = await storage.getAllUsers();
    res.json(items.map(({ password, ...u }) => u));
  });


  app.get('/api/admin/webhooks', requireAdmin, async (req: Request, res: Response) => {
    const hooks = await storage.getAllWebhooks();
    res.json(hooks);
  });

  // Admin update endpoints
  app.patch('/api/admin/users/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const user = await storage.adminUpdateUser(id, updates);
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });


  app.patch('/api/admin/webhooks/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const hook = await storage.adminUpdateWebhook(id, updates);
    res.json(hook);
  });

  // Serve uploaded files
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // File upload endpoint
  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const publicUrl = resolvePublicMediaUrl(req, fileUrl);
      res.json({ url: fileUrl, publicUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.page_size as string) || 20;
      const archived = req.query.archived === "true";
      const result = await storage.getConversations(page, pageSize, archived);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/conversations/:id/archive", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { archived } = req.body;
      
      if (typeof archived !== "boolean") {
        return res.status(400).json({ error: "archived must be a boolean" });
      }

      const conversation = await storage.toggleConversationArchive(id, archived);
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.page_size as string) || 50;
      const result = await storage.getMessages(id, page, pageSize);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/conversations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: "Conversation id is required" });
      }

      await storage.deleteConversation(id);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { phone, displayName } = req.body as {
        phone?: string;
        displayName?: string | null;
      };

      const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
      if (!trimmedPhone) {
        return res.status(400).json({ error: "Phone number is required." });
      }

      let conversation = await storage.getConversationByPhone(trimmedPhone);

      if (!conversation) {
        conversation = await storage.createConversation({
          phone: trimmedPhone,
          displayName: typeof displayName === "string" ? displayName.trim() || null : null,
          createdByUserId: req.user?.id ?? null,
        });
      }

      res.json({ conversation });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // Webhook CRUD (admin)
  app.get('/api/webhooks', requireAdmin, async (req: Request, res: Response) => {
    const hooks = await storage.getAllWebhooks();
    res.json(hooks);
  });

  app.post('/api/webhooks', requireAdmin, async (req: Request, res: Response) => {
    const { name, url, verifyToken, isActive } = req.body;
    const hook = await storage.createWebhook({ name, url, verifyToken, isActive });
    res.json(hook);
  });

  app.put('/api/webhooks/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    const hook = await storage.updateWebhook(id, updates);
    res.json(hook);
  });

  app.delete('/api/webhooks/:id', requireAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    await storage.deleteWebhook(id);
    res.json({ ok: true });
  });


  app.get("/api/statistics", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getStatistics();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/message/send", async (req: Request, res: Response) => {
    try {
      const {
        to,
        body,
        media_url,
        conversationId,
        replyToMessageId,
      } = req.body as {
        to?: string;
        body?: string | null;
        media_url?: string | null;
        conversationId?: string | null;
        replyToMessageId?: string | null;
      };

      if (!conversationId && !to) {
        return res.status(400).json({ error: "conversationId or to is required." });
      }

      if (!body && !media_url) {
        return res.status(400).json({ error: "body or media_url is required." });
      }

      let conversation = null as Awaited<ReturnType<typeof storage.getConversationById>> | null;

      if (conversationId) {
        conversation = await storage.getConversationById(conversationId);
        if (!conversation) {
          return res.status(404).json({ error: "Conversation not found." });
        }
      }

      if (!conversation) {
        if (!to) {
          return res.status(400).json({ error: "Recipient phone number is required." });
        }

        conversation = await storage.getConversationByPhone(to);

        if (!conversation) {
          conversation = await storage.createConversation({
            phone: to,
            createdByUserId: req.user?.id ?? null,
          });
        }
      }

      const recipientPhone = conversation.phone;
      let replyTarget = null as Awaited<ReturnType<typeof storage.getMessageById>> | null;

      if (replyToMessageId) {
        const messageTarget = await storage.getMessageById(replyToMessageId);

        if (!messageTarget) {
          return res.status(400).json({ error: "Reply target not found." });
        }

        if (messageTarget.conversationId !== conversation.id) {
          return res.status(400).json({ error: "Reply target belongs to a different conversation." });
        }

        if (messageTarget.direction !== "inbound") {
          return res.status(400).json({ error: "You can only reply to incoming messages." });
        }

        replyTarget = messageTarget;
      }

      console.info(
        "message_send_attempt",
        JSON.stringify({
          conversationId: conversation.id,
          replyToMessageId: replyToMessageId ?? null,
          hasMedia: Boolean(media_url),
        }),
      );

      const { provider } = await createMetaProvider();
      let providerMessageId: string | null = null;
      let status: string = "sent";
      let mediaMetadata: { url: string; filename?: string } | null = null;

      try {
        const providerMediaUrl = media_url
          ? resolvePublicMediaUrl(req, media_url)
          : undefined;

        if (media_url) {
          const normalizedUrl = media_url.split('?')[0].split('#')[0];
          const filename = path.basename(normalizedUrl || "attachment");
          mediaMetadata = { url: media_url, filename };
        }

        const providerResp = await provider.send(recipientPhone, body ?? undefined, providerMediaUrl);
        providerMessageId = providerResp.id || null;
      } catch (providerError: any) {
        console.warn("Failed to send via provider, saving locally:", providerError.message);
        status = "failed";
      }

      const message = await storage.createMessage({
        conversationId: conversation.id,
        direction: "outbound",
        body: body || null,
        media: mediaMetadata,
        providerMessageId,
        status,
        replyToMessageId: replyToMessageId ?? null,
        sentByUserId: req.user?.id ?? null,
      } as any);

      await storage.updateConversationLastAt(conversation.id);

      const messageWithReply = await storage.getMessageWithReplyById(message.id);

      res.json({ ok: true, message: messageWithReply ?? message });

      broadcastMessage("message_outgoing", messageWithReply ?? message);

      console.info(
        "message_sent_reply",
        JSON.stringify({
          messageId: message.id,
          conversationId: conversation.id,
          replyToMessageId: replyToMessageId ?? null,
          validReply: Boolean(replyTarget),
        }),
      );
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/messages/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteMessage(id);

      if (!deleted) {
        return res.status(404).json({ error: "Message not found" });
      }

      broadcastMessage("message_deleted", {
        id: deleted.id,
        conversationId: deleted.conversationId,
      });

      res.json({
        ok: true,
        messageId: deleted.id,
        conversationId: deleted.conversationId,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Meta webhook verification (GET request)
  const handleMetaWebhookVerification = async (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const verifyToken = req.query["hub.verify_token"];

    const isVerificationAttempt =
      typeof mode === "string" &&
      mode.toLowerCase() === "subscribe" &&
      typeof challenge === "string";

    if (!isVerificationAttempt) {
      return res
        .status(200)
        .send(
          "Meta webhook endpoint is online. To verify, Meta will call this URL with hub.mode=subscribe, hub.verify_token, and hub.challenge query parameters."
        );
    }

    try {
      const { provider, instance } = await createMetaProvider();
      const expectedToken =
        instance?.webhookVerifyToken ??
        process.env.META_VERIFY_TOKEN ??
        "";

      if (!expectedToken) {
        console.warn("Webhook verification attempted but no verify token is configured.");
        await storage.logWebhookEvent({
          headers: req.headers,
          query: req.query,
          body: null,
          response: { status: 500, body: "Missing verify token configuration" },
        });
        return res
          .status(500)
          .send(
            "Verify token is not configured. Set META_VERIFY_TOKEN or update the Default WhatsApp Instance."
          );
      }

      if (verifyToken !== expectedToken) {
        console.warn(
          `Webhook verification failed: provided token "${verifyToken}" does not match configured token.`
        );
        await storage.logWebhookEvent({
          headers: req.headers,
          query: req.query,
          body: null,
          response: { status: 403, body: "Forbidden" },
        });
        return res.status(403).send("Forbidden");
      }

      await storage.logWebhookEvent({
        headers: req.headers,
        query: req.query,
        body: null,
        response: { status: 200, body: String(challenge) },
      });
      res.status(200).send(challenge);
    } catch (error: any) {
      console.error("Webhook verification error:", error);
      await storage.logWebhookEvent({
        headers: req.headers,
        query: req.query,
        body: null,
        response: { status: 500, body: error.message },
      });
      res.status(500).send("Error");
    }
  };


  // Meta webhook for incoming messages (POST request)
  const handleMetaWebhookEvent = async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    console.log(`🚀 Webhook POST received`);
    console.log(`📊 Request headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📊 Request body:`, JSON.stringify(req.body, null, 2));
    
    try {
      const { provider, instance } = await createMetaProvider();
      
      // Verify webhook signature if app secret is configured
      const hasAppSecret = !!(instance?.appSecret || process.env.META_APP_SECRET);
      if (hasAppSecret) {
        console.log(`🔐 Verifying webhook signature...`);
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);
        const signatureValid = (provider as any).verifyWebhookSignature(req, rawBody);
        
        if (!signatureValid) {
          console.error(`❌ Invalid webhook signature`);
          await storage.logWebhookEvent({
            headers: req.headers,
            query: req.query,
            body: req.body,
            response: { status: 401, body: 'Invalid signature' },
          });
          return res.status(401).send("Invalid signature");
        }
        console.log(`✅ Webhook signature verified`);
      } else {
        console.log(`⚠️ No app secret configured, skipping signature verification`);
      }

      console.log(`🔄 Parsing incoming events...`);
      const events = provider.parseIncoming(req.body);
      console.log(`📨 Parsed ${events.length} events`);

      if (events.length === 0) {
        console.warn(`⚠️ No events parsed from payload`);
        await storage.logWebhookEvent({
          headers: req.headers,
          query: req.query,
          body: req.body,
          response: { status: 200, body: 'ok - no events' },
        });
        return res.status(200).send("ok - no events");
      }

      for (const event of events) {
        console.log(`💬 Processing event from: ${event.from}`);
        
        let conversation = await storage.getConversationByPhone(event.from);
        if (!conversation) {
          console.log(`🆕 Creating new conversation for: ${event.from}`);
          conversation = await storage.createConversation({ 
            phone: event.from,
          });
        } else {
          console.log(`📞 Using existing conversation: ${conversation.id}`);
        }

        console.log(`💾 Saving message to database...`);
        const message = await storage.createMessage({
          conversationId: conversation.id,
          direction: "inbound",
          body: event.body || null,
          media: event.media || null,
          status: "received",
          raw: event.raw,
          replyToMessageId: null,
        } as any);

        console.log(`✅ Message saved with ID: ${message.id}`);

        // persist webhook event
        await storage.logWebhookEvent({
          headers: req.headers,
          query: req.query,
          body: event.raw || event,
          response: { status: 200, body: 'ok' },
        });

        await storage.updateConversationLastAt(conversation.id);
        console.log(`🔄 Updated conversation last_at timestamp`);

        console.log(`📡 Broadcasting message to WebSocket clients...`);
        broadcastMessage("message_incoming", message);
        console.log(`✅ Message broadcasted`);
      }

      const duration = Date.now() - startTime;
      console.log(`🎉 Webhook processing completed in ${duration}ms`);
      res.status(200).send("ok");
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ Webhook error after ${duration}ms:`, error);
      console.error(`❌ Error stack:`, error.stack);
      
      await storage.logWebhookEvent({
        headers: req.headers,
        query: req.query,
        body: req.body,
        response: { 
          status: 500, 
          body: error.message,
          error: error.stack 
        },
      });
      
      res.status(500).json({ error: error.message });
    }
  };

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!pathsMatchMetaWebhook(req.path)) {
      return next();
    }

    if (req.method === "GET") {
      return handleMetaWebhookVerification(req, res);
    }

    if (req.method === "POST") {
      return handleMetaWebhookEvent(req, res);
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  });

  // Debug webhook endpoint - for testing and debugging webhook issues
  app.post("/webhook/debug", async (req: Request, res: Response) => {
    try {
      console.log(`🔍 Debug webhook called`);
      
      const debugInfo = await WebhookDebugger.debugWebhookFlow(
        'default',
        req.body,
        req.headers,
        req.query
      );
      
      res.json({
        success: true,
        debugInfo,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Debug webhook error:", error);
      res.status(500).json({ 
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Webhook status endpoint - check webhook configuration and recent events
  app.get("/api/webhook/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Get recent webhook events
      const recentEvents = await storage.getWebhookEvents(10);
      
      // Get webhook URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const webhookUrl = `${baseUrl}/webhook/meta`;
      
      const instance = await storage.getDefaultWhatsappInstance();
      const instanceResponse = toInstanceResponse(instance);
      const isConfigured = !!(instance?.accessToken && instance?.phoneNumberId);
      const hasWebhookSecret = !!instance?.appSecret;
      const hasVerifyToken = !!instance?.webhookVerifyToken;
      const isActive = instance?.isActive ?? true;
      const webhookBehavior = instance?.webhookBehavior ?? "auto";

      res.json({
        instance: instanceResponse
          ? {
              ...instanceResponse,
              webhookUrl,
            }
          : {
              id: "default",
              name: "Default WhatsApp Instance",
              isActive: false,
              webhookBehavior: "auto",
              hasAppSecret: false,
              hasVerifyToken: false,
              webhookUrl,
              accessTokenConfigured: false,
              webhookVerifyTokenConfigured: false,
              appSecretConfigured: false,
              source: "env",
              updatedAt: null,
              phoneNumberId: "",
            },
        recentEvents: recentEvents.map(event => ({
          id: event.id,
          createdAt: event.createdAt,
          headers: event.headers,
          query: event.query,
          body: event.body,
          response: event.response
        })),
        status: {
          isConfigured,
          hasWebhookSecret,
          hasVerifyToken,
          isActive,
          webhookBehavior
        }
      });
    } catch (error: any) {
      console.error("Webhook status error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test message endpoint - send a test message to verify the system works
  app.post("/api/test-message", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { to, body } = req.body;
      
      if (!to || !body) {
        return res.status(400).json({ error: "to and body are required" });
      }

      const { provider, instance } = await createMetaProvider();
      
      console.log(`🧪 Sending test message to ${to}`);
      const result = await provider.send(to, body);
      
      res.json({
        success: true,
        message: "Test message sent successfully",
        result,
        instance: instance
          ? {
              id: instance.id,
              name: instance.name,
              phoneNumberId: instance.phoneNumberId,
              source: instance.source,
            }
          : {
              id: "default",
              name: "Default WhatsApp Instance",
            },
      });
    } catch (error: any) {
      console.error("Test message error:", error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });

  // Test webhook endpoint - accepts simple payloads for local testing
  // Body shape: { from: string, body?: string, media?: any, instanceId?: string }
  app.post("/webhook/test", async (req: Request, res: Response) => {
    try {
      const apiControls = (await storage.getAppSetting('apiControls')) || { testWebhookEnabled: true };
      if (!apiControls.testWebhookEnabled) {
        return res.status(403).json({ error: 'Test webhooks are disabled' });
      }
      const { from, body: textBody, media } = req.body as any;

      if (!from) {
        return res.status(400).json({ error: "'from' (phone) is required" });
      }

      let conversation = await storage.getConversationByPhone(from);

      // If no conversation exists, create one
      if (!conversation) {
        conversation = await storage.createConversation({
          phone: from,
        });
      }

      const message = await storage.createMessage({
        conversationId: conversation.id,
        direction: "inbound",
        body: textBody || null,
        media: media || null,
        status: "received",
        raw: req.body,
        replyToMessageId: null,
      } as any);

      await storage.updateConversationLastAt(conversation.id);

      // persist the test webhook event
      await storage.logWebhookEvent({
        headers: req.headers as any,
        query: req.query as any,
        body: req.body,
        response: { status: 200, body: 'ok' },
      });

      broadcastMessage("message_incoming", message);

      res.json({ ok: true, message });
    } catch (error: any) {
      console.error("Test webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.debug('WebSocket client connected');
    wsClients.add(ws);

    ws.on('close', () => {
      console.debug('WebSocket client disconnected');
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    });
  });

  return httpServer;
}
