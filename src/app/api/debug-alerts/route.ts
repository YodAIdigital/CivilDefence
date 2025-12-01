import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Check what's in alert_recipients for this user
  const { data: recipients, error: recipientsError } = await supabase
    .from('alert_recipients')
    .select('*')
    .eq('user_id', userId)

  // Check all alerts
  const { data: alerts, error: alertsError } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  // Try the exact same query the dashboard uses
  const { data: dashboardQuery, error: dashboardError } = await supabase
    .from('alert_recipients')
    .select(`
      alert_id,
      alerts (
        id,
        title,
        content,
        level,
        community_id,
        is_active,
        created_at,
        communities (
          name
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    userId,
    recipients: {
      count: recipients?.length || 0,
      data: recipients,
      error: recipientsError?.message
    },
    alerts: {
      count: alerts?.length || 0,
      data: alerts,
      error: alertsError?.message
    },
    dashboardQuery: {
      count: dashboardQuery?.length || 0,
      data: dashboardQuery,
      error: dashboardError?.message
    }
  })
}
