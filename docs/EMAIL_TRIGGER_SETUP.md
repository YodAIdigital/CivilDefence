# Email-Triggered Notifications Setup Guide

This guide explains how to set up inbound email routing so that emails sent to unique addresses can automatically trigger alerts in CivilDefencePro.

## Overview

The system works as follows:

1. Each alert rule has a unique trigger email address (e.g., `alert-0a861d03-dw3xac@civildefence.pro`)
2. When an email is sent to that address, Cloudflare Email Workers receives it and forwards to your app
3. The app's `/api/alert-rules/trigger/email` endpoint processes the email and triggers the alert
4. Notifications are sent via app, email, and/or SMS based on the rule configuration

## Prerequisites

- Your domain managed by Cloudflare (e.g., `civildefence.pro`)
- Cloudflare account (free tier works)
- Your CivilDefencePro app deployed and accessible via HTTPS

> **Note:** SMTP2GO is for **outbound** email only. It does not support receiving inbound emails. Use Cloudflare Email Workers for inbound email processing.

---

## Cloudflare Email Workers Setup (Recommended)

Cloudflare Email Workers is free for the first 100,000 requests/day and integrates directly with your existing Cloudflare setup.

### Step 1: Enable Email Routing in Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain (`civildefence.pro`)
3. Go to **Email** → **Email Routing**
4. Click **Get started** or **Enable Email Routing**
5. Cloudflare will prompt you to add the required DNS records - click **Add records automatically**

The following records will be added:
| Type | Name | Content |
|------|------|---------|
| MX | @ | `route1.mx.cloudflare.net` (Priority 84) |
| MX | @ | `route2.mx.cloudflare.net` (Priority 5) |
| MX | @ | `route3.mx.cloudflare.net` (Priority 3) |
| TXT | @ | `v=spf1 include:_spf.mx.cloudflare.net ~all` |

### Step 2: Create the Email Worker

1. In Cloudflare, go to **Workers & Pages** → **Create**
2. Click **Create Worker**
3. Name it: `civildefence-email-handler`
4. Click **Deploy** (we'll edit the code next)
5. Click **Edit code** and replace ALL the code with:

```javascript
export default {
  async email(message, env, ctx) {
    try {
      // Extract email details
      const to = message.to;
      const from = message.from;
      const subject = message.headers.get("subject") || "";

      // Read the raw email
      const rawEmail = await new Response(message.raw).text();

      // Extract plain text body from email
      let textBody = "";

      // Try to find plain text part
      const plainTextMatch = rawEmail.match(
        /Content-Type:\s*text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:[^\r\n]*\r?\n)?(?:[^\r\n]*\r?\n)*?\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\n--|\Z)/i
      );

      if (plainTextMatch && plainTextMatch[1]) {
        textBody = plainTextMatch[1].trim();
      } else {
        // Fallback: try to extract body after headers
        const bodyMatch = rawEmail.match(/\r?\n\r?\n([\s\S]*)/);
        if (bodyMatch && bodyMatch[1]) {
          // Remove any MIME boundaries and clean up
          textBody = bodyMatch[1]
            .replace(/--[a-zA-Z0-9_-]+--?[\s\S]*?(?=\r?\n|$)/g, "")
            .replace(/<[^>]+>/g, "") // Strip HTML tags
            .trim();
        }
      }

      // Forward to CivilDefencePro API
      const response = await fetch(
        "https://civildefence.pro/api/alert-rules/trigger/email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: to,
            from: from,
            subject: subject,
            text: textBody,
          }),
        }
      );

      const result = await response.text();

      if (!response.ok) {
        console.error(`API Error (${response.status}):`, result);
        // Don't throw - we don't want to bounce the email
      } else {
        console.log("Email forwarded successfully:", result);
      }
    } catch (error) {
      console.error("Error processing email:", error);
      // Don't throw - we don't want to bounce the email
    }
  },
};
```

6. Click **Deploy**

### Step 3: Configure Email Routing to Use the Worker

1. Go back to **Email** → **Email Routing**
2. Click the **Email Workers** tab
3. Verify your worker `civildefence-email-handler` appears in the list
4. Go to the **Routing rules** tab
5. Click **Create address**
6. Configure a catch-all rule:
   - **Custom address:** `alert-*` (catches all addresses starting with `alert-`)
   - **Action:** Send to a Worker
   - **Destination:** Select `civildefence-email-handler`
7. Click **Save**

Alternatively, for a true catch-all:
- **Custom address:** Leave empty and enable "Catch-all address"
- **Action:** Send to a Worker
- **Destination:** Select `civildefence-email-handler`

### Step 4: Remove the Old MX Record

Since you added an MX record for `alerts` subdomain pointing to SMTP2GO, you need to remove it:

1. Go to **DNS** → **Records**
2. Find the MX record for `alerts` pointing to `inbound.smtp2go.com`
3. Delete it (Cloudflare Email Routing handles this now)

### Step 5: Verify DNS Configuration

After setup, your DNS should show:

```bash
dig MX civildefence.pro
```

Expected output:
```
civildefence.pro.  300  IN  MX  3 route3.mx.cloudflare.net.
civildefence.pro.  300  IN  MX  5 route2.mx.cloudflare.net.
civildefence.pro.  300  IN  MX  84 route1.mx.cloudflare.net.
```

---

## Testing the Setup

### 1. Check Your Alert Rule

Your existing rule should work:
- **Trigger Email:** `alert-0a861d03-dw3xac@civildefence.pro`

### 2. View Worker Logs (Real-time Debugging)

1. In Cloudflare, go to **Workers & Pages** → `civildefence-email-handler`
2. Click **Logs** → **Begin log stream**
3. Keep this tab open while testing

### 3. Send a Test Email

Send an email from Gmail, Outlook, or another provider:

```
To: alert-0a861d03-dw3xac@civildefence.pro
Subject: Test Alert from Email
Body: This is a test alert triggered by email.
```

### 4. Check the Logs

In the Worker logs, you should see:
- "Email forwarded successfully" if it worked
- Error details if something failed

### 5. Verify in the App

- Check **Alert History** in your community
- Verify the rule's trigger count increased

---

## Email Subject Prefixes

You can override the default alert settings using special prefixes in the email subject:

| Prefix | Behavior |
|--------|----------|
| `[OVERRIDE]` | Uses email subject as title, body as message |
| `[WARNING]` | Sets alert level to "warning" + uses email content |
| `[EMERGENCY]` | Sets alert level to "danger" (critical) + uses email content |

### Examples

```
Subject: [WARNING] Flood Warning for Northern Region
Body: A flood warning has been issued. Please move to higher ground.
```

This will create a WARNING level alert with the subject as the title.

```
Subject: [EMERGENCY] Evacuation Required - Fire
Body: Immediate evacuation required. Proceed to designated assembly points.
```

This will create a DANGER (critical) level alert.

---

## Troubleshooting

### "No recipient email found" Error

This means the Worker isn't sending the `to` field correctly. Check:
1. Worker code has `to: to` in the JSON body
2. The email address format is correct

### Emails Not Triggering

1. **Check Worker logs:**
   - Go to **Workers & Pages** → Your worker → **Logs**
   - Start a log stream and send a test email

2. **Verify Email Routing is active:**
   - Go to **Email** → **Email Routing**
   - Status should show "Active"

3. **Check routing rules:**
   - Ensure your rule matches the email address pattern
   - The worker must be selected as the destination

4. **DNS propagation:**
   - May take up to 48 hours for MX changes
   - Test with: `dig MX civildefence.pro`

### "No active rule found for this email address"

The API couldn't find a matching rule. Check:
1. The trigger email in your rule matches exactly (case-insensitive)
2. The rule is active (enabled)
3. The trigger type is set to "email"

### Worker Not Receiving Emails

1. **Verify MX records:**
   ```bash
   dig MX civildefence.pro
   ```
   Should show Cloudflare's MX servers.

2. **Check Email Routing status:**
   Must be "Active" in Cloudflare dashboard.

3. **Try the catch-all:**
   Enable catch-all routing to ensure all emails go to your worker.

### Alert Created But No Notifications

1. **Check recipient configuration:**
   Ensure the recipient group has members with valid contact info.

2. **Verify notification channels:**
   Check that email/SMS/push are properly configured in environment variables.

3. **Check Vercel/deployment logs:**
   Look for errors when sending notifications.

---

## Alternative: Mailgun (If Cloudflare Doesn't Work)

If you need a dedicated email receiving service:

### Step 1: Add Domain in Mailgun

1. Sign up at https://app.mailgun.com
2. Go to **Sending** → **Domains** → **Add New Domain**
3. Add: `alerts.civildefence.pro` (use a subdomain)

### Step 2: Configure DNS in Cloudflare

Add the DNS records Mailgun provides:

| Type | Name | Content | Priority |
|------|------|---------|----------|
| MX | alerts | mxa.mailgun.org | 10 |
| MX | alerts | mxb.mailgun.org | 10 |
| TXT | alerts | `v=spf1 include:mailgun.org ~all` | - |

### Step 3: Create Mailgun Route

1. In Mailgun, go to **Receiving** → **Create Route**
2. Configure:
   - **Expression Type:** Match Recipient
   - **Recipient:** `.*@alerts.civildefence.pro`
   - **Actions:** Forward to `https://civildefence.pro/api/alert-rules/trigger/email`
   - **Priority:** 0
3. Save

### Step 4: Update Alert Rules

Change trigger emails to use the subdomain:
- From: `alert-xxx@civildefence.pro`
- To: `alert-xxx@alerts.civildefence.pro`

---

## Security Considerations

### Rate Limiting

The current implementation doesn't have rate limiting. Consider adding:

```typescript
// In your API route
const RATE_LIMIT_PER_RULE = 10; // alerts per minute
```

### Sender Validation

For production, consider validating the sender:

```typescript
// Only accept from known monitoring systems
const ALLOWED_SENDERS = [
  'alerts@monitoring.example.com',
  'noreply@iot-system.com',
];
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Email Trigger Flow                            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌─────────────────┐     ┌──────────────────────────┐
│  Sender  │────▶│  Sender's Mail  │────▶│  DNS Lookup              │
│  (IoT,   │     │  Server         │     │  MX: civildefence.pro    │
│  System) │     │  (Gmail, etc.)  │     │  → Cloudflare MX servers │
└──────────┘     └─────────────────┘     └────────────┬─────────────┘
                                                      │
                                                      ▼
                                      ┌───────────────────────────────┐
                                      │  Cloudflare Email Routing     │
                                      │  Matches: alert-*@domain      │
                                      └───────────────┬───────────────┘
                                                      │
                                                      ▼
                                      ┌───────────────────────────────┐
                                      │  Cloudflare Worker            │
                                      │  civildefence-email-handler   │
                                      │  Extracts: to, from, subject  │
                                      └───────────────┬───────────────┘
                                                      │
                                                      │ POST JSON
                                                      ▼
                                      ┌───────────────────────────────┐
                                      │  /api/alert-rules/trigger/    │
                                      │  email                        │
                                      │  Looks up rule by trigger_email│
                                      └───────────────┬───────────────┘
                                                      │
                    ┌─────────────────────────────────┼──────────────────────────────┐
                    │                                 │                              │
                    ▼                                 ▼                              ▼
          ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
          │  Email (SMTP2GO)│            │   SMS (Twilio)  │            │  Push (Web Push)│
          │  Notification   │            │   Notification  │            │  Notification   │
          └─────────────────┘            └─────────────────┘            └─────────────────┘
```

---

## Quick Reference

| Setting | Value |
|---------|-------|
| Email Routing | Cloudflare Email Workers |
| Worker Name | `civildefence-email-handler` |
| Routing Rule | `alert-*` → Worker |
| API Endpoint | `https://civildefence.pro/api/alert-rules/trigger/email` |
| Outbound Email | SMTP2GO (unchanged) |

---

## Sources

- [Cloudflare Email Workers Documentation](https://developers.cloudflare.com/email-routing/email-workers/)
- [Route to Workers - Cloudflare Blog](https://blog.cloudflare.com/announcing-route-to-workers/)
- [SMTP2GO Webhooks](https://support.smtp2go.com/hc/en-gb/articles/223087967-Webhooks) (outbound events only)
