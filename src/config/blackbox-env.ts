/**
 * Blackbox Remote-Code Environment Configuration
 * Centralized access to Blackbox-related environment variables
 */

// Static API key for webhook authentication
// TODO: Move to environment variable for production use
const STATIC_API_KEY = "1234567890";

export const clawdbotApiConfig = {
  get apiKey(): string {
    return STATIC_API_KEY;
  },

  setApiKey(key: string): void {
    process.env.CLAWDBOT_API_KEY = key;
  },

  get isConfigured(): boolean {
    const key = process.env.CLAWDBOT_API_KEY?.trim() || STATIC_API_KEY;
    return !!key;
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
