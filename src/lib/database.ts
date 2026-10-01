import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awcoxytlmjiyfmpzinam.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3Y294eXRsbWppeWZtcHppbmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NzU4MjQsImV4cCI6MjEwNTI1MTgyNH0.BZjEHPvNvIOgN_8NQFb5p7oAT-vuWfRXsRoFa8yzqu0';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Direct PostgreSQL connection using Session Pooler (faster)
export const dbConfig = {
  host: process.env.NEXT_PUBLIC_DB_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: parseInt(process.env.NEXT_PUBLIC_DB_PORT || '5432'),
  database: process.env.NEXT_PUBLIC_DB_NAME || 'postgres',
  user: process.env.NEXT_PUBLIC_DB_USER || 'postgres.awcoxytlmjiyfmpzinam',
  password: process.env.NEXT_PUBLIC_DB_PASSWORD || 'Kopicalf2019@@',
};

export const SCHEMA = 'integration_esb';
