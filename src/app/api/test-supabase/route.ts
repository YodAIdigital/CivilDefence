import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  console.log('=== SUPABASE ENV TEST ===')
  console.log('URL:', url ? `Set (${url})` : 'NOT SET')
  console.log('Service Key:', serviceKey ? `Set (length: ${serviceKey.length})` : 'NOT SET')
  console.log('Anon Key:', anonKey ? `Set (length: ${anonKey.length})` : 'NOT SET')

  // Check for whitespace issues
  const rawServiceKey = process.env.SUPABASE_SERVICE_KEY
  if (rawServiceKey && rawServiceKey !== rawServiceKey.trim()) {
    console.log('WARNING: Service key has leading/trailing whitespace!')
  }

  const results: Record<string, unknown> = {
    url: url || 'NOT SET',
    serviceKeyLength: serviceKey?.length || 0,
    anonKeyLength: anonKey?.length || 0,
  }

  if (!url) {
    return NextResponse.json({
      error: 'Missing NEXT_PUBLIC_SUPABASE_URL',
      ...results,
    })
  }

  // Test 1: Try with anon key first (this should always work for public data)
  if (anonKey) {
    try {
      console.log('Testing with ANON key...')
      const anonClient = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })

      const { data: anonData, error: anonError } = await anonClient
        .from('communities')
        .select('id, name')
        .limit(1)

      results.anonKeyTest = {
        success: !anonError,
        error: anonError?.message,
        code: anonError?.code,
        dataCount: anonData?.length || 0,
      }
      console.log('Anon key test result:', results.anonKeyTest)
    } catch (err) {
      results.anonKeyTest = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  } else {
    results.anonKeyTest = { skipped: true, reason: 'No anon key configured' }
  }

  // Test 2: Try with service key
  if (serviceKey) {
    try {
      console.log('Testing with SERVICE key...')
      const serviceClient = createClient(url, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })

      const { data: serviceData, error: serviceError } = await serviceClient
        .from('communities')
        .select('id, name')
        .limit(1)

      results.serviceKeyTest = {
        success: !serviceError,
        error: serviceError?.message,
        code: serviceError?.code,
        hint: serviceError?.hint,
        dataCount: serviceData?.length || 0,
      }
      console.log('Service key test result:', results.serviceKeyTest)
    } catch (err) {
      results.serviceKeyTest = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  } else {
    results.serviceKeyTest = { skipped: true, reason: 'No service key configured' }
  }

  // Overall success
  const anonSuccess = (results.anonKeyTest as Record<string, unknown>)?.success === true
  const serviceSuccess = (results.serviceKeyTest as Record<string, unknown>)?.success === true

  return NextResponse.json({
    overallSuccess: anonSuccess && serviceSuccess,
    anonKeyWorks: anonSuccess,
    serviceKeyWorks: serviceSuccess,
    details: results,
  })
}
