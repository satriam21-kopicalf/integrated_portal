-- =====================================================
-- OPTIMIZATION SCRIPT FOR INTEGRATED PORTAL DASHBOARD
-- =====================================================
-- Run this script in Supabase SQL Editor
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. INDEXES FOR transactions_pos_sales (HEADER TABLE)
-- =====================================================

-- Primary index for date-based queries (most important for 65-day filter)
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_sales_date_desc
ON integration_esb.transactions_pos_sales (sales_date DESC);

-- Composite index for date + branch filtering
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_date_branch
ON integration_esb.transactions_pos_sales (sales_date DESC, branch_name);

-- Composite index for date + status filtering
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_date_status
ON integration_esb.transactions_pos_sales (sales_date DESC, status);

-- Index for sales_num lookups (used in JOIN)
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_sales_num
ON integration_esb.transactions_pos_sales (sales_num);

-- Composite index for cursor pagination
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_cursor
ON integration_esb.transactions_pos_sales (sales_date DESC, sales_num DESC);

-- Index for search queries
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_search
ON integration_esb.transactions_pos_sales (sales_num text_pattern_ops, bill_num text_pattern_ops, branch_name text_pattern_ops);

-- =====================================================
-- 2. INDEXES FOR transactions_pos_sales_items (ITEMS TABLE)
-- =====================================================

-- Primary index for sales_num lookups (most important for JOIN)
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_items_sales_num
ON integration_esb.transactions_pos_sales_items (sales_num);

-- Composite index for ordering
CREATE INDEX IF NOT EXISTS idx_transactions_pos_sales_items_sales_num_line
ON integration_esb.transactions_pos_sales_items (sales_num, line_number);

-- =====================================================
-- 3. ANALYZE TABLES (Update query planner statistics)
-- =====================================================

ANALYZE integration_esb.transactions_pos_sales;
ANALYZE integration_esb.transactions_pos_sales_items;

-- =====================================================
-- 4. VERIFICATION QUERIES
-- =====================================================

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size
FROM pg_tables
WHERE schemaname = 'integration_esb'
  AND tablename IN ('transactions_pos_sales', 'transactions_pos_sales_items')
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- Check data range
SELECT
  'transactions_pos_sales' as table_name,
  MIN(sales_date) as oldest_date,
  MAX(sales_date) as newest_date,
  COUNT(*) as total_rows,
  COUNT(DISTINCT sales_num) as unique_transactions
FROM integration_esb.transactions_pos_sales;

-- Check records in last 65 days
SELECT
  COUNT(*) as records_last_65_days,
  COUNT(DISTINCT sales_num) as transactions_last_65_days
FROM integration_esb.transactions_pos_sales
WHERE sales_date >= CURRENT_DATE - INTERVAL '65 days';

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'integration_esb'
  AND tablename IN ('transactions_pos_sales', 'transactions_pos_sales_items')
ORDER BY tablename, indexname;

-- =====================================================
-- 5. MAINTENANCE (Run periodically)
-- =====================================================

-- REINDEX to rebuild indexes after bulk inserts
-- REINDEX TABLE integration_esb.transactions_pos_sales;
-- REINDEX TABLE integration_esb.transactions_pos_sales_items;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 'Indexes created successfully!' as status;
