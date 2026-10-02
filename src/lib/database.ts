import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create Supabase client for API routes with service role key
// This allows access to all data including service operations
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awcoxytlmjiyfmpzinam.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3Y294eXRtbWppeWZtcHppbmFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTY3NTgyNCwiZXhwIjoyMTA1MjUxODI0fQ.R1TnOBwfVcunW5hxpMIZVZal6-VIPAR3qLAyLgOs5fc',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Schema name
export const SCHEMA = 'integration_esb';
export const TABLE_TRANSACTIONS = `${SCHEMA}.transactions_pos_sales`;
export const TABLE_ITEMS = `${SCHEMA}.transactions_pos_sales_items`;
