-- =====================================================
-- OPTIMIZATION: Create optimized views and indexes
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_date 
ON integration_esb.transactions_pos_sales(sales_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_num 
ON integration_esb.transactions_pos_sales(sales_num);

CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_branch 
ON integration_esb.transactions_pos_sales(branch_name);

CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_items_sales_num 
ON integration_esb.transactions_pos_sales_items(sales_num);

CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_composite 
ON integration_esb.transactions_pos_sales(sales_date DESC, sales_num DESC);

-- 2. Create a RECENT transactions view (last 65 days, pre-joined)
CREATE OR REPLACE VIEW integration_esb.v_recent_transactions AS
SELECT 
    h.sales_num,
    h.bill_num,
    h.sales_type,
    h.batch_order,
    h.table_section,
    h.table_name,
    h.sales_date,
    h.sales_date_in,
    h.sales_date_out,
    h.branch_name,
    h.brand,
    h.city,
    h.area,
    h.visit_purpose,
    h.regular_member_code,
    h.regular_member_name,
    h.loyalty_member_type,
    h.employee_code,
    h.employee_name,
    h.customer_name,
    h.payment_method,
    h.subtotal,
    h.discount_amount,
    h.service_charge,
    h.tax_amount,
    h.total_amount,
    h.bill_discount,
    h.cash_received,
    h.change_given,
    h.cashier_id,
    h.status,
    h.pax_total,
    COALESCE(item_counts.item_count, 0) as item_count
FROM integration_esb.transactions_pos_sales h
LEFT JOIN (
    SELECT sales_num, COUNT(*) as item_count 
    FROM integration_esb.transactions_pos_sales_items 
    GROUP BY sales_num
) item_counts ON h.sales_num = item_counts.sales_num
WHERE h.sales_date >= CURRENT_DATE - INTERVAL '65 days'
ORDER BY h.sales_date DESC, h.sales_num DESC;

-- 3. Create a RECENT items view (last 65 days)
CREATE OR REPLACE VIEW integration_esb.v_recent_transactions_items AS
SELECT i.*
FROM integration_esb.transactions_pos_sales_items i
INNER JOIN integration_esb.transactions_pos_sales h ON i.sales_num = h.sales_num
WHERE h.sales_date >= CURRENT_DATE - INTERVAL '65 days'
ORDER BY i.sales_num, i.line_number;

-- 4. Create MATERIALIZED VIEW for even faster access (with REFRESH)
CREATE MATERIALIZED VIEW IF NOT EXISTS integration_esb.mv_transactions_recent AS
SELECT 
    h.*,
    COALESCE(item_counts.item_count, 0) as item_count
FROM integration_esb.transactions_pos_sales h
LEFT JOIN (
    SELECT sales_num, COUNT(*) as item_count 
    FROM integration_esb.transactions_pos_sales_items 
    GROUP BY sales_num
) item_counts ON h.sales_num = item_counts.sales_num
WHERE h.sales_date >= CURRENT_DATE - INTERVAL '65 days';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_transactions_recent_sales_num 
ON integration_esb.mv_transactions_recent(sales_num);

CREATE INDEX IF NOT EXISTS idx_mv_transactions_recent_date 
ON integration_esb.mv_transactions_recent(sales_date DESC);

-- To refresh materialized view: REFRESH MATERIALIZED VIEW integration_esb.mv_transactions_recent;

-- 5. Grant permissions (if needed)
-- GRANT SELECT ON integration_esb.v_recent_transactions TO anon;
-- GRANT SELECT ON integration_esb.v_recent_transactions_items TO anon;
