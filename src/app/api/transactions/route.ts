import { NextRequest, NextResponse } from 'next/server';
import { Pool, QueryResult } from 'pg';

// =====================================================
// OPTIMIZED DATABASE CONFIGURATION
// Using Session Pooler for better connection performance
// =====================================================

// Session Pooler connection (faster from Southeast Asia)
const pool = new Pool({
  host: process.env.DB_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.awcoxytlmjiyfmpzinam',
  password: process.env.DB_PASSWORD || 'Kopicalf2019@@',
  ssl: { rejectUnauthorized: false },
  // Connection pool settings
  max: 5,                       // Limit concurrent connections
  idleTimeoutMillis: 20000,      // Close idle connections after 20s
  connectionTimeoutMillis: 30000, // Connection timeout 30s
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

const SCHEMA = 'integration_esb';
const DEFAULT_DAYS = 65;

// =====================================================
// IN-MEMORY CACHE (Simple TTL Cache)
// =====================================================

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

// Clean expired cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now >= entry.expiry) {
      cache.delete(key);
    }
  }
}, 300000);

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface SalesHeader {
  sales_num: string;
  bill_num: string | null;
  sales_date: Date;
  branch_name: string | null;
  brand: string | null;
  city: string | null;
  area: string | null;
  visit_purpose: string | null;
  sales_type: string | null;
  batch_order: number | null;
  table_section: string | null;
  table_name: string | null;
  sales_date_in: Date | null;
  sales_date_out: Date | null;
  regular_member_code: string | null;
  regular_member_name: string | null;
  loyalty_member_type: string | null;
  employee_code: string | null;
  employee_name: string | null;
  customer_name: string | null;
  payment_method: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  service_charge: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  bill_discount: number | null;
  cash_received: number | null;
  change_given: number | null;
  cashier_id: string | null;
  status: string | null;
  pax_total: number | null;
  [key: string]: unknown;
}

interface SalesItem {
  sales_num: string;
  line_number: number;
  menu_category: string | null;
  menu_category_detail: string | null;
  menu_name: string | null;
  menu_code: string | null;
  menu_notes: string | null;
  quantity: number | null;
  unit_price: number | null;
  subtotal: number | null;
  discount_amount: number | null;
  total: number | null;
  order_time: Date | null;
  [key: string]: unknown;
}

// Selective columns query (avoids fetching unnecessary data)
const HEADER_COLUMNS = `
  sales_num, bill_num, sales_type, batch_order,
  table_section, table_name, sales_date,
  sales_date_in, sales_date_out, branch_name,
  brand, city, area, visit_purpose,
  regular_member_code, regular_member_name, loyalty_member_type,
  employee_code, employee_name, customer_name,
  payment_method, subtotal, discount_amount, service_charge,
  tax_amount, total_amount, bill_discount,
  cash_received, change_given, cashier_id, status, pax_total
`;

const ITEM_COLUMNS = `
  sales_num, line_number, menu_category, menu_category_detail,
  menu_name, menu_code, menu_notes,
  quantity, unit_price, subtotal, discount_amount, total, order_time
`;

// =====================================================
// API HANDLER
// =====================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const client = await pool.connect();

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const branch = searchParams.get('branch') || '';
    const useCache = searchParams.get('cache') !== 'false'; // Default to use cache

    // Calculate default date range
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;

    if (!effectiveDateFrom && !effectiveDateTo) {
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_DAYS);
      effectiveDateFrom = defaultFrom.toISOString().slice(0, 10);
      effectiveDateTo = new Date().toISOString().slice(0, 10);
    }

    // Helper to convert date string to proper format for PostgreSQL
    const formatDateForDB = (dateStr: string) => {
      return dateStr + 'T00:00:00.000Z';
    };

    // Helper to get next day for inclusive date range
    const getNextDay = (dateStr: string) => {
      const date = new Date(dateStr + 'T00:00:00.000Z');
      date.setDate(date.getDate() + 1);
      return date.toISOString().slice(0, 10);
    };

    // Check cache for non-search queries (without cursor)
    if (useCache && !search && !cursor && !branch && limit === 50) {
      const cacheKey = `transactions:${effectiveDateFrom}:${effectiveDateTo}:${limit}`;
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`Cache hit for ${cacheKey}`);
        return NextResponse.json(cached, {
          headers: { 'X-Cache': 'HIT', 'X-Response-Time': `${Date.now() - startTime}ms` }
        });
      }
    }

    // Build query with selective columns
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramCount = 0;

    if (effectiveDateFrom) {
      paramCount++;
      whereClause += ` AND sales_date >= $${paramCount}`;
      params.push(formatDateForDB(effectiveDateFrom));
    }
    if (effectiveDateTo) {
      paramCount++;
      whereClause += ` AND sales_date < $${paramCount}`;
      params.push(getNextDay(effectiveDateTo));
    }
    if (cursor) {
      const [cursorDate, cursorNum] = cursor.split('|||');
      paramCount++;
      whereClause += ` AND (sales_date < $${paramCount} OR (sales_date = $${paramCount} AND sales_num < $${paramCount + 1}))`;
      params.push(cursorDate, cursorNum);
    }
    if (search) {
      paramCount++;
      whereClause += ` AND (sales_num ILIKE $${paramCount} OR bill_num ILIKE $${paramCount} OR branch_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    if (branch) {
      paramCount++;
      whereClause += ` AND branch_name = $${paramCount}`;
      params.push(branch);
    }

    // Query headers with selective columns (use VIEW if available, fallback to table)
    const headersQuery = `
      SELECT ${HEADER_COLUMNS}
      FROM ${SCHEMA}.transactions_pos_sales
      ${whereClause}
      ORDER BY sales_date DESC, sales_num DESC
      LIMIT ${limit + 1}
    `;

    const headersResult: QueryResult<SalesHeader> = await client.query(headersQuery, params);
    const headers = headersResult.rows;
    const hasMore = headers.length > limit;
    const resultData = hasMore ? headers.slice(0, limit) : headers;

    if (resultData.length === 0) {
      const response = {
        data: [],
        pagination: { cursor: null, hasMore: false, limit },
        summary: {
          totalRows: 0,
          totalHeaders: 0,
          totalItems: 0,
          totalRevenue: 0,
          totalTransactions: 0,
          avgTransactionValue: 0
        },
        dateRange: { from: effectiveDateFrom, to: effectiveDateTo }
      };
      return NextResponse.json(response);
    }

    // Get items (only for visible headers)
    const salesNums = resultData.map((h: SalesHeader) => h.sales_num);
    const itemsQuery = `
      SELECT ${ITEM_COLUMNS}
      FROM ${SCHEMA}.transactions_pos_sales_items
      WHERE sales_num = ANY($1)
      ORDER BY sales_num, line_number
    `;
    const itemsResult: QueryResult<SalesItem> = await client.query(itemsQuery, [salesNums]);

    // Group items by sales_num
    const itemsBySales = new Map<string, SalesItem[]>();
    for (const item of itemsResult.rows) {
      if (!itemsBySales.has(item.sales_num)) {
        itemsBySales.set(item.sales_num, []);
      }
      itemsBySales.get(item.sales_num)!.push(item);
    }

    // Merge header + items
    const combinedData = [];
    for (const header of resultData) {
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

    // Calculate summary statistics
    const uniqueHeadersMap = new Map<string, { total: number }>();
    for (const row of resultData) {
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

    // Next cursor
    let nextCursor = null;
    if (hasMore && resultData.length > 0) {
      const last = resultData[resultData.length - 1];
      const cursorDate = last.sales_date instanceof Date
        ? last.sales_date.toISOString().slice(0, 10)
        : String(last.sales_date).slice(0, 10);
      nextCursor = `${cursorDate}|||${last.sales_num}`;
    }

    const uniqueHeaders = new Set(resultData.map((h: SalesHeader) => h.sales_num));
    const responseTime = Date.now() - startTime;

    const response = {
      data: combinedData,
      pagination: { cursor: nextCursor, hasMore, limit },
      summary: {
        totalRows: combinedData.length,
        totalHeaders: uniqueHeaders.size,
        totalItems: itemsResult.rows.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTransactions,
        avgTransactionValue: Math.round(avgTransactionValue * 100) / 100
      },
      dateRange: { from: effectiveDateFrom, to: effectiveDateTo }
    };

    // Cache non-search results
    if (useCache && !search && !cursor && !branch && limit === 50) {
      const cacheKey = `transactions:${effectiveDateFrom}:${effectiveDateTo}:${limit}`;
      setCache(cacheKey, response, 60); // Cache for 60 seconds
      console.log(`Cached ${cacheKey} for 60s`);
    }

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('PG Error:', error);
    return NextResponse.json(
      { error: 'Database query failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  } finally {
    client.release(); // Always release client back to pool
  }
}
