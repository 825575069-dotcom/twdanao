-- ============================================================
-- YesGo PostgreSQL 初始化脚本
-- 预建 public 和 platform schema，以及默认租户 Schema 模板
-- ============================================================

-- 确保 public schema 存在
CREATE SCHEMA IF NOT EXISTS public;

-- 平台管理库（预留）
CREATE SCHEMA IF NOT EXISTS platform;

-- 预建演示��户 Schema
CREATE SCHEMA IF NOT EXISTS tenant_demo;
CREATE SCHEMA IF NOT EXISTS tenant_pharma_a;
CREATE SCHEMA IF NOT EXISTS tenant_pharma_b;

-- 在每个租户 Schema 中设置 search_path（后续 Django migration 会填充表）
DO $$
DECLARE
    sch TEXT;
BEGIN
    FOR sch IN
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        EXECUTE format('ALTER DATABASE %I SET search_path TO %I, public', current_database(), sch);
    END LOOP;
END $$;
