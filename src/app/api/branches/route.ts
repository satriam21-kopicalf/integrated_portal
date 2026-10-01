import { NextResponse } from 'next/server';
import { Pool, QueryResult } from 'pg';

// Session Pooler connection
const pool = new Pool({
  host: process.env.DB_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.awcoxytlmjiyfmpzinam',
  password: process.env.DB_PASSWORD || 'Kopicalf2019@@',
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 15000,
});

const SCHEMA = 'integration_esb';

// Cache for branches
let branchesCache: { data: { branch_name: string; count: number }[]; expiry: number } | null = null;

export async function GET() {
  try {
    // Check cache first
    if (branchesCache && Date.now() < branchesCache.expiry) {
      return NextResponse.json(branchesCache.data);
    }

    const client = await pool.connect();
    try {
      // Get unique branches with transaction count (last 65 days)
      const result: QueryResult = await client.query(`
        SELECT
          branch_name,
          COUNT(*) as count
        FROM ${SCHEMA}.transactions_pos_sales
        WHERE sales_date >= CURRENT_DATE - INTERVAL '65 days'
          AND branch_name IS NOT NULL
          AND branch_name != ''
        GROUP BY branch_name
        ORDER BY count DESC, branch_name ASC
      `);

      const data = result.rows.map(row => ({
        branch_name: row.branch_name,
        count: parseInt(row.count)
      }));

      // Cache for 5 minutes
      branchesCache = {
        data,
        expiry: Date.now() + 5 * 60 * 1000
      };

      return NextResponse.json(data);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branches' },
      { status: 500 }
    );
  }
}
