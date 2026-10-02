import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = await params;
    const decodedId = decodeURIComponent(id);

    // Get header
    const { data: header, error: headerError } = await supabase
      .from('integration_esb.transactions_pos_sales')
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
      .from('integration_esb.transactions_pos_sales_items')
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
