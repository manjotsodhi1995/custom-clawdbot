import { Type } from "@sinclair/typebox";

import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";
import { clawdbotApiConfig, remoteCodeConfig } from "../../config/blackbox-env.js";

const REMOTE_CODE_COMMANDS = ["start", "repos", "branches", "create-task", "webhook"] as const;

const RemoteCodeToolSchema = Type.Object({
  command: stringEnum(REMOTE_CODE_COMMANDS),
  phoneNumber: Type.Optional(Type.String()),
  message: Type.Optional(Type.String()),
  repo: Type.Optional(Type.String()),
  branch: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
  platform: Type.Optional(Type.String()),
  platformUserId: Type.Optional(Type.String()),
});

const REMOTE_CODE_BASE_URL = remoteCodeConfig.apiUrl;
const CLAWDBOT_API_KEY = clawdbotApiConfig.apiKey;

async function callRemoteCodeAPI(
  endpoint: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>,
): Promise<unknown> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`[remote-code-tool] [${requestId}] Preparing API call:`, {
    endpoint,
    method,
    baseUrl: REMOTE_CODE_BASE_URL,
    hasApiKey: !!CLAWDBOT_API_KEY,
    apiKeyLength: CLAWDBOT_API_KEY?.length || 0,
    apiKeyPrefix: CLAWDBOT_API_KEY ? `${CLAWDBOT_API_KEY.substring(0, 10)}...` : "none",
    hasBody: !!body,
    queryParams: queryParams ? Object.keys(queryParams) : [],
  });

  if (!CLAWDBOT_API_KEY) {
    console.error(`[remote-code-tool] [${requestId}] CLAWDBOT_API_KEY not set`);
    throw new Error(
      "CLAWDBOT_API_KEY environment variable is not set. Please configure it to use remote-code API.",
    );
  }

  const url = new URL(`${REMOTE_CODE_BASE_URL}${endpoint}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.append(key, value);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Clawdbot-API-Key": CLAWDBOT_API_KEY,
  };

  console.log(`[remote-code-tool] [${requestId}] Making ${method} request to:`, url.toString());
  console.log(`[remote-code-tool] [${requestId}] Headers:`, {
    "Content-Type": headers["Content-Type"],
    "X-Clawdbot-API-Key": `${CLAWDBOT_API_KEY.substring(0, 10)}...`,
  });

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(
      `[remote-code-tool] [${requestId}] Response status:`,
      response.status,
      response.statusText,
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[remote-code-tool] [${requestId}] API error:`, {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500), // Limit error text length
        headers: Object.fromEntries(response.headers.entries()),
      });
      throw new Error(
        `Remote-code API error (${response.status}): ${errorText || response.statusText}`,
      );
    }

    const result = await response.json();
    console.log(`[remote-code-tool] [${requestId}] API call successful`);
    return result;
  } catch (error) {
    console.error(`[remote-code-tool] [${requestId}] Fetch error:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export function createRemoteCodeTool(): AnyAgentTool {
  return {
    label: "Remote-Code",
    name: "remote_code",
    description:
      "Interact with Blackbox Remote-Code API endpoints. Use @remote-code/ commands in chat. Available commands: start (initialize conversation and get repos), repos (list repositories), branches (list branches for a repo), create-task (create a task), webhook (send webhook message). Requires phoneNumber for all commands. For webhook, also requires message. For create-task, requires repo, branch, and prompt.",
    parameters: RemoteCodeToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const command = readStringParam(params, "command", { required: true });
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      console.log(`[remote-code-tool] [${executionId}] Executing command:`, {
        command,
        toolCallId: _toolCallId,
        params: {
          phoneNumber: params.phoneNumber
            ? `${String(params.phoneNumber).substring(0, 4)}***`
            : undefined,
          message: params.message ? `${String(params.message).substring(0, 50)}...` : undefined,
          repo: params.repo,
          branch: params.branch,
          prompt: params.prompt ? `${String(params.prompt).substring(0, 50)}...` : undefined,
        },
      });

      try {
        switch (command) {
          case "start": {
            const phoneNumber = readStringParam(params, "phoneNumber", { required: true });
            const result = await callRemoteCodeAPI("/api/clawdbot/conversation/start", "POST", {
              phoneNumber,
            });
            return jsonResult(result);
          }

          case "repos": {
            const phoneNumber = readStringParam(params, "phoneNumber", { required: true });
            const result = await callRemoteCodeAPI(
              "/api/clawdbot/conversation/repos",
              "GET",
              undefined,
              { phoneNumber },
            );
            return jsonResult(result);
          }

          case "branches": {
            const phoneNumber = readStringParam(params, "phoneNumber", { required: true });
            const repo = readStringParam(params, "repo", { required: true });
            const result = await callRemoteCodeAPI(
              "/api/clawdbot/conversation/branches",
              "GET",
              undefined,
              { phoneNumber, repo },
            );
            return jsonResult(result);
          }

          case "create-task": {
            const phoneNumber = readStringParam(params, "phoneNumber", { required: true });
            const repo = readStringParam(params, "repo", { required: true });
            const branch = readStringParam(params, "branch", { required: true });
            const prompt = readStringParam(params, "prompt", { required: true });
            const result = await callRemoteCodeAPI(
              "/api/clawdbot/conversation/create-task",
              "POST",
              { phoneNumber, repo, branch, prompt },
            );
            return jsonResult(result);
          }

          case "webhook": {
            const phoneNumber = readStringParam(params, "phoneNumber", { required: false });
            const platformUserId = readStringParam(params, "platformUserId", { required: false });
            const message = readStringParam(params, "message", { required: true });
            const platform = readStringParam(params, "platform", { required: false }) || "signal";

            // Use platformUserId if provided, otherwise fall back to phoneNumber
            const userId = platformUserId || phoneNumber;
            if (!userId) {
              throw new Error("Either platformUserId or phoneNumber must be provided");
            }

            const result = await callRemoteCodeAPI("/api/webhooks/messaging", "POST", {
              platform,
              message,
              platformUserId: userId,
            });
            return jsonResult(result);
          }

          default:
            throw new Error(`Unknown command: ${command}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[remote-code-tool] [${executionId}] Command execution failed:`, {
          command,
          error: message,
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error(`Remote-code API call failed: ${message}`);
      }
    },
  };
}
