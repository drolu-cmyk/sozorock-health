BEGIN;

CREATE OR REPLACE FUNCTION evidence.configure_runtime_login(runtime_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, evidence
AS $$
DECLARE
  runtime_role record;
BEGIN
  IF length(runtime_password) < 32 THEN
    RAISE EXCEPTION 'Runtime database password does not meet the minimum length.';
  END IF;

  SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit
    INTO runtime_role
    FROM pg_roles
   WHERE rolname = 'evidence_runtime_login';

  IF FOUND THEN
    IF runtime_role.rolsuper
      OR runtime_role.rolcreatedb
      OR runtime_role.rolcreaterole
      OR runtime_role.rolreplication
      OR runtime_role.rolbypassrls
      OR NOT runtime_role.rolinherit THEN
      RAISE EXCEPTION 'Runtime database role does not satisfy the least-privilege contract.';
    END IF;

    -- Aurora's managed administrator is not a PostgreSQL superuser. Password
    -- rotation is permitted, but restating SUPERUSER, REPLICATION, or BYPASSRLS
    -- attributes is not. The contract check above fails closed before rotation.
    EXECUTE format(
      'ALTER ROLE evidence_runtime_login PASSWORD %L',
      runtime_password
    );
  ELSE
    EXECUTE format(
      'CREATE ROLE evidence_runtime_login LOGIN PASSWORD %L INHERIT',
      runtime_password
    );
  END IF;

  EXECUTE 'GRANT evidence_runtime TO evidence_runtime_login';
END;
$$;

REVOKE ALL ON FUNCTION evidence.configure_runtime_login(text) FROM PUBLIC;

COMMIT;
