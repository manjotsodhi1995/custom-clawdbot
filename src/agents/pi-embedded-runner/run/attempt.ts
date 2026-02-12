import fs from "node:fs/promises";
import os from "node:os";

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Api, AssistantMessage, ImageContent, Model } from "@mariozechner/pi-ai";
import { streamSimple, completeSimple } from "@mariozechner/pi-ai";
import { createAgentSession, SessionManager, SettingsManager } from "@mariozechner/pi-coding-agent";

import { clawdbotApiConfig, remoteCodeConfig } from "../../../config/blackbox-env.js";
import { resolveHeartbeatPrompt } from "../../../auto-reply/heartbeat.js";
import {
  listChannelSupportedActions,
  resolveChannelMessageToolHints,
} from "../../channel-tools.js";
import { resolveChannelCapabilities } from "../../../config/channel-capabilities.js";
import { getMachineDisplayName } from "../../../infra/machine-name.js";
import { resolveTelegramInlineButtonsScope } from "../../../telegram/inline-buttons.js";
import { resolveTelegramReactionLevel } from "../../../telegram/reaction-level.js";
import { resolveSignalReactionLevel } from "../../../signal/reaction-level.js";
import { normalizeMessageChannel } from "../../../utils/message-channel.js";
import { isReasoningTagProvider } from "../../../utils/provider-utils.js";
import { isSubagentSessionKey } from "../../../routing/session-key.js";
import { resolveUserPath } from "../../../utils.js";
import { createCacheTrace } from "../../cache-trace.js";
import { createAnthropicPayloadLogger } from "../../anthropic-payload-log.js";
import { resolveClawdbotAgentDir } from "../../agent-paths.js";
import { resolveSessionAgentIds } from "../../agent-scope.js";
import { makeBootstrapWarn, resolveBootstrapContextForRun } from "../../bootstrap-files.js";
import { resolveClawdbotDocsPath } from "../../docs-path.js";
import { resolveModelAuthMode } from "../../model-auth.js";
import {
  isCloudCodeAssistFormatError,
  resolveBootstrapMaxChars,
  validateAnthropicTurns,
  validateGeminiTurns,
} from "../../pi-embedded-helpers.js";
import { subscribeEmbeddedPiSession } from "../../pi-embedded-subscribe.js";
import {
  ensurePiCompactionReserveTokens,
  resolveCompactionReserveTokensFloor,
} from "../../pi-settings.js";
import { createClawdbotCodingTools } from "../../pi-tools.js";
import { resolveSandboxContext } from "../../sandbox.js";
import { guardSessionManager } from "../../session-tool-result-guard-wrapper.js";
import { resolveTranscriptPolicy } from "../../transcript-policy.js";
import { acquireSessionWriteLock } from "../../session-write-lock.js";
import {
  applySkillEnvOverrides,
  applySkillEnvOverridesFromSnapshot,
  loadWorkspaceSkillEntries,
  resolveSkillsPromptForRun,
} from "../../skills.js";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../../workspace.js";
import { buildSystemPromptReport } from "../../system-prompt-report.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../../defaults.js";
import { resolveDefaultModelForAgent, resolveConfiguredModelRef } from "../../model-selection.js";
import { resolveFallbackCandidates } from "../../model-fallback.js";

import { isAbortError } from "../abort.js";
import { buildEmbeddedExtensionPaths } from "../extensions.js";
import { applyExtraParamsToAgent } from "../extra-params.js";
import { resolveModel } from "../model.js";
import { appendCacheTtlTimestamp, isCacheTtlEligibleProvider } from "../cache-ttl.js";
import {
  logToolSchemasForGoogle,
  sanitizeSessionHistory,
  sanitizeToolsForGoogle,
} from "../google.js";
import { getDmHistoryLimitFromSessionKey, limitHistoryTurns } from "../history.js";
import { log } from "../logger.js";
import { buildModelAliasLines } from "../model.js";
import {
  clearActiveEmbeddedRun,
  type EmbeddedPiQueueHandle,
  setActiveEmbeddedRun,
} from "../runs.js";
import { buildEmbeddedSandboxInfo } from "../sandbox-info.js";
import { prewarmSessionFile, trackSessionManagerAccess } from "../session-manager-cache.js";
import { prepareSessionManagerForRun } from "../session-manager-init.js";
import { buildEmbeddedSystemPrompt, createSystemPromptOverride } from "../system-prompt.js";
import { splitSdkTools } from "../tool-split.js";
import { toClientToolDefinitions } from "../../pi-tool-definition-adapter.js";
import { buildSystemPromptParams } from "../../system-prompt-params.js";
import { describeUnknownError, mapThinkingLevel } from "../utils.js";
import { resolveSandboxRuntimeStatus } from "../../sandbox/runtime-status.js";
import { buildTtsSystemPromptHint } from "../../../tts/tts.js";
import { isTimeoutError } from "../../failover-error.js";
import { getGlobalHookRunner } from "../../../plugins/hook-runner-global.js";
import { MAX_IMAGE_BYTES } from "../../../media/constants.js";
import type { EmbeddedRunAttemptParams, EmbeddedRunAttemptResult } from "./types.js";
import { detectAndLoadPromptImages } from "./images.js";

export function injectHistoryImagesIntoMessages(
  messages: AgentMessage[],
  historyImagesByIndex: Map<number, ImageContent[]>,
): boolean {
  if (historyImagesByIndex.size === 0) return false;
  let didMutate = false;

  for (const [msgIndex, images] of historyImagesByIndex) {
    // Bounds check: ensure index is valid before accessing
    if (msgIndex < 0 || msgIndex >= messages.length) continue;
    const msg = messages[msgIndex];
    if (msg && msg.role === "user") {
      // Convert string content to array format if needed
      if (typeof msg.content === "string") {
        msg.content = [{ type: "text", text: msg.content }];
        didMutate = true;
      }
      if (Array.isArray(msg.content)) {
        // Check for existing image content to avoid duplicates across turns
        const existingImageData = new Set(
          msg.content
            .filter(
              (c): c is ImageContent =>
                c != null &&
                typeof c === "object" &&
                c.type === "image" &&
                typeof c.data === "string",
            )
            .map((c) => c.data),
        );
        for (const img of images) {
          // Only add if this image isn't already in the message
          if (!existingImageData.has(img.data)) {
            msg.content.push(img);
            didMutate = true;
          }
        }
      }
    }
  }

  return didMutate;
}

export async function runEmbeddedAttempt(
  params: EmbeddedRunAttemptParams,
): Promise<EmbeddedRunAttemptResult> {
  const resolvedWorkspace = resolveUserPath(params.workspaceDir);
  const prevCwd = process.cwd();
  const runAbortController = new AbortController();

  log.debug(
    `embedded run start: runId=${params.runId} sessionId=${params.sessionId} provider=${params.provider} model=${params.modelId} thinking=${params.thinkLevel} messageChannel=${params.messageChannel ?? params.messageProvider ?? "unknown"}`,
  );

  await fs.mkdir(resolvedWorkspace, { recursive: true });

  const sandboxSessionKey = params.sessionKey?.trim() || params.sessionId;
  const sandbox = await resolveSandboxContext({
    config: params.config,
    sessionKey: sandboxSessionKey,
    workspaceDir: resolvedWorkspace,
  });
  const effectiveWorkspace = sandbox?.enabled
    ? sandbox.workspaceAccess === "rw"
      ? resolvedWorkspace
      : sandbox.workspaceDir
    : resolvedWorkspace;
  await fs.mkdir(effectiveWorkspace, { recursive: true });

  let restoreSkillEnv: (() => void) | undefined;
  process.chdir(effectiveWorkspace);
  try {
    const shouldLoadSkillEntries = !params.skillsSnapshot || !params.skillsSnapshot.resolvedSkills;
    const skillEntries = shouldLoadSkillEntries
      ? loadWorkspaceSkillEntries(effectiveWorkspace)
      : [];
    restoreSkillEnv = params.skillsSnapshot
      ? applySkillEnvOverridesFromSnapshot({
          snapshot: params.skillsSnapshot,
          config: params.config,
        })
      : applySkillEnvOverrides({
          skills: skillEntries ?? [],
          config: params.config,
        });

    const skillsPrompt = resolveSkillsPromptForRun({
      skillsSnapshot: params.skillsSnapshot,
      entries: shouldLoadSkillEntries ? skillEntries : undefined,
      config: params.config,
      workspaceDir: effectiveWorkspace,
    });

    const sessionLabel = params.sessionKey ?? params.sessionId;
    const { bootstrapFiles: hookAdjustedBootstrapFiles, contextFiles } =
      await resolveBootstrapContextForRun({
        workspaceDir: effectiveWorkspace,
        config: params.config,
        sessionKey: params.sessionKey,
        sessionId: params.sessionId,
        warn: makeBootstrapWarn({ sessionLabel, warn: (message) => log.warn(message) }),
      });
    const workspaceNotes = hookAdjustedBootstrapFiles.some(
      (file) => file.name === DEFAULT_BOOTSTRAP_FILENAME && !file.missing,
    )
      ? ["Reminder: commit your changes in this workspace after edits."]
      : undefined;

    const agentDir = params.agentDir ?? resolveClawdbotAgentDir();

    // Check if the model supports native image input
    const modelHasVision = params.model.input?.includes("image") ?? false;
    const toolsRaw = params.disableTools
      ? []
      : createClawdbotCodingTools({
          exec: {
            ...params.execOverrides,
            elevated: params.bashElevated,
          },
          sandbox,
          messageProvider: params.messageChannel ?? params.messageProvider,
          agentAccountId: params.agentAccountId,
          messageTo: params.messageTo,
          messageThreadId: params.messageThreadId,
          groupId: params.groupId,
          groupChannel: params.groupChannel,
          groupSpace: params.groupSpace,
          spawnedBy: params.spawnedBy,
          senderId: params.senderId,
          senderName: params.senderName,
          senderUsername: params.senderUsername,
          senderE164: params.senderE164,
          sessionKey: params.sessionKey ?? params.sessionId,
          agentDir,
          workspaceDir: effectiveWorkspace,
          config: params.config,
          abortSignal: runAbortController.signal,
          modelProvider: params.model.provider,
          modelId: params.modelId,
          modelAuthMode: resolveModelAuthMode(params.model.provider, params.config),
          currentChannelId: params.currentChannelId,
          currentThreadTs: params.currentThreadTs,
          replyToMode: params.replyToMode,
          hasRepliedRef: params.hasRepliedRef,
          modelHasVision,
        });
    const tools = sanitizeToolsForGoogle({ tools: toolsRaw, provider: params.provider });
    logToolSchemasForGoogle({ tools, provider: params.provider });

    const machineName = await getMachineDisplayName();
    const runtimeChannel = normalizeMessageChannel(params.messageChannel ?? params.messageProvider);
    let runtimeCapabilities = runtimeChannel
      ? (resolveChannelCapabilities({
          cfg: params.config,
          channel: runtimeChannel,
          accountId: params.agentAccountId,
        }) ?? [])
      : undefined;
    if (runtimeChannel === "telegram" && params.config) {
      const inlineButtonsScope = resolveTelegramInlineButtonsScope({
        cfg: params.config,
        accountId: params.agentAccountId ?? undefined,
      });
      if (inlineButtonsScope !== "off") {
        if (!runtimeCapabilities) runtimeCapabilities = [];
        if (
          !runtimeCapabilities.some((cap) => String(cap).trim().toLowerCase() === "inlinebuttons")
        ) {
          runtimeCapabilities.push("inlineButtons");
        }
      }
    }
    const reactionGuidance =
      runtimeChannel && params.config
        ? (() => {
            if (runtimeChannel === "telegram") {
              const resolved = resolveTelegramReactionLevel({
                cfg: params.config,
                accountId: params.agentAccountId ?? undefined,
              });
              const level = resolved.agentReactionGuidance;
              return level ? { level, channel: "Telegram" } : undefined;
            }
            if (runtimeChannel === "signal") {
              const resolved = resolveSignalReactionLevel({
                cfg: params.config,
                accountId: params.agentAccountId ?? undefined,
              });
              const level = resolved.agentReactionGuidance;
              return level ? { level, channel: "Signal" } : undefined;
            }
            return undefined;
          })()
        : undefined;
    const { defaultAgentId, sessionAgentId } = resolveSessionAgentIds({
      sessionKey: params.sessionKey,
      config: params.config,
    });
    const sandboxInfo = buildEmbeddedSandboxInfo(sandbox, params.bashElevated);
    const reasoningTagHint = isReasoningTagProvider(params.provider);
    // Resolve channel-specific message actions for system prompt
    const channelActions = runtimeChannel
      ? listChannelSupportedActions({
          cfg: params.config,
          channel: runtimeChannel,
        })
      : undefined;
    const messageToolHints = runtimeChannel
      ? resolveChannelMessageToolHints({
          cfg: params.config,
          channel: runtimeChannel,
          accountId: params.agentAccountId,
        })
      : undefined;

    const defaultModelRef = resolveDefaultModelForAgent({
      cfg: params.config ?? {},
      agentId: sessionAgentId,
    });
    const defaultModelLabel = `${defaultModelRef.provider}/${defaultModelRef.model}`;
    const { runtimeInfo, userTimezone, userTime, userTimeFormat } = buildSystemPromptParams({
      config: params.config,
      agentId: sessionAgentId,
      workspaceDir: effectiveWorkspace,
      cwd: process.cwd(),
      runtime: {
        host: machineName,
        os: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        node: process.version,
        model: `${params.provider}/${params.modelId}`,
        defaultModel: defaultModelLabel,
        channel: runtimeChannel,
        capabilities: runtimeCapabilities,
        channelActions,
      },
    });
    const isDefaultAgent = sessionAgentId === defaultAgentId;
    const promptMode = isSubagentSessionKey(params.sessionKey) ? "minimal" : "full";
    const docsPath = await resolveClawdbotDocsPath({
      workspaceDir: effectiveWorkspace,
      argv1: process.argv[1],
      cwd: process.cwd(),
      moduleUrl: import.meta.url,
    });
    const ttsHint = params.config ? buildTtsSystemPromptHint(params.config) : undefined;

    const appendPrompt = buildEmbeddedSystemPrompt({
      workspaceDir: effectiveWorkspace,
      defaultThinkLevel: params.thinkLevel,
      reasoningLevel: params.reasoningLevel ?? "off",
      extraSystemPrompt: params.extraSystemPrompt,
      ownerNumbers: params.ownerNumbers,
      reasoningTagHint,
      heartbeatPrompt: isDefaultAgent
        ? resolveHeartbeatPrompt(params.config?.agents?.defaults?.heartbeat?.prompt)
        : undefined,
      skillsPrompt,
      docsPath: docsPath ?? undefined,
      ttsHint,
      workspaceNotes,
      reactionGuidance,
      promptMode,
      runtimeInfo,
      messageToolHints,
      sandboxInfo,
      tools,
      modelAliasLines: buildModelAliasLines(params.config),
      userTimezone,
      userTime,
      userTimeFormat,
      contextFiles,
    });
    const systemPromptReport = buildSystemPromptReport({
      source: "run",
      generatedAt: Date.now(),
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      provider: params.provider,
      model: params.modelId,
      workspaceDir: effectiveWorkspace,
      bootstrapMaxChars: resolveBootstrapMaxChars(params.config),
      sandbox: (() => {
        const runtime = resolveSandboxRuntimeStatus({
          cfg: params.config,
          sessionKey: params.sessionKey ?? params.sessionId,
        });
        return { mode: runtime.mode, sandboxed: runtime.sandboxed };
      })(),
      systemPrompt: appendPrompt,
      bootstrapFiles: hookAdjustedBootstrapFiles,
      injectedFiles: contextFiles,
      skillsPrompt,
      tools,
    });
    const systemPrompt = createSystemPromptOverride(appendPrompt);

    const sessionLock = await acquireSessionWriteLock({
      sessionFile: params.sessionFile,
    });

    let sessionManager: ReturnType<typeof guardSessionManager> | undefined;
    let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
    try {
      const hadSessionFile = await fs
        .stat(params.sessionFile)
        .then(() => true)
        .catch(() => false);

      const transcriptPolicy = resolveTranscriptPolicy({
        modelApi: params.model?.api,
        provider: params.provider,
        modelId: params.modelId,
      });

      await prewarmSessionFile(params.sessionFile);
      sessionManager = guardSessionManager(SessionManager.open(params.sessionFile), {
        agentId: sessionAgentId,
        sessionKey: params.sessionKey,
        allowSyntheticToolResults: transcriptPolicy.allowSyntheticToolResults,
      });
      trackSessionManagerAccess(params.sessionFile);

      await prepareSessionManagerForRun({
        sessionManager,
        sessionFile: params.sessionFile,
        hadSessionFile,
        sessionId: params.sessionId,
        cwd: effectiveWorkspace,
      });

      const settingsManager = SettingsManager.create(effectiveWorkspace, agentDir);
      ensurePiCompactionReserveTokens({
        settingsManager,
        minReserveTokens: resolveCompactionReserveTokensFloor(params.config),
      });

      const additionalExtensionPaths = buildEmbeddedExtensionPaths({
        cfg: params.config,
        sessionManager,
        provider: params.provider,
        modelId: params.modelId,
        model: params.model,
      });

      const { builtInTools, customTools } = splitSdkTools({
        tools,
        sandboxEnabled: !!sandbox?.enabled,
      });

      // Add client tools (OpenResponses hosted tools) to customTools
      let clientToolCallDetected: { name: string; params: Record<string, unknown> } | null = null;
      const clientToolDefs = params.clientTools
        ? toClientToolDefinitions(params.clientTools, (toolName, toolParams) => {
            clientToolCallDetected = { name: toolName, params: toolParams };
          })
        : [];

      const allCustomTools = [...customTools, ...clientToolDefs];

      ({ session } = await createAgentSession({
        cwd: resolvedWorkspace,
        agentDir,
        authStorage: params.authStorage,
        modelRegistry: params.modelRegistry,
        model: params.model,
        thinkingLevel: mapThinkingLevel(params.thinkLevel),
        systemPrompt,
        tools: builtInTools,
        customTools: allCustomTools,
        sessionManager,
        settingsManager,
        skills: [],
        contextFiles: [],
        additionalExtensionPaths,
      }));
      if (!session) {
        throw new Error("Embedded agent session missing");
      }
      const activeSession = session;
      const cacheTrace = createCacheTrace({
        cfg: params.config,
        env: process.env,
        runId: params.runId,
        sessionId: activeSession.sessionId,
        sessionKey: params.sessionKey,
        provider: params.provider,
        modelId: params.modelId,
        modelApi: params.model.api,
        workspaceDir: params.workspaceDir,
      });
      const anthropicPayloadLogger = createAnthropicPayloadLogger({
        env: process.env,
        runId: params.runId,
        sessionId: activeSession.sessionId,
        sessionKey: params.sessionKey,
        provider: params.provider,
        modelId: params.modelId,
        modelApi: params.model.api,
        workspaceDir: params.workspaceDir,
      });

      // Force a stable streamFn reference so vitest can reliably mock @mariozechner/pi-ai.
      activeSession.agent.streamFn = streamSimple;

      // Special handling for blackbox-remote-code: automatically forward messages to remote-code webhook
      // blackbox-remote-code intercepts LLM calls and forwards them directly to remote-code API
      if (params.provider === "blackbox-remote-code") {
        console.log(`[blackbox-remote-code] ========== Webhook Configuration ==========`);
        console.log(
          `[blackbox-remote-code] Channel:`,
          params.messageChannel ?? params.messageProvider ?? "unknown",
        );

        // Log all sender-related params to find phone number
        console.log(`[blackbox-remote-code] Sender params:`, params);
        console.log(`[blackbox-remote-code]   senderE164:`, params.senderE164 ?? "undefined");
        console.log(`[blackbox-remote-code]   senderId:`, params.senderId ?? "undefined");
        console.log(`[blackbox-remote-code]   senderName:`, params.senderName ?? "undefined");
        console.log(
          `[blackbox-remote-code]   senderUsername:`,
          params.senderUsername ?? "undefined",
        );
        console.log(`[blackbox-remote-code]   messageTo:`, params.messageTo ?? "undefined");

        console.log(`[blackbox-remote-code] Prompt preview:`, params.prompt?.substring(0, 200));
        log.debug(
          `blackbox-remote-code provider: messages will be forwarded to remote-code webhook`,
        );

        const originalStreamFn = activeSession.agent.streamFn;
        const REMOTE_CODE_BASE_URL =
          remoteCodeConfig.apiUrl || "https://markita-unenjoyable-lucinda.ngrok-free.dev";
        const CLAWDBOT_API_KEY = clawdbotApiConfig.apiKey || "1234567890";
        const senderE164 = params.senderE164;

        // Try to extract phone from the prompt (WhatsApp format includes it)
        const promptPhoneMatch = params.prompt?.match(/\[WhatsApp\s+(\+\d+)/);
        console.log(
          `[blackbox-remote-code] WhatsApp phone:`,
          promptPhoneMatch ? promptPhoneMatch[1] : "not found",
        );

        // Signal: try UUID and also search for any phone number
        const signalUuidMatch = params.prompt?.match(/\[Signal\s+.*?id:uuid:([a-f0-9-]+)/i);
        console.log(
          `[blackbox-remote-code] Signal UUID:`,
          signalUuidMatch ? signalUuidMatch[1] : "not found",
        );

        // Try to find phone in Signal message (might be in sender name or elsewhere)
        const signalPhoneMatch = params.prompt?.match(/\[Signal\s+[^+]*(\+\d{10,15})/);
        console.log(
          `[blackbox-remote-code] Signal phone search:`,
          signalPhoneMatch ? signalPhoneMatch[1] : "not found",
        );

        // Telegram: extract name, username, and user ID from format [Telegram name (@username) id:userid ...]
        const telegramMatch = params.prompt?.match(
          /\[Telegram\s+([^(@]+)\s*(?:\(@([^\)]+)\))?\s*id:(\d+)/,
        );
        const telegramName = telegramMatch ? telegramMatch[1].trim() : null;
        const telegramUsername = telegramMatch ? telegramMatch[2] : null;
        const telegramUserId = telegramMatch ? telegramMatch[3] : null;

        console.log(`[blackbox-remote-code] Telegram name:`, telegramName || "not found");
        console.log(
          `[blackbox-remote-code] Telegram username:`,
          telegramUsername ? `@${telegramUsername}` : "not found",
        );
        console.log(`[blackbox-remote-code] Telegram user ID:`, telegramUserId || "not found");

        // Slack: extract channel and message from format [Slack name +time timestamp] message [slack message id: id channel: channelId]
        const slackMatch = params.prompt?.match(
          /\[Slack\s+[^\]]+\]\s*(.+?)(?:\n\[slack message id:|$)/s,
        );
        const slackChannelMatch = params.prompt?.match(
          /\[slack message id:\s*[^\s]+\s+channel:\s*([^\]]+)\]/,
        );
        console.log(
          `[blackbox-remote-code] Slack message:`,
          slackMatch ? slackMatch[1].substring(0, 50) : "not found",
        );
        console.log(
          `[blackbox-remote-code] Slack channel:`,
          slackChannelMatch ? slackChannelMatch[1] : "not found",
        );

        // Check if senderId contains a phone number
        const senderIdPhone = params.senderId?.match(/^\+\d{10,15}$/);
        console.log(
          `[blackbox-remote-code] SenderId phone:`,
          senderIdPhone ? params.senderId : "not a phone",
        );

        // Slack: try to get user email or phone from Slack API
        let slackUserEmail: string | null = null;
        let slackUserPhone: string | null = null;
        if (slackChannelMatch && params.messageChannel === "slack") {
          const channelId = slackChannelMatch[1].trim();
          const userId = params.senderId; // This should be the Slack user ID

          console.log(`[blackbox-remote-code] Attempting to fetch Slack user info:`, {
            channelId,
            userId,
            hasSenderId: !!userId,
          });

          // Try to get user info from Slack API if we have the user ID
          if (userId) {
            try {
              // Import Slack client utilities
              const { createSlackWebClient } = await import("../../../slack/client.js");

              // Get Slack token from config
              const slackConfig = params.config?.channels?.slack;
              const slackToken = slackConfig?.botToken || slackConfig?.userToken;

              if (slackToken) {
                const client = createSlackWebClient(slackToken);
                const userInfo = await client.users.info({ user: userId });

                if (userInfo.user?.profile) {
                  slackUserEmail = userInfo.user.profile.email?.trim()?.toLowerCase() || null;
                  slackUserPhone = userInfo.user.profile.phone?.trim() || null;

                  console.log(`[blackbox-remote-code] Slack user info retrieved:`, {
                    email: slackUserEmail ? slackUserEmail.substring(0, 5) + "***" : "not found",
                    phone: slackUserPhone ? slackUserPhone.substring(0, 4) + "***" : "not found",
                  });
                }
              } else {
                console.log(`[blackbox-remote-code] No Slack token available for user lookup`);
              }
            } catch (err) {
              console.log(`[blackbox-remote-code] Failed to fetch Slack user info:`, err);
            }
          }
        }

        // Priority: senderE164 > WhatsApp > Signal phone > senderId > Slack email > Slack phone > Slack channel > Telegram ID > Signal UUID
        const phoneNumber =
          senderE164 ||
          (promptPhoneMatch ? promptPhoneMatch[1] : null) ||
          (signalPhoneMatch ? signalPhoneMatch[1] : null) ||
          (senderIdPhone ? params.senderId : null) ||
          slackUserEmail ||
          slackUserPhone ||
          (slackChannelMatch ? `slack:${slackChannelMatch[1]}` : null) ||
          (telegramUserId ? `telegram:${telegramUserId}` : null) ||
          (signalUuidMatch ? signalUuidMatch[1] : null);

        console.log(`[blackbox-remote-code] Final identifier:`, {
          source: senderE164
            ? "senderE164"
            : promptPhoneMatch
              ? "WhatsApp"
              : signalPhoneMatch
                ? "Signal phone"
                : senderIdPhone
                  ? "senderId"
                  : slackUserEmail
                    ? "Slack email"
                    : slackUserPhone
                      ? "Slack phone"
                      : slackChannelMatch
                        ? "Slack channel"
                        : telegramUserId
                          ? "Telegram ID"
                          : signalUuidMatch
                            ? "Signal UUID"
                            : "none",
          value: phoneNumber,
          isUuid: signalUuidMatch && phoneNumber === signalUuidMatch[1],
          isTelegramId: telegramUserId && phoneNumber === `telegram:${telegramUserId}`,
          isSlackEmail: !!slackUserEmail && phoneNumber === slackUserEmail,
          isSlackPhone: !!slackUserPhone && phoneNumber === slackUserPhone,
          isSlackChannel: slackChannelMatch && phoneNumber === `slack:${slackChannelMatch[1]}`,
          telegramName: telegramName || undefined,
          telegramUsername: telegramUsername || undefined,
          telegramUserId: telegramUserId || undefined,
        });
        console.log(`[blackbox-remote-code] ==========================================`);

        activeSession.agent.streamFn = async (model, context, options) => {
          // Extract the user message - try multiple methods
          let messageText = "";

          // Method 1: Get from params.prompt directly (most reliable for WhatsApp, Signal, Telegram, and Slack)
          // WhatsApp Format: "System: [...]\n\n[WhatsApp +918770649309 +5m 2026-01-27 18:05 GMT+5:30] hey"
          // Signal Format: "System: [...]\n\n[Signal Adarsh Kumar id:uuid:acecd540-ba03-44a5-9a60-8a5b2e3caff5 +6m 2026-01-28 22:58 GMT+5:30] hi"
          // Telegram Format: "System: [...]\n\n[Telegram Adarsh Kumar (@Bgod69) id:6749434634 +4s 2026-01-29 03:17 GMT+5:30] hi"
          // Slack Format: "System: [...]\n\n[Slack Adarsh Kumar +8m 2026-01-29 07:24 GMT+5:30] Hi [slack message id: 1769651682.410289 channel: D0ACF4NUV96]"
          if (params.prompt) {
            // Try WhatsApp format first
            const whatsappMatch = params.prompt.match(
              /\[WhatsApp\s+\+\d+\s+[^\]]+\]\s*(.+?)(?:\n\[message_id:|$)/s,
            );
            if (whatsappMatch) {
              messageText = whatsappMatch[1].trim();
              console.log(
                `[blackbox-remote-code] Message extracted via WhatsApp format (Method 1):`,
                messageText.substring(0, 50),
              );
            } else {
              // Try Signal format - extract message and remove message_id if present
              const signalMatch = params.prompt.match(
                /\[Signal\s+[^\]]+\]\s*(.+?)(?:\n\[message_id:|$)/s,
              );
              if (signalMatch) {
                messageText = signalMatch[1].trim();
                console.log(
                  `[blackbox-remote-code] Message extracted via Signal format (Method 1):`,
                  messageText.substring(0, 50),
                );
              } else {
                // Try Telegram format - extract message and remove message_id if present
                const telegramMatch = params.prompt.match(
                  /\[Telegram\s+[^\]]+\]\s*(.+?)(?:\n\[message_id:|$)/s,
                );
                if (telegramMatch) {
                  messageText = telegramMatch[1].trim();
                  console.log(
                    `[blackbox-remote-code] Message extracted via Telegram format (Method 1):`,
                    messageText.substring(0, 50),
                  );
                } else {
                  // Try Slack format - extract message and remove slack message id if present
                  const slackMatch = params.prompt.match(
                    /\[Slack\s+[^\]]+\]\s*(.+?)(?:\n\[slack message id:|$)/s,
                  );
                  if (slackMatch) {
                    messageText = slackMatch[1].trim();
                    console.log(
                      `[blackbox-remote-code] Message extracted via Slack format (Method 1):`,
                      messageText.substring(0, 50),
                    );
                  } else {
                    console.log(
                      `[blackbox-remote-code] No WhatsApp/Signal/Telegram/Slack format match in prompt (Method 1)`,
                    );
                  }
                }
              }
            }
          }

          // Method 2: Try context messages if prompt extraction failed
          if (!messageText) {
            console.log(
              `[blackbox-remote-code] Attempting Method 2: extracting from context messages`,
            );
            const userMessages = context.messages?.filter((msg: any) => msg.role === "user") || [];
            console.log(
              `[blackbox-remote-code] Found ${userMessages.length} user messages in context`,
            );

            for (let i = userMessages.length - 1; i >= 0; i--) {
              const msg = userMessages[i];
              let text = "";
              if (typeof msg?.content === "string") {
                text = msg.content;
              } else if (Array.isArray(msg?.content)) {
                const textBlock = msg.content.find((c: any) => c.type === "text");
                if (textBlock && "text" in textBlock) {
                  text = textBlock.text;
                }
              }

              if (text) {
                // Try to extract from WhatsApp format - remove message_id if present
                const whatsappMatch = text.match(
                  /\[WhatsApp\s+\+\d+\s+[^\]]+\]\s*(.+?)(?:\n\[message_id:|$)/s,
                );
                if (whatsappMatch) {
                  messageText = whatsappMatch[1].trim();
                  console.log(
                    `[blackbox-remote-code] Message extracted via WhatsApp format (Method 2):`,
                    messageText.substring(0, 50),
                  );
                  break;
                }
                // Try to extract from Signal format - remove message_id if present
                const signalMatch = text.match(/\[Signal\s+[^\]]+\]\s*(.+?)(?:\n\[message_id:|$)/s);
                if (signalMatch) {
                  messageText = signalMatch[1].trim();
                  console.log(
                    `[blackbox-remote-code] Message extracted via Signal format (Method 2):`,
                    messageText.substring(0, 50),
                  );
                  break;
                }
                // Try to extract from Telegram format - remove message_id if present
                const telegramMatch = text.match(
                  /\[Telegram\s+[^\]]+\]\s*(.+?)(?:\n\[message_id:|$)/s,
                );
                if (telegramMatch) {
                  messageText = telegramMatch[1].trim();
                  console.log(
                    `[blackbox-remote-code] Message extracted via Telegram format (Method 2):`,
                    messageText.substring(0, 50),
                  );
                  break;
                }
                // Try to extract from Slack format - remove slack message id if present
                const slackMatch = text.match(
                  /\[Slack\s+[^\]]+\]\s*(.+?)(?:\n\[slack message id:|$)/s,
                );
                if (slackMatch) {
                  messageText = slackMatch[1].trim();
                  console.log(
                    `[blackbox-remote-code] Message extracted via Slack format (Method 2):`,
                    messageText.substring(0, 50),
                  );
                  break;
                }
                // If no WhatsApp/Signal/Telegram/Slack format, use the text directly (but skip system messages and message_id)
                if (
                  !text.startsWith("System:") &&
                  !text.includes("WhatsApp gateway connected") &&
                  !text.includes("Signal gateway connected") &&
                  !text.includes("Telegram gateway connected") &&
                  !text.includes("Slack gateway connected") &&
                  !text.includes("Slack DM from")
                ) {
                  // Remove message_id if present
                  const cleanText = text.replace(/\n\[message_id:.*?\]$/s, "").trim();
                  if (cleanText) {
                    messageText = cleanText;
                    console.log(
                      `[blackbox-remote-code] Message extracted via generic format (Method 2):`,
                      messageText.substring(0, 50),
                    );
                    break;
                  }
                }
              }
            }

            if (!messageText) {
              console.log(
                `[blackbox-remote-code] Method 2 failed: no message text extracted from context`,
              );
            }
          }

          console.log(`[blackbox-remote-code] Final extraction result:`, {
            hasPhoneNumber: !!phoneNumber,
            phoneNumberSource: senderE164
              ? "senderE164"
              : promptPhoneMatch
                ? "WhatsApp"
                : telegramUserId
                  ? "Telegram ID"
                  : signalUuidMatch
                    ? "Signal UUID"
                    : "none",
            messageTextLength: messageText?.length || 0,
            messageTextPreview: messageText?.substring(0, 100),
            extractionMethod: messageText
              ? params.prompt?.includes(messageText.substring(0, 20))
                ? "Method 1 (prompt)"
                : "Method 2 (context)"
              : "failed",
          });

          // Check if we only have UUID (no phone number) for Signal messages
          const isSignalMessage = signalUuidMatch && phoneNumber === signalUuidMatch[1];
          const isTelegramMessage = telegramUserId && phoneNumber === `telegram:${telegramUserId}`;
          const isSlackMessage =
            slackChannelMatch && phoneNumber === `slack:${slackChannelMatch[1]}`;
          const hasPhoneNumber = phoneNumber && !isSignalMessage;
          const hasEmailOrIdentifier =
            phoneNumber &&
            (slackUserEmail || slackUserPhone || isSlackMessage || isTelegramMessage);

          // Handle Signal UUID case - send privacy instructions
          if (messageText && isSignalMessage) {
            console.log(
              `[blackbox-remote-code] Signal UUID detected without phone number - sending privacy settings instructions`,
            );

            const instructionMessage = `To enable phone number-based features, please update your Signal privacy settings:

1. Open Signal app
2. Go to Settings → Privacy → Phone Number
3. Select "Who can see my number"
4. Choose "Everyone"

This will allow the system to identify you by phone number instead of UUID.

Your message was: "${messageText}"`;

            // Create instruction message
            const assistantMessage: AssistantMessage = {
              role: "assistant",
              content: [{ type: "text", text: instructionMessage }],
              stopReason: "stop",
              api: model.api,
              provider: model.provider,
              model: model.id,
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
              },
              timestamp: Date.now(),
            };

            const piAiModule = await import("@mariozechner/pi-ai");
            const stream = new (piAiModule as any).AssistantMessageEventStream();
            queueMicrotask(() => {
              stream.push({
                type: "done",
                reason: "stop",
                message: assistantMessage,
              });
              stream.end();
            });

            return stream;
          }

          // Handle Telegram, Slack, and phone number cases - proceed to webhook
          if (messageText && phoneNumber && (hasPhoneNumber || hasEmailOrIdentifier)) {
            if (isTelegramMessage) {
              console.log(
                `[blackbox-remote-code] Telegram ID detected - proceeding with webhook call`,
              );
            } else if (isSlackMessage) {
              console.log(
                `[blackbox-remote-code] Slack channel detected - proceeding with webhook call`,
              );
            } else if (slackUserEmail) {
              console.log(
                `[blackbox-remote-code] Slack email detected - proceeding with webhook call`,
              );
            } else if (slackUserPhone) {
              console.log(
                `[blackbox-remote-code] Slack phone detected - proceeding with webhook call`,
              );
            }
            // Determine platform from message channel
            const platform = params.messageChannel || params.messageProvider || "signal";

            // For Telegram, include name, username, and user ID in the payload
            const webhookPayload: any = {
              platform: platform,
              platformUserId: phoneNumber,
              message: messageText,
            };

            // Add Telegram-specific fields if this is a Telegram message
            if (isTelegramMessage && (telegramName || telegramUsername || telegramUserId)) {
              webhookPayload.telegram = {
                name: telegramName,
                username: telegramUsername,
                userId: telegramUserId,
              };
            }

            console.log(`[blackbox-remote-code] Auto-forwarding to webhook:`, {
              url: `${REMOTE_CODE_BASE_URL}/api/webhooks/messaging`,
              platform: platform,
              platformUserId: phoneNumber.substring(0, 4) + "***",
              messageLength: messageText.length,
              payload: webhookPayload,
            });

            try {
              // Call remote-code webhook directly
              const response = await fetch(`${REMOTE_CODE_BASE_URL}/api/webhooks/messaging`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Clawdbot-API-Key": CLAWDBOT_API_KEY,
                },
                body: JSON.stringify(webhookPayload),
              });

              if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                console.error(
                  `[blackbox-remote-code] Webhook failed:`,
                  response.status,
                  errorText.substring(0, 200),
                );
                throw new Error(
                  `Remote-code webhook error (${response.status}): ${errorText || response.statusText}`,
                );
              }

              const result = await response.json();
              const replyMessage = result.message || result.error || "Message processed";

              console.log(`[blackbox-remote-code] Webhook response:`, {
                success: result.success,
                messageLength: replyMessage.length,
              });

              // Create a message from the webhook response
              const assistantMessage: AssistantMessage = {
                role: "assistant",
                content: [{ type: "text", text: replyMessage }],
                stopReason: "stop",
                api: model.api,
                provider: model.provider,
                model: model.id,
                usage: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                  totalTokens: 0,
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
                },
                timestamp: Date.now(),
              };

              // Create a custom stream without requiring API key
              // Import the stream class dynamically to avoid type issues
              const piAiModule = await import("@mariozechner/pi-ai");
              const stream = new (piAiModule as any).AssistantMessageEventStream();
              queueMicrotask(() => {
                stream.push({
                  type: "done",
                  reason: "stop",
                  message: assistantMessage,
                });
                stream.end();
              });

              return stream;
            } catch (error) {
              console.error(`[blackbox-remote-code] Webhook error:`, error);
              const errorMsg = error instanceof Error ? error.message : String(error);

              // Create error message
              const errorMessage: AssistantMessage = {
                role: "assistant",
                content: [{ type: "text", text: `Error: ${errorMsg}` }],
                stopReason: "error",
                errorMessage: errorMsg,
                api: model.api,
                provider: model.provider,
                model: model.id,
                usage: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                  totalTokens: 0,
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
                },
                timestamp: Date.now(),
              };

              // Create error stream without requiring API key
              const piAiModule = await import("@mariozechner/pi-ai");
              const stream = new (piAiModule as any).AssistantMessageEventStream();
              queueMicrotask(() => {
                stream.push({
                  type: "done",
                  reason: "stop",
                  message: errorMessage,
                });
                stream.end();
              });

              return stream;
            }
          }

          // Fallback: use original streamFn if no message/phone
          console.warn(`[blackbox-remote-code] Missing message or phone, using original streamFn`, {
            hasPhoneNumber: !!phoneNumber,
            hasMessageText: !!messageText,
            messageTextLength: messageText?.length || 0,
          });
          return originalStreamFn(model, context, options);
        };
      }

      applyExtraParamsToAgent(
        activeSession.agent,
        params.config,
        params.provider,
        params.modelId,
        params.streamParams,
      );

      if (cacheTrace) {
        cacheTrace.recordStage("session:loaded", {
          messages: activeSession.messages,
          system: systemPrompt,
          note: "after session create",
        });
        activeSession.agent.streamFn = cacheTrace.wrapStreamFn(activeSession.agent.streamFn);
      }
      if (anthropicPayloadLogger) {
        activeSession.agent.streamFn = anthropicPayloadLogger.wrapStreamFn(
          activeSession.agent.streamFn,
        );
      }

      try {
        const prior = await sanitizeSessionHistory({
          messages: activeSession.messages,
          modelApi: params.model.api,
          modelId: params.modelId,
          provider: params.provider,
          sessionManager,
          sessionId: params.sessionId,
          policy: transcriptPolicy,
        });
        cacheTrace?.recordStage("session:sanitized", { messages: prior });
        const validatedGemini = transcriptPolicy.validateGeminiTurns
          ? validateGeminiTurns(prior)
          : prior;
        const validated = transcriptPolicy.validateAnthropicTurns
          ? validateAnthropicTurns(validatedGemini)
          : validatedGemini;
        const limited = limitHistoryTurns(
          validated,
          getDmHistoryLimitFromSessionKey(params.sessionKey, params.config),
        );
        cacheTrace?.recordStage("session:limited", { messages: limited });
        if (limited.length > 0) {
          activeSession.agent.replaceMessages(limited);
        }
      } catch (err) {
        sessionManager.flushPendingToolResults?.();
        activeSession.dispose();
        throw err;
      }

      let aborted = Boolean(params.abortSignal?.aborted);
      let timedOut = false;
      const getAbortReason = (signal: AbortSignal): unknown =>
        "reason" in signal ? (signal as { reason?: unknown }).reason : undefined;
      const makeTimeoutAbortReason = (): Error => {
        const err = new Error("request timed out");
        err.name = "TimeoutError";
        return err;
      };
      const makeAbortError = (signal: AbortSignal): Error => {
        const reason = getAbortReason(signal);
        const err = reason ? new Error("aborted", { cause: reason }) : new Error("aborted");
        err.name = "AbortError";
        return err;
      };
      const abortRun = (isTimeout = false, reason?: unknown) => {
        aborted = true;
        if (isTimeout) timedOut = true;
        if (isTimeout) {
          runAbortController.abort(reason ?? makeTimeoutAbortReason());
        } else {
          runAbortController.abort(reason);
        }
        void activeSession.abort();
      };
      const abortable = <T>(promise: Promise<T>): Promise<T> => {
        const signal = runAbortController.signal;
        if (signal.aborted) {
          return Promise.reject(makeAbortError(signal));
        }
        return new Promise<T>((resolve, reject) => {
          const onAbort = () => {
            signal.removeEventListener("abort", onAbort);
            reject(makeAbortError(signal));
          };
          signal.addEventListener("abort", onAbort, { once: true });
          promise.then(
            (value) => {
              signal.removeEventListener("abort", onAbort);
              resolve(value);
            },
            (err) => {
              signal.removeEventListener("abort", onAbort);
              reject(err);
            },
          );
        });
      };

      const subscription = subscribeEmbeddedPiSession({
        session: activeSession,
        runId: params.runId,
        verboseLevel: params.verboseLevel,
        reasoningMode: params.reasoningLevel ?? "off",
        toolResultFormat: params.toolResultFormat,
        shouldEmitToolResult: params.shouldEmitToolResult,
        shouldEmitToolOutput: params.shouldEmitToolOutput,
        onToolResult: params.onToolResult,
        onReasoningStream: params.onReasoningStream,
        onBlockReply: params.onBlockReply,
        onBlockReplyFlush: params.onBlockReplyFlush,
        blockReplyBreak: params.blockReplyBreak,
        blockReplyChunking: params.blockReplyChunking,
        onPartialReply: params.onPartialReply,
        onAssistantMessageStart: params.onAssistantMessageStart,
        onAgentEvent: params.onAgentEvent,
        enforceFinalTag: params.enforceFinalTag,
      });

      const {
        assistantTexts,
        toolMetas,
        unsubscribe,
        waitForCompactionRetry,
        getMessagingToolSentTexts,
        getMessagingToolSentTargets,
        didSendViaMessagingTool,
        getLastToolError,
      } = subscription;

      const queueHandle: EmbeddedPiQueueHandle = {
        queueMessage: async (text: string) => {
          await activeSession.steer(text);
        },
        isStreaming: () => activeSession.isStreaming,
        isCompacting: () => subscription.isCompacting(),
        abort: abortRun,
      };
      setActiveEmbeddedRun(params.sessionId, queueHandle);

      let abortWarnTimer: NodeJS.Timeout | undefined;
      const isProbeSession = params.sessionId?.startsWith("probe-") ?? false;
      const abortTimer = setTimeout(
        () => {
          if (!isProbeSession) {
            log.warn(
              `embedded run timeout: runId=${params.runId} sessionId=${params.sessionId} timeoutMs=${params.timeoutMs}`,
            );
          }
          abortRun(true);
          if (!abortWarnTimer) {
            abortWarnTimer = setTimeout(() => {
              if (!activeSession.isStreaming) return;
              if (!isProbeSession) {
                log.warn(
                  `embedded run abort still streaming: runId=${params.runId} sessionId=${params.sessionId}`,
                );
              }
            }, 10_000);
          }
        },
        Math.max(1, params.timeoutMs),
      );

      let messagesSnapshot: AgentMessage[] = [];
      let sessionIdUsed = activeSession.sessionId;
      const onAbort = () => {
        const reason = params.abortSignal ? getAbortReason(params.abortSignal) : undefined;
        const timeout = reason ? isTimeoutError(reason) : false;
        abortRun(timeout, reason);
      };
      if (params.abortSignal) {
        if (params.abortSignal.aborted) {
          onAbort();
        } else {
          params.abortSignal.addEventListener("abort", onAbort, {
            once: true,
          });
        }
      }

      // Get hook runner once for both before_agent_start and agent_end hooks
      const hookRunner = getGlobalHookRunner();

      let promptError: unknown = null;
      try {
        const promptStartedAt = Date.now();

        // Run before_agent_start hooks to allow plugins to inject context
        let effectivePrompt = params.prompt;
        if (hookRunner?.hasHooks("before_agent_start")) {
          try {
            const hookResult = await hookRunner.runBeforeAgentStart(
              {
                prompt: params.prompt,
                messages: activeSession.messages,
              },
              {
                agentId: params.sessionKey?.split(":")[0] ?? "main",
                sessionKey: params.sessionKey,
                workspaceDir: params.workspaceDir,
                messageProvider: params.messageProvider ?? undefined,
              },
            );
            if (hookResult?.prependContext) {
              effectivePrompt = `${hookResult.prependContext}\n\n${params.prompt}`;
              log.debug(
                `hooks: prepended context to prompt (${hookResult.prependContext.length} chars)`,
              );
            }
          } catch (hookErr) {
            log.warn(`before_agent_start hook failed: ${String(hookErr)}`);
          }
        }

        log.debug(`embedded run prompt start: runId=${params.runId} sessionId=${params.sessionId}`);
        cacheTrace?.recordStage("prompt:before", {
          prompt: effectivePrompt,
          messages: activeSession.messages,
        });

        // Repair orphaned trailing user messages so new prompts don't violate role ordering.
        const leafEntry = sessionManager.getLeafEntry();
        if (leafEntry?.type === "message" && leafEntry.message.role === "user") {
          if (leafEntry.parentId) {
            sessionManager.branch(leafEntry.parentId);
          } else {
            sessionManager.resetLeaf();
          }
          const sessionContext = sessionManager.buildSessionContext();
          activeSession.agent.replaceMessages(sessionContext.messages);
          log.warn(
            `Removed orphaned user message to prevent consecutive user turns. ` +
              `runId=${params.runId} sessionId=${params.sessionId}`,
          );
        }

        try {
          // Detect and load images referenced in the prompt for vision-capable models.
          // This eliminates the need for an explicit "view" tool call by injecting
          // images directly into the prompt when the model supports it.
          // Also scans conversation history to enable follow-up questions about earlier images.
          const imageResult = await detectAndLoadPromptImages({
            prompt: effectivePrompt,
            workspaceDir: effectiveWorkspace,
            model: params.model,
            existingImages: params.images,
            historyMessages: activeSession.messages,
            maxBytes: MAX_IMAGE_BYTES,
            // Enforce sandbox path restrictions when sandbox is enabled
            sandboxRoot: sandbox?.enabled ? sandbox.workspaceDir : undefined,
          });

          // Inject history images into their original message positions.
          // This ensures the model sees images in context (e.g., "compare to the first image").
          const didMutate = injectHistoryImagesIntoMessages(
            activeSession.messages,
            imageResult.historyImagesByIndex,
          );
          if (didMutate) {
            // Persist message mutations (e.g., injected history images) so we don't re-scan/reload.
            activeSession.agent.replaceMessages(activeSession.messages);
          }

          cacheTrace?.recordStage("prompt:images", {
            prompt: effectivePrompt,
            messages: activeSession.messages,
            note: `images: prompt=${imageResult.images.length} history=${imageResult.historyImagesByIndex.size}`,
          });

          const shouldTrackCacheTtl =
            params.config?.agents?.defaults?.contextPruning?.mode === "cache-ttl" &&
            isCacheTtlEligibleProvider(params.provider, params.modelId);
          if (shouldTrackCacheTtl) {
            appendCacheTtlTimestamp(sessionManager, {
              timestamp: Date.now(),
              provider: params.provider,
              modelId: params.modelId,
            });
          }

          // Only pass images option if there are actually images to pass
          // This avoids potential issues with models that don't expect the images parameter
          if (imageResult.images.length > 0) {
            await abortable(activeSession.prompt(effectivePrompt, { images: imageResult.images }));
          } else {
            await abortable(activeSession.prompt(effectivePrompt));
          }
        } catch (err) {
          promptError = err;
        } finally {
          log.debug(
            `embedded run prompt end: runId=${params.runId} sessionId=${params.sessionId} durationMs=${Date.now() - promptStartedAt}`,
          );
        }

        try {
          await waitForCompactionRetry();
        } catch (err) {
          if (isAbortError(err)) {
            if (!promptError) promptError = err;
          } else {
            throw err;
          }
        }

        messagesSnapshot = activeSession.messages.slice();
        sessionIdUsed = activeSession.sessionId;
        cacheTrace?.recordStage("session:after", {
          messages: messagesSnapshot,
          note: promptError ? "prompt error" : undefined,
        });
        anthropicPayloadLogger?.recordUsage(messagesSnapshot, promptError);

        // Run agent_end hooks to allow plugins to analyze the conversation
        // This is fire-and-forget, so we don't await
        if (hookRunner?.hasHooks("agent_end")) {
          hookRunner
            .runAgentEnd(
              {
                messages: messagesSnapshot,
                success: !aborted && !promptError,
                error: promptError ? describeUnknownError(promptError) : undefined,
                durationMs: Date.now() - promptStartedAt,
              },
              {
                agentId: params.sessionKey?.split(":")[0] ?? "main",
                sessionKey: params.sessionKey,
                workspaceDir: params.workspaceDir,
                messageProvider: params.messageProvider ?? undefined,
              },
            )
            .catch((err) => {
              log.warn(`agent_end hook failed: ${err}`);
            });
        }
      } finally {
        clearTimeout(abortTimer);
        if (abortWarnTimer) clearTimeout(abortWarnTimer);
        unsubscribe();
        clearActiveEmbeddedRun(params.sessionId, queueHandle);
        params.abortSignal?.removeEventListener?.("abort", onAbort);
      }

      const lastAssistant = messagesSnapshot
        .slice()
        .reverse()
        .find((m) => (m as AgentMessage)?.role === "assistant") as AssistantMessage | undefined;

      const toolMetasNormalized = toolMetas
        .filter(
          (entry): entry is { toolName: string; meta?: string } =>
            typeof entry.toolName === "string" && entry.toolName.trim().length > 0,
        )
        .map((entry) => ({ toolName: entry.toolName, meta: entry.meta }));

      return {
        aborted,
        timedOut,
        promptError,
        sessionIdUsed,
        systemPromptReport,
        messagesSnapshot,
        assistantTexts,
        toolMetas: toolMetasNormalized,
        lastAssistant,
        lastToolError: getLastToolError?.(),
        didSendViaMessagingTool: didSendViaMessagingTool(),
        messagingToolSentTexts: getMessagingToolSentTexts(),
        messagingToolSentTargets: getMessagingToolSentTargets(),
        cloudCodeAssistFormatError: Boolean(
          lastAssistant?.errorMessage && isCloudCodeAssistFormatError(lastAssistant.errorMessage),
        ),
        // Client tool call detected (OpenResponses hosted tools)
        clientToolCall: clientToolCallDetected ?? undefined,
      };
    } finally {
      // Always tear down the session (and release the lock) before we leave this attempt.
      sessionManager?.flushPendingToolResults?.();
      session?.dispose();
      await sessionLock.release();
    }
  } finally {
    restoreSkillEnv?.();
    process.chdir(prevCwd);
  }
}
