/**
 * Blackbox Remote-Code Environment Configuration
 * Centralized access to Blackbox-related environment variables
 */

export const clawdbotApiConfig = {
  get apiKey(): string {
    return process.env.CLAWDBOT_API_KEY?.trim() || "1234567890";
  },

  setApiKey(key: string): void {
    process.env.CLAWDBOT_API_KEY = key;
  },

  get isConfigured(): boolean {
    const key = process.env.CLAWDBOT_API_KEY?.trim();
    return !!key && key !== "1234567890";
  },
};

export const remoteCodeConfig = {
  get apiUrl(): string {
    return process.env.REMOTE_CODE_API_URL || "https://markita-unenjoyable-lucinda.ngrok-free.dev";
  },

  get isConfigured(): boolean {
    return !!process.env.REMOTE_CODE_API_URL;
  },
};

export const blackboxConfig = {
  clawdbotApi: clawdbotApiConfig,
  remoteCode: remoteCodeConfig,
};

export default blackboxConfig;
