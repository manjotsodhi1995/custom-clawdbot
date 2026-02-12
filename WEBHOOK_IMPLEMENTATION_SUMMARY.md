# Remote-Code Webhook Implementation Summary

## Overview

This implementation adds bidirectional webhook communication to Clawdbot, allowing your remote code execution service to send messages back to users after task completion.

## Files Created

### 1. `src/agents/tools/remote-code-webhook-handler.ts`
**Purpose**: Handles incoming webhook requests from the remote service

**Key Features**:
- Validates authentication using `CLAWDBOT_API_KEY`
- Parses and validates webhook payload
- Routes messages to appropriate messaging platforms (Signal, Telegram, Discord, Slack, iMessage, WhatsApp)
- Comprehensive error handling and logging
- Returns structured JSON responses

**Main Function**: `handleRemoteCodeWebhook(req, res)`

### 2. `docs/remote-code-webhook.md`
**Purpose**: Complete documentation for using the webhook system

**Contents**:
- Endpoint details and authentication
- Request/response formats
- Usage examples (cURL, Python, Node.js)
- Integration workflow
- Security considerations
- Troubleshooting guide
- API reference

## Files Modified

### 1. `src/agents/tools/remote-code-tool.ts`
**Changes**:
- Added import for `registerPluginHttpRoute` and `handleRemoteCodeWebhook`
- Added `registerRemoteCodeWebhook()` function to register the webhook endpoint at `/api/remote-code/webhook`
- Returns unregister function for cleanup

### 2. `src/gateway/server.impl.ts`
**Changes**:
- Added import for `registerRemoteCodeWebhook`
- Calls `registerRemoteCodeWebhook()` during gateway startup (after plugin registry is loaded)
- Calls `unregisterRemoteCodeWebhook()` during gateway shutdown for proper cleanup

## How It Works

### Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Remote Service │────────▶│  Clawdbot        │────────▶│  User (Signal,  │
│  (Your Backend) │  POST   │  Webhook Handler │  Send   │  Telegram, etc) │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                                     │ Uses existing
                                     │ channel delivery
                                     ▼
                            ┌──────────────────┐
                            │  Channel Send    │
                            │  Functions       │
                            │  (Signal, etc)   │
                            └──────────────────┘
```

### Request Flow

1. **Remote service completes a task**
2. **Remote service sends POST request** to `http://clawdbot:18789/api/remote-code/webhook`
3. **Webhook handler validates** authentication and payload
4. **Handler routes message** to appropriate channel (Signal, Telegram, etc.)
5. **Channel send function** delivers message to user
6. **Handler returns** success/failure response

### Authentication

Uses the same `CLAWDBOT_API_KEY` environment variable as outbound requests. Supports two header formats:
- `X-Clawdbot-API-Key: <key>` (preferred)
- `Authorization: Bearer <key>` (alternative)

## Webhook Endpoint

### URL
```
POST http://your-clawdbot-instance:18789/api/remote-code/webhook
```

### Request Payload
```json
{
  "platform": "signal",
  "platformUserId": "+1234567890",
  "message": "Task completed successfully!",
  "metadata": {
    "taskId": "optional",
    "repo": "optional"
  }
}
```

### Success Response (200)
```json
{
  "ok": true,
  "message": "Message delivered successfully",
  "requestId": "req_1234567890_abc123"
}
```

### Error Response (400/401/500)
```json
{
  "ok": false,
  "error": "Error description",
  "requestId": "req_1234567890_abc123"
}
```

## Supported Platforms

| Platform  | User ID Format | Example |
|-----------|----------------|---------|
| Signal    | Phone number   | `+1234567890` |
| Telegram  | Chat ID        | `123456789` or `@username` |
| Discord   | Channel ID     | `channel:123456789` |
| Slack     | Channel ID     | `C1234567890` |
| iMessage  | Phone/Email    | `+1234567890` |
| WhatsApp  | Phone number   | `1234567890` |

## Testing

### Test with cURL

```bash
# Set your API key
export CLAWDBOT_API_KEY="your-secret-key"

# Send test message
curl -X POST http://localhost:18789/api/remote-code/webhook \
  -H "Content-Type: application/json" \
  -H "X-Clawdbot-API-Key: $CLAWDBOT_API_KEY" \
  -d '{
    "platform": "signal",
    "platformUserId": "+1234567890",
    "message": "Test message from webhook!"
  }'
```

### Expected Response
```json
{
  "ok": true,
  "message": "Message delivered successfully",
  "requestId": "req_1234567890_abc123"
}
```

## Logging

The webhook handler provides detailed logging:

```
[remote-code-tool] Registering webhook endpoint at /api/remote-code/webhook
[remote-code-tool] Webhook endpoint registered successfully at /api/remote-code/webhook
[remote-code-webhook] [req_xxx] Received webhook request from 192.168.1.100
[remote-code-webhook] [req_xxx] Valid payload received for platform: signal
[remote-code-webhook] [webhook_xxx] Delivering message via signal to +1234567...
[remote-code-webhook] [webhook_xxx] Signal delivery successful, messageId: 1234567890
```

## Security Features

1. **API Key Authentication**: Required for all webhook requests
2. **Request Validation**: Validates payload structure and required fields
3. **Error Handling**: Comprehensive error handling with detailed error messages
4. **Logging**: All requests are logged with unique request IDs for tracking
5. **Platform Validation**: Only allows supported messaging platforms

## Integration Example

### Python Integration

```python
import requests

def notify_user_via_clawdbot(user_phone, message):
    """Send notification to user via Clawdbot webhook"""
    
    response = requests.post(
        "http://clawdbot:18789/api/remote-code/webhook",
        json={
            "platform": "signal",
            "platformUserId": user_phone,
            "message": message
        },
        headers={
            "X-Clawdbot-API-Key": os.getenv("CLAWDBOT_API_KEY")
        }
    )
    
    return response.json()

# Usage in your task completion handler
def on_task_complete(task_id, user_phone):
    result = notify_user_via_clawdbot(
        user_phone,
        f"✅ Task {task_id} completed successfully!"
    )
    print(f"Notification sent: {result}")
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check that `CLAWDBOT_API_KEY` is set correctly
   - Verify the API key matches between outbound and inbound requests

2. **400 Bad Request**
   - Verify JSON payload structure
   - Ensure all required fields are present

3. **500 Internal Server Error**
   - Check Clawdbot logs for detailed error
   - Verify platform-specific configuration (e.g., Signal, Telegram setup)
   - Ensure user ID format matches platform requirements

### Debug Steps

1. Check Clawdbot is running:
   ```bash
   curl http://localhost:18789/health
   ```

2. Verify webhook endpoint is registered:
   ```bash
   # Check logs for:
   [remote-code-tool] Webhook endpoint registered successfully
   ```

3. Test with verbose logging:
   ```bash
   # Check logs while sending test request
   tail -f clawdbot.log | grep remote-code-webhook
   ```

## Next Steps

1. **Configure your remote service** to call the webhook endpoint after task completion
2. **Test the integration** with a simple message
3. **Monitor logs** to ensure messages are being delivered
4. **Implement error handling** in your remote service for failed webhook calls
5. **Consider adding retry logic** for transient failures

## Benefits

✅ **Asynchronous Communication**: Remote service can notify users without blocking
✅ **Multi-Platform Support**: Works with Signal, Telegram, Discord, Slack, iMessage, WhatsApp
✅ **Secure**: API key authentication required
✅ **Reliable**: Comprehensive error handling and logging
✅ **Easy Integration**: Simple REST API with JSON payloads
✅ **Well Documented**: Complete documentation with examples

## Maintenance

- The webhook handler is automatically registered when Clawdbot starts
- No additional configuration needed beyond setting `CLAWDBOT_API_KEY`
- Cleanup is handled automatically on gateway shutdown
- Logs provide full audit trail of webhook activity

---

**Implementation Date**: 2024
**Status**: ✅ Complete and Ready for Use
