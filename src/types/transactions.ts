// Transaction types from integration_esb schema
// Combined view: headers + items merged into single rows (like ESB report)

export interface TransactionCombined {
  // Header fields
  sales_num: string;
  bill_num: string;
  sales_type: string;
  batch_order: number;
  table_section: string;
  table_name: string;
  sales_date: string;
  sales_date_in: string;
  sales_date_out: string;
  branch_code: string;
  branch_name: string;
  brand: string;
  city: string;
  area: string;
  visit_purpose: string;
  regular_member_code: string;
  regular_member_name: string;
  loyalty_member_code: string;
  loyalty_member_name: string;
  loyalty_member_type: string;
  employee_code: string;
  employee_name: string;
  external_employee_code: string;
  external_employee_name?: string;
  customer_name: string;
  subtotal: number;
  discount_amount: number;
  service_charge: number;
  tax_amount: number;
  vat_amount: number;
  total_amount: number;
  nett_sales: number;
  dpp: number;
  bill_discount: number;
  total_after_discount: number;
  payment_method: string;
  cash_received: number;
  change_given: number;
  cashier_id: string;
  status: string;
  status_id?: string;
  promotion_id?: string;
  promotion_name: string;
  pax_total: number;
  created_by: string;
  updated_by: string;

  // Item fields (from transactions_pos_sales_items)
  line_number?: number;
  menu_category?: string;
  menu_category_detail?: string;
  menu_name?: string;
  menu_code?: string;
  menu_notes?: string;
  menu_id?: string;
  quantity?: number;
  unit_price?: number;
  original_price?: number;
  subtotal_item?: number;
  discount_item?: number;
  total_item?: number;
  order_time?: string;
  order_mode?: string;
  waiter?: string;
}
