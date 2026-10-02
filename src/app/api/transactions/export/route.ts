import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/database';

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
  try {
    const supabase = getSupabaseAdmin();
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

    // Build query using Supabase
    let query = supabase
      .from(`${SCHEMA}.transactions_pos_sales`)
      .select(`
        *,
        items:transactions_pos_sales_items (
          line_number, menu_category, menu_category_detail,
          menu_name, menu_code, menu_notes, quantity, unit_price,
          subtotal, discount_amount, total, order_time
        )
      `)
      .order('sales_date', { ascending: false })
      .order('sales_num', { ascending: false })
      .limit(50000);

    if (effectiveDateFrom) {
      query = query.gte('sales_date', effectiveDateFrom);
    }
    if (effectiveDateTo) {
      query = query.lte('sales_date', effectiveDateTo);
    }
    if (branch) {
      query = query.eq('branch_name', branch);
    }

    const { data: headers, error } = await query;

    if (error) {
      console.error('Export error:', error);
      throw error;
    }

    const rows = headers || [];

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

    // Transform to Excel format
    const data = [];
    const uniqueSalesNums = new Set<string>();
    let itemsCount = 0;

    for (const row of rows) {
      uniqueSalesNums.add(row.sales_num);

      // Get items from the joined query or create single row
      const items = row.items || [];

      if (items.length === 0) {
        data.push([
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
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          formatDateTimeValue(row.order_time),
        ]);
      } else {
        for (const item of items) {
          itemsCount++;
          data.push([
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
            item.line_number || '',
            item.menu_category || '',
            item.menu_category_detail || '',
            item.menu_name || '',
            item.menu_code || '',
            item.menu_notes || '',
            item.quantity || '',
            item.unit_price || '',
            item.subtotal || '',
            item.discount_amount || '',
            item.total || '',
            formatDateTimeValue(item.order_time),
          ]);
        }
      }
    }

    return NextResponse.json({
      data,
      headers: EXCEL_HEADERS,
      totalRows: data.length,
      totalHeaders: uniqueSalesNums.size,
      totalItems: itemsCount,
      dateRange: { from: effectiveDateFrom, to: effectiveDateTo },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
