BEGIN;

CREATE OR REPLACE FUNCTION evidence.configure_runtime_login(runtime_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, evidence
AS $$
BEGIN
  IF length(runtime_password) < 32 THEN
    RAISE EXCEPTION 'Runtime database password does not meet the minimum length.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'evidence_runtime_login') THEN
    EXECUTE format(
      'ALTER ROLE evidence_runtime_login PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS',
      runtime_password
    );
  ELSE
    EXECUTE format(
      'CREATE ROLE evidence_runtime_login LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS',
      runtime_password
    );
  END IF;
  EXECUTE 'GRANT evidence_runtime TO evidence_runtime_login';
END;
$$;

REVOKE ALL ON FUNCTION evidence.configure_runtime_login(text) FROM PUBLIC;

COMMIT;
