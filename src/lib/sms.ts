/**
 * SMS sending functionality using Twilio
 */

interface SmsOptions {
  to: string
  message: string
}

interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an SMS message using Twilio
 */
export async function sendSms({ to, message }: SmsOptions): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

  if (!accountSid || !authToken || !messagingServiceSid) {
    console.error('Missing Twilio configuration:', {
      accountSid: !!accountSid,
      authToken: !!authToken,
      messagingServiceSid: !!messagingServiceSid,
    })
    return { success: false, error: 'SMS service not configured' }
  }

  // Format phone number - ensure it has country code
  let formattedPhone = to.replace(/\s+/g, '').replace(/[^\d+]/g, '')

  // If doesn't start with +, assume it's a NZ number
  if (!formattedPhone.startsWith('+')) {
    // Remove leading 0 if present
    if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1)
    }
    formattedPhone = `+64${formattedPhone}`
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const body = new URLSearchParams({
      To: formattedPhone,
      MessagingServiceSid: messagingServiceSid,
      Body: message,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    })

    const data = await response.json()

    if (response.ok) {
      console.log(`SMS sent successfully to ${formattedPhone}, SID: ${data.sid}`)
      return { success: true, messageId: data.sid }
    } else {
      console.error('Twilio API error:', data)
      return { success: false, error: data.message || 'Failed to send SMS' }
    }
  } catch (error) {
    console.error('Error sending SMS:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Format an alert message for SMS
 * SMS has 160 character limit for standard messages
 */
export function formatAlertSms(params: {
  communityName: string
  alertLevel: 'info' | 'warning' | 'danger'
  title: string
  message: string
}): string {
  const { communityName, alertLevel, title, message } = params

  const levelEmoji = {
    info: '',
    warning: '⚠️ ',
    danger: '🚨 ',
  }

  const prefix = `${levelEmoji[alertLevel]}${communityName}: `
  const fullMessage = `${prefix}${title}\n${message}`

  // Truncate if too long (SMS has limits)
  if (fullMessage.length > 1600) {
    return fullMessage.substring(0, 1597) + '...'
  }

  return fullMessage
}
