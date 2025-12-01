import { NextRequest, NextResponse } from 'next/server'
import { sendSms } from '@/lib/sms'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, message } = body

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      )
    }

    console.log('=== SMS TEST ===')
    console.log('Sending SMS to:', to)
    console.log('Message:', message)
    console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'NOT SET')
    console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'NOT SET')
    console.log('TWILIO_MESSAGING_SERVICE_SID:', process.env.TWILIO_MESSAGING_SERVICE_SID ? 'Set' : 'NOT SET')

    const result = await sendSms({ to, message })

    console.log('SMS Result:', result)
    console.log('=== END SMS TEST ===')

    return NextResponse.json(result)
  } catch (error) {
    console.error('SMS test error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'SMS test endpoint ready',
    config: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'NOT SET',
      authToken: process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'NOT SET',
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ? 'Set' : 'NOT SET',
    }
  })
}
