import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database';

const SCHEMA = 'integration_esb';

// Cache for branches (5 minutes)
let branchesCache: { data: { branch_name: string; count: number }[]; expiry: number } | null = null;

export async function GET() {
  try {
    // Check cache first
    if (branchesCache && Date.now() < branchesCache.expiry) {
      return NextResponse.json(branchesCache.data);
    }

    const supabase = getSupabaseAdmin();

    // Get unique branches with transaction count (last 65 days) using raw SQL for aggregation
    const { data, error } = await supabase
      .from(`${SCHEMA}.transactions_pos_sales`)
      .select('branch_name')
      .gte('sales_date', new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .not('branch_name', 'is', null)
      .not('branch_name', 'eq', '');

    if (error) {
      throw error;
    }

    // Count branches locally
    const branchCounts = new Map<string, number>();
    for (const row of data || []) {
      if (row.branch_name) {
        branchCounts.set(row.branch_name, (branchCounts.get(row.branch_name) || 0) + 1);
      }
    }

    // Sort by count descending, then name ascending
    const sortedBranches = Array.from(branchCounts.entries())
      .map(([branch_name, count]) => ({ branch_name, count }))
      .sort((a, b) => b.count - a.count || a.branch_name.localeCompare(b.branch_name));

    // Cache for 5 minutes
    branchesCache = {
      data: sortedBranches,
      expiry: Date.now() + 5 * 60 * 1000
    };

    return NextResponse.json(sortedBranches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branches' },
      { status: 500 }
    );
  }
}
