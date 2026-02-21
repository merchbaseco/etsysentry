-- PostgreSQL initialization script for EtsySentry
-- This script provisions database/user privileges. Drizzle migrations manage table schemas.

SELECT 'CREATE DATABASE etsysentry'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'etsysentry')\gexec

\c etsysentry

DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = 'etsysentry'
   ) THEN
      CREATE USER etsysentry WITH PASSWORD 'etsysentry_local_dev_password';
   END IF;
END
$do$;

GRANT ALL PRIVILEGES ON DATABASE etsysentry TO etsysentry;
GRANT ALL ON SCHEMA public TO etsysentry;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO etsysentry;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO etsysentry;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO etsysentry;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO etsysentry;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO etsysentry;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO etsysentry;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\echo 'PostgreSQL initialization completed successfully'
\echo 'Database: etsysentry'
\echo 'User: etsysentry'
\echo 'Extensions: uuid-ossp, pgcrypto'
\echo 'Ready for Drizzle migrations...'
