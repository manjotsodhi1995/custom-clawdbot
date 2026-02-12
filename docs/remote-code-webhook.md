# Remote-Code Webhook Integration

This document explains how to use the bidirectional webhook communication between Clawdbot and your remote code execution service.

## Overview

The remote-code webhook system enables two-way communication:

1. **Outbound (Clawdbot → Remote Service)**: Use the `remote_code` tool to send requests to your remote service
2. **Inbound (Remote Service → Clawdbot)**: Your remote service can send messages back to users via webhook

## Webhook Endpoint

### Endpoint Details

- **URL**: `http://your-clawdbot-instance:18789/api/remote-code/webhook`
- **Method**: `POST`
- **Authentication**: Required via `X-Clawdbot-API-Key` header or `Authorization: Bearer <token>`

### Authentication

The webhook requires the same `CLAWDBOT_API_KEY` that you use for outbound requests. Set this in your environment:

```bash
export CLAWDBOT_API_KEY="your-secret-key-here"
```

### Request Format

Send a POST request with the following JSON payload:

```json
{
  "platform": "signal",
  "platformUserId": "+1234567890",
  "message": "Your task has been completed successfully!",
  "metadata": {
    "taskId": "task-123",
    "repo": "my-repo",
    "branch": "main"
  }
}
```

#### Required Fields

- `platform` (string): The messaging platform to use. Supported values:
  - `signal` - Signal messenger
  - `telegram` - Telegram
  - `discord` - Discord
  - `slack` - Slack
  - `imessage` - iMessage (macOS only)
  - `whatsapp` - WhatsApp

- `platformUserId` (string): The user identifier for the platform:
  - Signal: Phone number (e.g., `+1234567890`)
  - Telegram: Chat ID (e.g., `123456789` or `@username`)
  - Discord: Channel ID (e.g., `channel:123456789`)
  - Slack: Channel ID (e.g., `C1234567890`)
  - iMessage: Phone number or email
  - WhatsApp: Phone number with country code

- `message` (string): The message text to send to the user

#### Optional Fields

- `metadata` (object): Additional context about the message (not sent to user, for logging)

### Response Format

#### Success Response (200 OK)

```json
{
  "ok": true,
  "message": "Message delivered successfully",
  "requestId": "req_1234567890_abc123"
}
```

#### Error Responses

**401 Unauthorized** - Invalid or missing API key:
```json
{
  "ok": false,
  "error": "Unauthorized. Provide valid CLAWDBOT_API_KEY via Authorization: Bearer <key> or X-Clawdbot-API-Key header."
}
```

**400 Bad Request** - Invalid payload:
```json
{
  "ok": false,
  "error": "Invalid payload. Required fields: platform (string), platformUserId (string), message (string)"
}
```

**500 Internal Server Error** - Delivery failed:
```json
{
  "ok": false,
  "error": "Delivery failed: <error details>",
  "requestId": "req_1234567890_abc123"
}
```

## Usage Examples

### cURL Example

```bash
curl -X POST http://localhost:18789/api/remote-code/webhook \
  -H "Content-Type: application/json" \
  -H "X-Clawdbot-API-Key: your-secret-key-here" \
  -d '{
    "platform": "signal",
    "platformUserId": "+1234567890",
    "message": "Your code execution task is complete!"
  }'
```

### Python Example

```python
import requests

CLAWDBOT_URL = "http://localhost:18789"
API_KEY = "your-secret-key-here"

def send_webhook_message(platform, user_id, message, metadata=None):
    """Send a message to a user via Clawdbot webhook"""
    
    payload = {
        "platform": platform,
        "platformUserId": user_id,
        "message": message
    }
    
    if metadata:
        payload["metadata"] = metadata
    
    headers = {
        "Content-Type": "application/json",
        "X-Clawdbot-API-Key": API_KEY
    }
    
    response = requests.post(
        f"{CLAWDBOT_URL}/api/remote-code/webhook",
        json=payload,
        headers=headers
    )
    
    return response.json()

# Example usage
result = send_webhook_message(
    platform="signal",
    user_id="+1234567890",
    message="Task completed: Your code has been deployed!",
    metadata={
        "taskId": "deploy-123",
        "repo": "my-app",
        "branch": "production"
    }
)

print(result)
```

### Node.js Example

```javascript
const axios = require('axios');

const CLAWDBOT_URL = 'http://localhost:18789';
const API_KEY = 'your-secret-key-here';

async function sendWebhookMessage(platform, userId, message, metadata = null) {
  const payload = {
    platform,
    platformUserId: userId,
    message,
  };
  
  if (metadata) {
    payload.metadata = metadata;
  }
  
  try {
    const response = await axios.post(
      `${CLAWDBOT_URL}/api/remote-code/webhook`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Clawdbot-API-Key': API_KEY,
        },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Webhook error:', error.response?.data || error.message);
    throw error;
  }
}

// Example usage
sendWebhookMessage(
  'telegram',
  '123456789',
  'Your build is ready!',
  { taskId: 'build-456', status: 'success' }
)
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Failed:', error));
```

## Integration Workflow

### Typical Flow

1. **User initiates task** via Clawdbot chat:
   ```
   User: @remote-code create a new feature
   ```

2. **Clawdbot sends request** to your remote service using the `remote_code` tool:
   ```
   POST /api/clawdbot/conversation/create-task
   ```

3. **Remote service processes** the task asynchronously

4. **Remote service sends completion notification** back to Clawdbot:
   ```
   POST /api/remote-code/webhook
   {
     "platform": "signal",
     "platformUserId": "+1234567890",
     "message": "✅ Feature created successfully in branch feature/new-feature"
   }
   ```

5. **User receives notification** in their messaging app

## Security Considerations

1. **API Key Protection**: Keep your `CLAWDBOT_API_KEY` secret and never commit it to version control

2. **HTTPS**: Use HTTPS in production to encrypt API key transmission

3. **IP Whitelisting**: Consider restricting webhook access to known IP addresses

4. **Rate Limiting**: Implement rate limiting on your remote service to prevent abuse

## Troubleshooting

### Webhook Not Receiving Messages

1. Check that Clawdbot gateway is running:
   ```bash
   curl http://localhost:18789/health
   ```

2. Verify API key is set:
   ```bash
   echo $CLAWDBOT_API_KEY
   ```

3. Check Clawdbot logs for webhook registration:
   ```
   [remote-code-tool] Registering webhook endpoint at /api/remote-code/webhook
   [remote-code-tool] Webhook endpoint registered successfully
   ```

### Message Delivery Failures

1. Check platform-specific configuration in Clawdbot config

2. Verify user ID format matches platform requirements

3. Check Clawdbot logs for delivery errors:
   ```
   [remote-code-webhook] Delivery error: <details>
   ```

### Authentication Errors

1. Ensure API key matches between outbound and inbound requests

2. Check header format:
   - `X-Clawdbot-API-Key: your-key` (preferred)
   - `Authorization: Bearer your-key` (alternative)

## Monitoring

The webhook handler logs all activity:

```
[remote-code-webhook] [req_xxx] Received webhook request from 192.168.1.100
[remote-code-webhook] [req_xxx] Valid payload received for platform: signal
[remote-code-webhook] [webhook_xxx] Delivering message via signal to +1234567...
[remote-code-webhook] [webhook_xxx] Signal delivery successful, messageId: 1234567890
```

Monitor these logs to track webhook usage and diagnose issues.

## API Reference

### Supported Platforms

| Platform  | User ID Format | Example |
|-----------|----------------|---------|
| Signal    | Phone number with country code | `+1234567890` |
| Telegram  | Chat ID or username | `123456789` or `@username` |
| Discord   | Channel ID with prefix | `channel:123456789` |
| Slack     | Channel ID | `C1234567890` |
| iMessage  | Phone number or email | `+1234567890` or `user@example.com` |
| WhatsApp  | Phone number with country code | `1234567890` |

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 401  | Unauthorized | Check API key |
| 400  | Bad Request | Verify payload format |
| 405  | Method Not Allowed | Use POST method |
| 500  | Internal Server Error | Check logs, verify platform config |

## Support

For issues or questions:
1. Check Clawdbot logs for detailed error messages
2. Verify your configuration matches the examples above
3. Consult the main Clawdbot documentation for platform-specific setup
