---
name: remote-code
description: Create and manage coding tasks on remote-code platform via WhatsApp. Multi-step conversation flow: select repository → select branch → provide prompt. Can be used with or without AI - messages are forwarded directly to remote-code webhook.
metadata: {"clawdbot":{"emoji":"💻","requires":{"bins":["curl"]}}}
---

# Remote-Code Integration

Create coding tasks on the remote-code platform via WhatsApp. The assistant will guide you through a multi-step conversation to select your repository, branch, and task description.

## Quick Start

Just send any message to start the conversation flow. The assistant will:
1. Show your repositories
2. Ask you to select a repository
3. Show branches for that repository
4. Ask you to select a branch
5. Ask for your task description
6. Create the task

## Direct Commands

You can also use structured commands:

```bash
# Start conversation and list repositories
curl -X POST "https://your-remote-code-domain.com/api/clawdbot/conversation/start" \
  -H "Content-Type: application/json" \
  -H "X-Clawdbot-API-Key: $CLAWDBOT_API_KEY" \
  -d '{"phoneNumber": "+1234567890"}'

# List repositories
curl -X GET "https://your-remote-code-domain.com/api/clawdbot/conversation/repos?phoneNumber=+1234567890" \
  -H "X-Clawdbot-API-Key: $CLAWDBOT_API_KEY"

# List branches for a repository
curl -X GET "https://your-remote-code-domain.com/api/clawdbot/conversation/branches?phoneNumber=+1234567890&repo=owner/repo" \
  -H "X-Clawdbot-API-Key: $CLAWDBOT_API_KEY"

# Create task directly
curl -X POST "https://your-remote-code-domain.com/api/clawdbot/conversation/create-task" \
  -H "Content-Type: application/json" \
  -H "X-Clawdbot-API-Key: $CLAWDBOT_API_KEY" \
  -d '{
    "phoneNumber": "+1234567890",
    "repo": "owner/repo",
    "branch": "main",
    "prompt": "Add authentication to the API"
  }'
```

## Configuration

Set these environment variables in your Clawdbot configuration:

- `CLAWDBOT_API_KEY`: Secret key for authenticating with remote-code API
- `REMOTE_CODE_API_URL`: Base URL of your remote-code platform (default: https://cloud.blackbox.ai)

## Usage Flow

1. **Initial Message**: User sends any message
   - Assistant calls `/api/clawdbot/conversation/start` with phone number
   - Returns formatted list of repositories

2. **Repository Selection**: User sends repo name or number
   - Assistant validates and stores selection
   - Calls `/api/clawdbot/conversation/branches` with repo
   - Returns formatted list of branches

3. **Branch Selection**: User sends branch name or number
   - Assistant validates and stores selection
   - Prompts for task description

4. **Task Description**: User sends prompt
   - Assistant calls `/api/clawdbot/conversation/create-task`
   - Returns task ID and confirmation message

## Error Handling

- If user not found: "Please register your phone number in remote-code platform"
- If GitHub token missing: "Please connect your GitHub account in settings"
- If API key missing: "Please configure your Blackbox API key in settings"
- If repo/branch invalid: "Repository/branch not found. Please try again."

## Notes

- Conversation state expires after 15 minutes of inactivity
- Phone numbers must be in E.164 format (e.g., +1234567890)
- Users must have phone number registered in remote-code platform
- Users must have GitHub token and Blackbox API key configured
