import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, TABLE_TRANSACTIONS, TABLE_ITEMS } from '@/lib/database';

const DEFAULT_DAYS = 65;

// Cache
interface CacheEntry {
  data: unknown;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttlSeconds: number = 60): void {
  cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now >= entry.expiry) {
      cache.delete(key);
    }
  }
}, 300000);

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const branch = searchParams.get('branch') || '';
    const useCache = searchParams.get('cache') !== 'false';

    // Calculate default date range
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;

    if (!effectiveDateFrom && !effectiveDateTo) {
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_DAYS);
      effectiveDateFrom = defaultFrom.toISOString().slice(0, 10);
      effectiveDateTo = new Date().toISOString().slice(0, 10);
    }

    // Cache key
    const cacheKey = `transactions:${effectiveDateFrom}:${effectiveDateTo}:${search}:${branch}:${limit}`;

    // Check cache
    if (useCache && !cursor && !search && !branch) {
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`Cache hit`);
        return NextResponse.json(cached, {
          headers: { 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now() - startTime}ms` }
        });
      }
    }

    // Build query using Supabase
    let query = supabase
      .from(TABLE_TRANSACTIONS)
      .select('*')
      .order('sales_date', { ascending: false })
      .order('sales_num', { ascending: false })
      .limit(limit);

    // Apply filters
    if (effectiveDateFrom) {
      query = query.gte('sales_date', effectiveDateFrom);
    }
    if (effectiveDateTo) {
      query = query.lte('sales_date', effectiveDateTo);
    }
    if (branch) {
      query = query.eq('branch_name', branch);
    }
    if (search) {
      query = query.or(`sales_num.ilike.%25${search}%25,bill_num.ilike.%25${search}%25,branch_name.ilike.%25${search}%25`);
    }

    console.log('Query params:', { effectiveDateFrom, effectiveDateTo, branch, search });
    const { data: headers, error: headersError } = await query;

    if (headersError) {
      console.error('Headers error:', headersError);
      throw headersError;
    }

    const headersList = headers || [];
    const hasMore = headersList.length === limit;

    if (headersList.length === 0) {
      const response = {
        data: [],
        pagination: { cursor: null, hasMore: false, limit },
        summary: { totalRows: 0, totalHeaders: 0, totalItems: 0, totalRevenue: 0, totalTransactions: 0, avgTransactionValue: 0 },
        dateRange: { from: effectiveDateFrom, to: effectiveDateTo }
      };
      return NextResponse.json(response);
    }

    // Get items
    const salesNums = headersList.map(h => h.sales_num);
    const { data: items, error: itemsError } = await supabase
      .from(TABLE_ITEMS)
      .select('*')
      .in('sales_num', salesNums)
      .order('sales_num')
      .order('line_number');

    if (itemsError) {
      console.error('Items error:', itemsError);
    }

    // Group items
    const itemsBySales = new Map<string, typeof items>();
    if (items) {
      for (const item of items) {
        if (!itemsBySales.has(item.sales_num)) {
          itemsBySales.set(item.sales_num, []);
        }
        itemsBySales.get(item.sales_num)!.push(item);
      }
    }

    // Merge header + items
    const combinedData = [];
    for (const header of headersList) {
      const headerItems = itemsBySales.get(header.sales_num) || [];
      if (headerItems.length === 0) {
        combinedData.push({
          ...header,
          line_number: null,
          menu_name: null,
          quantity: null,
          unit_price: null,
          total_item: null
        });
      } else {
        for (const item of headerItems) {
          combinedData.push({
            ...header,
            line_number: item.line_number,
            menu_category: item.menu_category,
            menu_name: item.menu_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_item: item.total
          });
        }
      }
    }

    // Calculate summary
    const uniqueHeadersMap = new Map<string, { total: number }>();
    for (const row of headersList) {
      const total = parseFloat(String(row.total_amount || 0));
      if (uniqueHeadersMap.has(row.sales_num)) {
        uniqueHeadersMap.get(row.sales_num)!.total += total;
      } else {
        uniqueHeadersMap.set(row.sales_num, { total });
      }
    }

    const totalRevenue = Array.from(uniqueHeadersMap.values()).reduce((sum, h) => sum + h.total, 0);
    const totalTransactions = uniqueHeadersMap.size;
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Generate next cursor
    let nextCursor = null;
    if (hasMore && headersList.length > 0) {
      const last = headersList[headersList.length - 1];
      const cursorDate = last.sales_date instanceof Date
        ? last.sales_date.toISOString().slice(0, 10)
        : String(last.sales_date).slice(0, 10);
      nextCursor = `${cursorDate}|||${last.sales_num}`;
    }

    const uniqueHeaders = new Set(headersList.map(h => h.sales_num));
    const responseTime = Date.now() - startTime;

    const response = {
      data: combinedData,
      pagination: { cursor: nextCursor, hasMore, limit },
      summary: {
        totalRows: combinedData.length,
        totalHeaders: uniqueHeaders.size,
        totalItems: items?.length || 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTransactions,
        avgTransactionValue: Math.round(avgTransactionValue * 100) / 100
      },
      dateRange: { from: effectiveDateFrom, to: effectiveDateTo }
    };

    // Cache first page
    if (useCache && !cursor && !search && !branch) {
      setCache(cacheKey, response, 60);
    }

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
