import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awcoxytlmjiyfmpzinam.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
);

const SCHEMA = 'integration_esb';
const DEFAULT_DAYS = 65;

// Excel column headers matching ESB report format
const EXCEL_HEADERS = [
  'Sales Number',
  'Bill Number',
  'Sales Type',
  'Batch Order',
  'Table Section',
  'Table Name',
  'Sales Date',
  'Sales Date In',
  'Sales Date Out',
  'Branch',
  'Brand',
  'City',
  'Area',
  'Visit Purpose',
  'Member Code',
  'Member Name',
  'Visitor Type',
  'Employee Code',
  'Employee Name',
  'Customer Name',
  'Payment Method',
  'Subtotal',
  'Discount Total',
  'Service Charge',
  'Tax Total',
  'Grand Total',
  'Voucher Discount',
  'Cash Received',
  'Change Given',
  'Cashier',
  'Status',
  'Pax Total',
  'Line Number',
  'Menu Category',
  'Menu Category Detail',
  'Menu',
  'Menu Code',
  'Menu Notes',
  'Quantity',
  'Unit Price',
  'Subtotal Item',
  'Discount Item',
  'Total Item',
  'Order Time',
];

export async function POST(request: NextRequest) {
  try {
    const { dateFrom, dateTo, branch, status } = await request.json();

    // Calculate default date range if not specified
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;

    if (!effectiveDateFrom && !effectiveDateTo) {
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_DAYS);
      effectiveDateFrom = defaultFrom.toISOString().slice(0, 10);
      effectiveDateTo = new Date().toISOString().slice(0, 10);
    }

    // Build query for headers
    let query = supabase
      .from(`${SCHEMA}.transactions_pos_sales`)
      .select('*');

    if (effectiveDateFrom) {
      query = query.gte('sales_date', effectiveDateFrom);
    }

    if (effectiveDateTo) {
      query = query.lte('sales_date', effectiveDateTo);
    }

    if (branch) {
      query = query.eq('branch_name', branch);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: headers, error: headersError } = await query.order('sales_date', { ascending: false });

    if (headersError) {
      throw headersError;
    }

    if (!headers || headers.length === 0) {
      return NextResponse.json({
        data: [],
        headers: EXCEL_HEADERS,
        totalRows: 0,
        totalHeaders: 0,
        totalItems: 0,
        dateRange: {
          from: effectiveDateFrom,
          to: effectiveDateTo,
        },
      });
    }

    // Get items for all transactions
    const salesNums = headers.map(h => h.sales_num);

    const { data: items, error: itemsError } = await supabase
      .from(`${SCHEMA}.transactions_pos_sales_items`)
      .select('*')
      .in('sales_num', salesNums)
      .order('sales_num')
      .order('line_number');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    }

    // Group items by sales_num
    const itemsBySales = new Map<string, typeof items>();
    if (items) {
      for (const item of items) {
        if (!itemsBySales.has(item.sales_num)) {
          itemsBySales.set(item.sales_num, []);
        }
        itemsBySales.get(item.sales_num)!.push(item);
      }
    }

    // Create combined data rows matching Excel format
    const combinedData = [];

    for (const header of headers) {
      const headerItems = itemsBySales.get(header.sales_num) || [];

      if (headerItems.length === 0) {
        // No items - create single row
        combinedData.push([
          header.sales_num || '',
          header.bill_num || '',
          header.sales_type || '',
          header.batch_order || 0,
          header.table_section || '',
          header.table_name || '',
          header.sales_date ? new Date(header.sales_date).toISOString().slice(0, 10) : '',
          header.sales_date_in ? new Date(header.sales_date_in).toISOString().slice(0, 19).replace('T', ' ') : '',
          header.sales_date_out ? new Date(header.sales_date_out).toISOString().slice(0, 19).replace('T', ' ') : '',
          header.branch_name || '',
          header.brand || '',
          header.city || '',
          header.area || '',
          header.visit_purpose || '',
          header.regular_member_code || '',
          header.regular_member_name || '',
          header.loyalty_member_type || '',
          header.employee_code || '',
          header.employee_name || '',
          header.customer_name || '',
          header.payment_method || '',
          header.subtotal || 0,
          header.discount_amount || 0,
          header.service_charge || 0,
          header.tax_amount || 0,
          header.total_amount || 0,
          header.bill_discount || 0,
          header.cash_received || 0,
          header.change_given || 0,
          header.cashier_id || '',
          header.status || '',
          header.pax_total || 0,
          '', // Line Number
          '', // Menu Category
          '', // Menu Category Detail
          '', // Menu
          '', // Menu Code
          '', // Menu Notes
          '', // Quantity
          '', // Unit Price
          '', // Subtotal Item
          '', // Discount Item
          '', // Total Item
          '', // Order Time
        ]);
      } else {
        // Create one row per item
        for (const item of headerItems) {
          combinedData.push([
            header.sales_num || '',
            header.bill_num || '',
            header.sales_type || '',
            header.batch_order || 0,
            header.table_section || '',
            header.table_name || '',
            header.sales_date ? new Date(header.sales_date).toISOString().slice(0, 10) : '',
            header.sales_date_in ? new Date(header.sales_date_in).toISOString().slice(0, 19).replace('T', ' ') : '',
            header.sales_date_out ? new Date(header.sales_date_out).toISOString().slice(0, 19).replace('T', ' ') : '',
            header.branch_name || '',
            header.brand || '',
            header.city || '',
            header.area || '',
            header.visit_purpose || '',
            header.regular_member_code || '',
            header.regular_member_name || '',
            header.loyalty_member_type || '',
            header.employee_code || '',
            header.employee_name || '',
            header.customer_name || '',
            header.payment_method || '',
            header.subtotal || 0,
            header.discount_amount || 0,
            header.service_charge || 0,
            header.tax_amount || 0,
            header.total_amount || 0,
            header.bill_discount || 0,
            header.cash_received || 0,
            header.change_given || 0,
            header.cashier_id || '',
            header.status || '',
            header.pax_total || 0,
            item.line_number || '',
            item.menu_category || '',
            item.menu_category_detail || '',
            item.menu_name || '',
            item.menu_code || '',
            item.menu_notes || '',
            item.quantity || 0,
            item.unit_price || 0,
            item.subtotal || 0,
            item.discount_amount || 0,
            item.total || 0,
            item.order_time ? new Date(item.order_time).toISOString().slice(0, 19).replace('T', ' ') : '',
          ]);
        }
      }
    }

    return NextResponse.json({
      data: combinedData,
      headers: EXCEL_HEADERS,
      totalRows: combinedData.length,
      totalHeaders: headers.length,
      totalItems: items?.length || 0,
      dateRange: {
        from: effectiveDateFrom,
        to: effectiveDateTo,
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
