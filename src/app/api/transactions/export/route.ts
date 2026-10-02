import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.awcoxytlmjiyfmpzinam',
  password: process.env.DB_PASSWORD || 'Kopicalf2019@@',
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 120000,
  connectionTimeoutMillis: 60000,
});

const SCHEMA = 'integration_esb';
const DEFAULT_DAYS = 65;

const EXCEL_HEADERS = [
  'Sales Number', 'Bill Number', 'Sales Type', 'Batch Order',
  'Table Section', 'Table Name', 'Sales Date', 'Sales Date In', 'Sales Date Out',
  'Branch', 'Brand', 'City', 'Area', 'Visit Purpose',
  'Member Code', 'Member Name', 'Visitor Type',
  'Employee Code', 'Employee Name', 'Customer Name',
  'Payment Method', 'Subtotal', 'Discount Total', 'Service Charge',
  'Tax Total', 'Grand Total', 'Voucher Discount',
  'Cash Received', 'Change Given', 'Cashier', 'Status', 'Pax Total',
  'Line Number', 'Menu Category', 'Menu Category Detail', 'Menu', 'Menu Code', 'Menu Notes',
  'Quantity', 'Unit Price', 'Subtotal Item', 'Discount Item', 'Total Item', 'Order Time',
];

function formatDateValue(value: unknown): string {
  if (!value) return '';
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDateTimeValue(value: unknown): string {
  if (!value) return '';
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function POST(request: NextRequest) {
  let client;

  try {
    client = await pool.connect();
    const { dateFrom, dateTo, branch } = await request.json();

    // Calculate default date range
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;

    if (!effectiveDateFrom && !effectiveDateTo) {
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_DAYS);
      effectiveDateFrom = defaultFrom.toISOString().slice(0, 10);
      effectiveDateTo = new Date().toISOString().slice(0, 10);
    }

    // Build where clause - use simple date string comparison
    let whereClause = 'WHERE 1=1';
    const params: string[] = [];
    let paramCount = 0;

    if (effectiveDateFrom) {
      paramCount++;
      whereClause += ` AND TO_CHAR(h.sales_date, 'YYYY-MM-DD') >= $${paramCount}`;
      params.push(effectiveDateFrom);
    }
    if (effectiveDateTo) {
      paramCount++;
      whereClause += ` AND TO_CHAR(h.sales_date, 'YYYY-MM-DD') <= $${paramCount}`;
      params.push(effectiveDateTo);
    }
    if (branch) {
      paramCount++;
      whereClause += ` AND h.branch_name = $${paramCount}`;
      params.push(branch);
    }

    console.log('Export params:', params);
    console.log('Where clause:', whereClause);

    const headersQuery = `
      SELECT h.sales_num, h.bill_num, h.sales_type, h.batch_order,
             h.table_section, h.table_name, h.sales_date, h.sales_date_in, h.sales_date_out,
             h.branch_name, h.brand, h.city, h.area, h.visit_purpose,
             h.regular_member_code, h.regular_member_name, h.loyalty_member_type,
             h.employee_code, h.employee_name, h.customer_name,
             h.payment_method, h.subtotal, h.discount_amount, h.service_charge,
             h.tax_amount, h.total_amount, h.bill_discount,
             h.cash_received, h.change_given, h.cashier_id, h.status, h.pax_total,
             i.line_number, i.menu_category, i.menu_category_detail,
             i.menu_name, i.menu_code, i.menu_notes, i.quantity, i.unit_price,
             i.subtotal as item_subtotal, i.discount_amount as item_discount,
             i.total as item_total, i.order_time
      FROM ${SCHEMA}.transactions_pos_sales h
      LEFT JOIN ${SCHEMA}.transactions_pos_sales_items i ON h.sales_num = i.sales_num
      ${whereClause}
      ORDER BY h.sales_date DESC, h.sales_num DESC, COALESCE(i.line_number, 0) ASC
      LIMIT 50000
    `;

    const startTime = Date.now();
    const headersResult = await client.query(headersQuery, params);
    const rows = headersResult.rows;
    console.log(`Export query completed in ${Date.now() - startTime}ms, ${rows.length} rows`);

    if (rows.length === 0) {
      return NextResponse.json({
        data: [],
        headers: EXCEL_HEADERS,
        totalRows: 0,
        totalHeaders: 0,
        totalItems: 0,
        dateRange: { from: effectiveDateFrom, to: effectiveDateTo },
      });
    }

    const data = rows.map(row => [
      row.sales_num || '',
      row.bill_num || '',
      row.sales_type || '',
      row.batch_order || 0,
      row.table_section || '',
      row.table_name || '',
      formatDateValue(row.sales_date),
      formatDateTimeValue(row.sales_date_in),
      formatDateTimeValue(row.sales_date_out),
      row.branch_name || '',
      row.brand || '',
      row.city || '',
      row.area || '',
      row.visit_purpose || '',
      row.regular_member_code || '',
      row.regular_member_name || '',
      row.loyalty_member_type || '',
      row.employee_code || '',
      row.employee_name || '',
      row.customer_name || '',
      row.payment_method || '',
      parseFloat(row.subtotal || 0),
      parseFloat(row.discount_amount || 0),
      parseFloat(row.service_charge || 0),
      parseFloat(row.tax_amount || 0),
      parseFloat(row.total_amount || 0),
      parseFloat(row.bill_discount || 0),
      parseFloat(row.cash_received || 0),
      parseFloat(row.change_given || 0),
      row.cashier_id || '',
      row.status || '',
      row.pax_total || 0,
      row.line_number || '',
      row.menu_category || '',
      row.menu_category_detail || '',
      row.menu_name || '',
      row.menu_code || '',
      row.menu_notes || '',
      row.quantity || '',
      row.unit_price || '',
      row.item_subtotal || '',
      row.item_discount || '',
      row.item_total || '',
      formatDateTimeValue(row.order_time),
    ]);

    const uniqueSalesNums = new Set(rows.map(r => r.sales_num));
    const itemsCount = rows.filter(r => r.line_number).length;

    return NextResponse.json({
      data,
      headers: EXCEL_HEADERS,
      totalRows: data.length,
      totalHeaders: uniqueSalesNums.size,
      totalItems: itemsCount,
      dateRange: { from: effectiveDateFrom, to: effectiveDateTo },
    });

  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
