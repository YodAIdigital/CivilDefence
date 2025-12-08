# Email-Triggered Notifications Setup Guide

This guide explains how to set up inbound email routing so that emails sent to unique addresses can automatically trigger alerts in CivilDefencePro.

## Overview

The system works as follows:

1. Each alert rule can have a unique trigger email address (e.g., `alert-abc123@alerts.civildefence.pro`)
2. When an email is sent to that address, your email provider forwards it as a webhook to your app
3. The app's `/api/alert-rules/trigger/email` endpoint processes the email and triggers the alert
4. Notifications are sent via app, email, and/or SMS based on the rule configuration

## Prerequisites

- A domain you control (e.g., `civildefence.pro`)
- Access to Cloudflare DNS (for managing DNS records)
- SMTP2GO account (you already have this for outbound email)
- Your CivilDefencePro app deployed and accessible via HTTPS

---

## Option A: SMTP2GO Inbound Email (Recommended)

SMTP2GO supports inbound email routing, which keeps everything in one provider.

### Step 1: Enable Inbound Processing in SMTP2GO

1. Log in to your SMTP2GO dashboard at https://app.smtp2go.com
2. Navigate to **Settings** → **Inbound**
3. Click **Add Inbound Domain**
4. Enter your subdomain: `alerts.civildefence.pro`

### Step 2: Configure DNS Records in Cloudflare

1. Log in to Cloudflare dashboard
2. Select your domain (`civildefence.pro`)
3. Go to **DNS** → **Records**
4. Add the following MX records:

| Type | Name | Mail server | Priority | Proxy status |
|------|------|-------------|----------|--------------|
| MX | alerts | inbound.smtp2go.com | 10 | DNS only (gray cloud) |

**Important:** MX records cannot be proxied through Cloudflare. Ensure the proxy is disabled (gray cloud icon).

5. Optionally, add SPF record for the subdomain:

| Type | Name | Content | Proxy status |
|------|------|---------|--------------|
| TXT | alerts | `v=spf1 include:spf.smtp2go.com ~all` | DNS only |

### Step 3: Configure Webhook Forwarding in SMTP2GO

1. In SMTP2GO, go to **Settings** → **Inbound** → **Webhooks**
2. Click **Add Webhook**
3. Configure:
   - **URL:** `https://civildefence.pro/api/alert-rules/trigger/email`
   - **Events:** Select "Inbound Email"
   - **Format:** JSON
4. Save the webhook

### Step 4: Verify DNS Propagation

Wait 5-30 minutes for DNS propagation, then verify:

```bash
# Check MX records
dig MX alerts.civildefence.pro

# Expected output should show:
# alerts.civildefence.pro.  300  IN  MX  10 inbound.smtp2go.com.
```

---

## Option B: Cloudflare Email Routing + Workers

If you prefer to use Cloudflare's native email routing:

### Step 1: Enable Email Routing in Cloudflare

1. In Cloudflare dashboard, select your domain
2. Go to **Email** → **Email Routing**
3. Click **Get started** if not already enabled
4. Cloudflare will automatically add the required MX and TXT records

### Step 2: Create a Cloudflare Worker

Create a new Worker to forward emails to your API:

1. Go to **Workers & Pages** → **Create application** → **Create Worker**
2. Name it `email-alert-forwarder`
3. Replace the code with:

```javascript
export default {
  async email(message, env, ctx) {
    // Extract email details
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get("subject") || "";

    // Read the email body
    const reader = message.raw.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const rawEmail = new TextDecoder().decode(
      new Uint8Array(chunks.flat())
    );

    // Extract plain text body (simplified - you may want to parse MIME properly)
    let textBody = rawEmail;
    const textMatch = rawEmail.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\r\n)/);
    if (textMatch) {
      textBody = textMatch[1];
    }

    // Forward to your API
    const response = await fetch("https://civildefence.pro/api/alert-rules/trigger/email", {
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
    });

    if (!response.ok) {
      console.error("Failed to forward email:", await response.text());
    }
  },
};
```

4. Deploy the Worker

### Step 3: Configure Email Routing Rules

1. Go to **Email** → **Email Routing** → **Routing rules**
2. Click **Create address**
3. Add a catch-all rule for your alerts subdomain:
   - **Custom address:** `*@alerts.civildefence.pro`
   - **Action:** Send to Worker
   - **Destination:** Select `email-alert-forwarder`
4. Save

---

## Option C: Mailgun (Alternative)

If you prefer Mailgun for more robust email parsing:

### Step 1: Add Domain in Mailgun

1. Sign up/login at https://app.mailgun.com
2. Go to **Sending** → **Domains** → **Add New Domain**
3. Add: `alerts.civildefence.pro`

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
   - **Actions:**
     - Check "Forward"
     - URL: `https://civildefence.pro/api/alert-rules/trigger/email`
   - **Priority:** 0
3. Save

---

## Testing the Setup

### 1. Create an Alert Rule in the App

1. Go to your community's **Manage** page
2. Expand **Alert Rules**
3. Click **Create New Rule**
4. Configure:
   - **Trigger Type:** Email
   - **Trigger Email:** Enter your unique email (e.g., `alert-test123@alerts.civildefence.pro`)
   - **Alert Title:** Test Alert
   - **Alert Level:** Info
   - **Recipients:** Select a group
   - **Notification Channels:** Enable at least one

### 2. Send a Test Email

Send an email to your trigger address:

```
To: alert-test123@alerts.civildefence.pro
Subject: Test Alert from Email
Body: This is a test alert triggered by email.
```

### 3. Verify the Alert

- Check the **Alert History** in your community
- Verify notifications were received via the enabled channels
- Check the rule's trigger count increased

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

### Emails Not Being Received

1. **Check DNS propagation:**
   ```bash
   dig MX alerts.civildefence.pro
   ```
   Ensure MX records are correct.

2. **Check Cloudflare proxy status:**
   MX records must have proxy disabled (gray cloud).

3. **Test with a simple email:**
   Send from a different email provider (Gmail, Outlook) to rule out sender issues.

### Webhook Not Triggering

1. **Check your email provider's logs:**
   - SMTP2GO: Settings → Inbound → Activity
   - Mailgun: Logs → Inbound
   - Cloudflare: Workers → Logs

2. **Verify webhook URL is correct:**
   Ensure HTTPS and correct path: `/api/alert-rules/trigger/email`

3. **Check app logs:**
   Look for errors in your deployment logs (Vercel, etc.)

### Alert Created But No Notifications

1. **Check recipient configuration:**
   Ensure the recipient group has members with valid contact info.

2. **Verify notification channels:**
   Check that email/SMS/push are properly configured in `.env`.

3. **Check individual channel settings:**
   - Email: SMTP settings in `.env`
   - SMS: Twilio credentials
   - Push: VAPID keys and service worker

---

## Security Considerations

### Rate Limiting

Consider implementing rate limiting on the email trigger endpoint to prevent abuse:

```typescript
// Example: Add to your API route
const RATE_LIMIT = 10; // alerts per minute per rule
```

### Email Validation

The system currently accepts emails from any sender. For additional security:

1. **Whitelist senders:** Only accept emails from known addresses
2. **Verify SPF/DKIM:** Check email authentication headers
3. **Add a secret token:** Include a verification token in the trigger email address

### Webhook Signature Verification

If using Mailgun, verify webhook signatures:

```typescript
import crypto from 'crypto';

function verifyMailgunSignature(timestamp: string, token: string, signature: string, apiKey: string) {
  const data = timestamp + token;
  const hash = crypto.createHmac('sha256', apiKey).update(data).digest('hex');
  return hash === signature;
}
```

---

## Environment Variables Reference

Ensure these are set in your `.env` file:

```bash
# Outbound Email (SMTP2GO)
SMTP_HOST=mail-au.smtp2go.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM_EMAIL=noreply@civildefence.pro
SMTP_FROM_NAME=CivilDefencePro

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid

# Push Notifications
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=your_vapid_public_key
WEB_PUSH_PRIVATE_KEY=your_vapid_private_key
WEB_PUSH_EMAIL=admin@civildefence.pro
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Email Flow                               │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  Sender  │────▶│  Email Provider │────▶│  DNS (Cloudflare)    │
│  (IoT,   │     │  (Gmail, etc.)  │     │  MX: alerts.domain   │
│  System) │     └─────────────────┘     └──────────┬───────────┘
└──────────┘                                        │
                                                    ▼
                                    ┌───────────────────────────┐
                                    │  Inbound Email Service    │
                                    │  (SMTP2GO / Cloudflare /  │
                                    │   Mailgun)                │
                                    └─────────────┬─────────────┘
                                                  │
                                                  │ Webhook POST
                                                  ▼
                                    ┌───────────────────────────┐
                                    │  /api/alert-rules/        │
                                    │  trigger/email            │
                                    └─────────────┬─────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
          ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
          │  Email (SMTP)   │          │   SMS (Twilio)  │          │  Push (Web Push)│
          │  Notification   │          │   Notification  │          │  Notification   │
          └─────────────────┘          └─────────────────┘          └─────────────────┘
```

---

## Next Steps

1. Choose an inbound email provider (SMTP2GO recommended for simplicity)
2. Configure DNS records in Cloudflare
3. Set up webhook forwarding
4. Create your first email-triggered alert rule
5. Test with a sample email
6. Consider adding rate limiting and sender validation for production
