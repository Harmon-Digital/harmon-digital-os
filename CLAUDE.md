# Harmon Digital OS — Claude Code Notes

## Payroll Cron Preferences

**Notification method: Email (not Slack)**

When the biweekly payroll cron runs (Step 5), send the approval-request message via **Gmail MCP** (`mcp__Gmail__create_draft` then send, or equivalent send tool) to `isaac@harmon-digital.com`. Do **not** use the Slack MCP for payroll notifications.
