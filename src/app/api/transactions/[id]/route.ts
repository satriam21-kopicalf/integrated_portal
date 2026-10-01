import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awcoxytlmjiyfmpzinam.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
);

const SCHEMA = 'integration_esb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);

    // Get header
    const { data: header, error: headerError } = await supabase
      .from(`${SCHEMA}.transactions_pos_sales`)
      .select('*')
      .eq('sales_num', decodedId)
      .single();

    if (headerError || !header) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from(`${SCHEMA}.transactions_pos_sales_items`)
      .select('*')
      .eq('sales_num', decodedId)
      .order('line_number');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    }

    return NextResponse.json({
      ...header,
      items: items || [],
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}
