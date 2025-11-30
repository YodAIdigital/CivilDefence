import { NextResponse } from 'next/server'

export async function GET() {
  // Check all required configurations
  const config = {
    // Supabase
    supabase: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: !!process.env.SUPABASE_SERVICE_KEY,
      serviceKeyLength: process.env.SUPABASE_SERVICE_KEY?.length || 0,
    },
    // SMTP
    smtp: {
      host: !!process.env.SMTP_HOST,
      port: !!process.env.SMTP_PORT,
      user: !!process.env.SMTP_USER,
      password: !!process.env.SMTP_PASSWORD,
      fromEmail: process.env.SMTP_FROM_EMAIL || 'not set',
      fromName: process.env.SMTP_FROM_NAME || 'not set',
    },
    // Twilio
    twilio: {
      accountSid: !!process.env.TWILIO_ACCOUNT_SID,
      authToken: !!process.env.TWILIO_AUTH_TOKEN,
      messagingServiceSid: !!process.env.TWILIO_MESSAGING_SERVICE_SID,
      // Show partial values for debugging (first 4 chars)
      accountSidPreview: process.env.TWILIO_ACCOUNT_SID?.substring(0, 6) || 'not set',
      messagingServiceSidPreview: process.env.TWILIO_MESSAGING_SERVICE_SID?.substring(0, 6) || 'not set',
    },
  }

  const allConfigured = {
    supabaseReady: config.supabase.url && config.supabase.anonKey && config.supabase.serviceKey && config.supabase.serviceKeyLength > 100,
    smtpReady: config.smtp.host && config.smtp.user && config.smtp.password,
    twilioReady: config.twilio.accountSid && config.twilio.authToken && config.twilio.messagingServiceSid,
  }

  return NextResponse.json({
    ...allConfigured,
    details: config,
  })
}
