import type { IncomingMessage, ServerResponse } from "node:http";
import { clawdbotApiConfig } from "../../config/blackbox-env.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { sendMessageSignal } from "../../signal/send.js";
import { sendMessageTelegram } from "../../telegram/send.js";
import { sendMessageDiscord } from "../../discord/send.js";
import { sendMessageSlack } from "../../slack/send.js";
import { sendMessageIMessage } from "../../imessage/send.js";

const log = createSubsystemLogger("remote-code-webhook");

type WebhookPayload = {
  platform: string;
  platformUserId: string;
  message: string;
  metadata?: {
    taskId?: string;
    repo?: string;
    branch?: string;
    [key: string]: unknown;
  };
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error("Payload too large"));
        return;
      }
      data += chunk.toString("utf-8");
    });

    req.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function validateAuthentication(req: IncomingMessage): boolean {
  const apiKey = clawdbotApiConfig.apiKey;
  if (!apiKey) {
    log.warn("CLAWDBOT_API_KEY not configured - webhook authentication disabled");
    return false;
  }

  // Check multiple possible header formats
  const authHeader = req.headers.authorization;
  const customHeader = req.headers["x-clawdbot-api-key"] as string | undefined;

  // Support "Bearer <token>" format
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1] === apiKey) {
      return true;
    }
  }

  // Support custom header
  if (customHeader === apiKey) {
    return true;
  }

  return false;
}

function validatePayload(payload: unknown): payload is WebhookPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.platform !== "string" || !p.platform.trim()) {
    return false;
  }

  if (typeof p.platformUserId !== "string" || !p.platformUserId.trim()) {
    return false;
  }

  if (typeof p.message !== "string" || !p.message.trim()) {
    return false;
  }

  return true;
}

async function deliverMessage(payload: WebhookPayload): Promise<{ ok: boolean; error?: string }> {
  const { platform, platformUserId, message } = payload;
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  log.info(
    `[${requestId}] Delivering message via ${platform} to ${platformUserId.substring(0, 10)}...`,
  );

  try {
    switch (platform.toLowerCase()) {
      case "signal": {
        const result = await sendMessageSignal(platformUserId, message);
        log.info(`[${requestId}] Signal delivery successful, messageId: ${result.messageId}`);
        return { ok: true };
      }

      case "telegram": {
        const result = await sendMessageTelegram(platformUserId, message);
        log.info(`[${requestId}] Telegram delivery successful, messageId: ${result.messageId}`);
        return { ok: true };
      }

      case "discord": {
        const result = await sendMessageDiscord(platformUserId, message);
        log.info(`[${requestId}] Discord delivery successful`);
        return { ok: true };
      }

      case "slack": {
        const result = await sendMessageSlack(platformUserId, message);
        log.info(`[${requestId}] Slack delivery successful`);
        return { ok: true };
      }

      case "imessage": {
        const result = await sendMessageIMessage(platformUserId, message);
        log.info(`[${requestId}] iMessage delivery successful`);
        return { ok: true };
      }

      case "whatsapp": {
        // WhatsApp requires dynamic import
        const { sendMessageWhatsApp } = await import("../../web/outbound.js");
        const result = await sendMessageWhatsApp(platformUserId, message, { verbose: false });
        log.info(`[${requestId}] WhatsApp delivery successful, messageId: ${result.messageId}`);
        return { ok: true };
      }

      default:
        log.error(`[${requestId}] Unsupported platform: ${platform}`);
        return {
          ok: false,
          error: `Unsupported platform: ${platform}. Supported: signal, telegram, discord, slack, imessage, whatsapp`,
        };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error(`[${requestId}] Delivery error: ${errorMsg}`);
    return { ok: false, error: `Delivery failed: ${errorMsg}` };
  }
}

export async function handleRemoteCodeWebhook(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  log.info(`[${requestId}] ========== WEBHOOK REQUEST START ==========`);
  log.info(`[${requestId}] Remote address: ${req.socket.remoteAddress}`);
  log.info(`[${requestId}] Method: ${req.method}`);
  log.info(`[${requestId}] URL: ${req.url}`);
  log.info(`[${requestId}] Headers: ${JSON.stringify(req.headers, null, 2)}`);

  // Validate HTTP method
  if (req.method !== "POST") {
    log.warn(`[${requestId}] ❌ Invalid method: ${req.method} (expected POST)`);
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { ok: false, error: "Method not allowed. Use POST." });
    log.info(`[${requestId}] ========== WEBHOOK REQUEST END (405) ==========`);
    return;
  }

  // Debug authentication headers
  const authHeader = req.headers.authorization;
  const customHeader = req.headers["x-clawdbot-api-key"];
  const configuredKey = clawdbotApiConfig.apiKey;

  log.info(`[${requestId}] Auth header present: ${!!authHeader}`);
  log.info(`[${requestId}] Custom header present: ${!!customHeader}`);
  log.info(`[${requestId}] CLAWDBOT_API_KEY configured: ${!!configuredKey}`);
  log.info(`[${requestId}] Expected API key: ${configuredKey}`);

  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      log.info(`[${requestId}] Received Bearer token: ${match[1]}`);
      log.info(`[${requestId}] Token matches: ${match[1] === configuredKey}`);
    }
  }

  if (customHeader) {
    log.info(`[${requestId}] Received X-Clawdbot-API-Key: ${customHeader}`);
    log.info(`[${requestId}] Key matches: ${customHeader === configuredKey}`);
  }

  // Validate authentication
  if (!validateAuthentication(req)) {
    log.warn(`[${requestId}] ❌ Authentication failed`);
    log.warn(`[${requestId}] Expected API key: ${configuredKey}`);
    sendJson(res, 401, {
      ok: false,
      error:
        "Unauthorized. Provide valid CLAWDBOT_API_KEY via Authorization: Bearer <key> or X-Clawdbot-API-Key header.",
    });
    log.info(`[${requestId}] ========== WEBHOOK REQUEST END (401) ==========`);
    return;
  }

  log.info(`[${requestId}] ✅ Authentication successful`);

  // Read and parse body
  let payload: unknown;
  try {
    log.info(`[${requestId}] Reading request body...`);
    payload = await readJsonBody(req);
    log.info(`[${requestId}] Raw payload: ${JSON.stringify(payload, null, 2)}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.warn(`[${requestId}] ❌ Failed to read body: ${errorMsg}`);
    sendJson(res, 400, { ok: false, error: `Invalid request body: ${errorMsg}` });
    log.info(`[${requestId}] ========== WEBHOOK REQUEST END (400) ==========`);
    return;
  }

  // Validate payload structure
  if (!validatePayload(payload)) {
    log.warn(`[${requestId}] ❌ Invalid payload structure`);
    log.warn(`[${requestId}] Payload received: ${JSON.stringify(payload)}`);
    sendJson(res, 400, {
      ok: false,
      error:
        "Invalid payload. Required fields: platform (string), platformUserId (string), message (string)",
    });
    log.info(`[${requestId}] ========== WEBHOOK REQUEST END (400) ==========`);
    return;
  }

  log.info(`[${requestId}] ✅ Payload validation successful`);
  log.info(`[${requestId}] Platform: ${payload.platform}`);
  log.info(`[${requestId}] User ID: ${payload.platformUserId.substring(0, 10)}...`);
  log.info(`[${requestId}] Message length: ${payload.message.length} characters`);
  if (payload.metadata) {
    log.info(`[${requestId}] Metadata: ${JSON.stringify(payload.metadata)}`);
  }

  // Deliver message
  log.info(`[${requestId}] Starting message delivery...`);
  const result = await deliverMessage(payload);

  if (result.ok) {
    log.info(`[${requestId}] ✅ Message delivered successfully`);
    sendJson(res, 200, {
      ok: true,
      message: "Message delivered successfully",
      requestId,
    });
    log.info(`[${requestId}] ========== WEBHOOK REQUEST END (200) ==========`);
  } else {
    log.error(`[${requestId}] ❌ Message delivery failed: ${result.error}`);
    sendJson(res, 500, {
      ok: false,
      error: result.error || "Delivery failed",
      requestId,
    });
    log.info(`[${requestId}] ========== WEBHOOK REQUEST END (500) ==========`);
  }
}
