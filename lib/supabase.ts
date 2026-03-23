import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client — used in React components for Realtime subscriptions (read-only)
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Server client — used in API routes with full permissions
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

// Singleton browser client for use in client components
let browserClientInstance: ReturnType<typeof createClient> | null = null
export function getBrowserClient() {
  if (!browserClientInstance) {
    browserClientInstance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return browserClientInstance
}
