import nodemailer from 'nodemailer'

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  try {
    const fromName = process.env.SMTP_FROM_NAME || 'CivilDefence'
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@civildefence.app'

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    })

    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

// Email templates
export function getCommunityInvitationEmail(params: {
  communityName: string
  inviterName: string
  role: string
  inviteUrl: string
  expiresAt: string
}): { subject: string; html: string } {
  const { communityName, inviterName, role, inviteUrl, expiresAt } = params

  const subject = `You've been invited to join ${communityName} on CivilDefence`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Community Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #000542; padding: 30px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <div style="width: 50px; height: 50px; position: relative;">
                      <span style="font-size: 50px; color: #FEB100;">&#x1F6E1;</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 28px; font-weight: bold; color: #ffffff;">Civil</span><span style="font-size: 28px; font-weight: bold; color: #FEB100;">Defence</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; color: #000542;">You're Invited!</h1>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                <strong>${inviterName}</strong> has invited you to join <strong>${communityName}</strong> as a <strong>${role}</strong>.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #374151;">
                CivilDefence helps communities coordinate emergency preparedness and response. Join now to access emergency response plans, community events, and important contacts.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 30px;">
                <tr>
                  <td style="background-color: #000542; border-radius: 8px;">
                    <a href="${inviteUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #6b7280;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px; font-size: 14px; line-height: 1.6; color: #3b82f6; word-break: break-all;">
                <a href="${inviteUrl}" style="color: #3b82f6;">${inviteUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                This invitation expires on ${expiresAt}. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                &copy; ${new Date().getFullYear()} CivilDefence. Community-based emergency coordination.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  return { subject, html }
}

export function getWelcomeEmail(params: {
  userName: string
  loginUrl: string
}): { subject: string; html: string } {
  const { userName, loginUrl } = params

  const subject = `Welcome to CivilDefence!`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CivilDefence</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #000542; padding: 30px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <span style="font-size: 50px; color: #FEB100;">&#x1F6E1;</span>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 28px; font-weight: bold; color: #ffffff;">Civil</span><span style="font-size: 28px; font-weight: bold; color: #FEB100;">Defence</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; color: #000542;">Welcome, ${userName}!</h1>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                Thank you for joining CivilDefence. You're now part of a community dedicated to emergency preparedness and coordination.
              </p>

              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #374151;">
                Here's what you can do:
              </p>

              <ul style="margin: 0 0 30px; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #374151;">
                <li>Join or create local communities</li>
                <li>Access emergency response plans</li>
                <li>Stay updated with community events</li>
                <li>Find important emergency contacts</li>
                <li>Build your emergency kit checklist</li>
              </ul>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 30px;">
                <tr>
                  <td style="background-color: #000542; border-radius: 8px;">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                &copy; ${new Date().getFullYear()} CivilDefence. Community-based emergency coordination.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  return { subject, html }
}

export function getCommunityAlertEmail(params: {
  communityName: string
  senderName: string
  alertLevel: 'info' | 'warning' | 'danger'
  title: string
  message: string
}): { subject: string; html: string } {
  const { communityName, senderName, alertLevel, title, message } = params

  const levelConfig = {
    info: {
      label: 'General Announcement',
      color: '#22c55e',
      bgColor: '#dcfce7',
      icon: '&#x2139;',
    },
    warning: {
      label: 'Warning',
      color: '#f59e0b',
      bgColor: '#fef3c7',
      icon: '&#x26A0;',
    },
    danger: {
      label: 'Emergency',
      color: '#ef4444',
      bgColor: '#fee2e2',
      icon: '&#x1F6A8;',
    },
  }

  const config = levelConfig[alertLevel]
  const subject = `[${config.label}] ${title} - ${communityName}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Community Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #000542; padding: 30px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <span style="font-size: 50px; color: #FEB100;">&#x1F6E1;</span>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 28px; font-weight: bold; color: #ffffff;">Civil</span><span style="font-size: 28px; font-weight: bold; color: #FEB100;">Defence</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Level Banner -->
          <tr>
            <td style="background-color: ${config.bgColor}; padding: 16px 30px; border-left: 4px solid ${config.color};">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: middle; width: 40px;">
                    <span style="font-size: 24px;">${config.icon}</span>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 14px; font-weight: 600; color: ${config.color}; text-transform: uppercase; letter-spacing: 0.5px;">${config.label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                From <strong>${communityName}</strong>
              </p>

              <h1 style="margin: 0 0 24px; font-size: 24px; color: #000542;">${title}</h1>

              <div style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${message}</div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

              <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                Sent by ${senderName} on behalf of ${communityName}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                &copy; ${new Date().getFullYear()} CivilDefence. Community-based emergency coordination.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  return { subject, html }
}
