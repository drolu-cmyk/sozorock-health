import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../migrations/0017_runtime_login_rotation.sql", import.meta.url),
  "utf8",
);

test("runtime password rotation preserves and verifies the least-privilege role contract", () => {
  assert.match(migration, /SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit/);
  assert.match(migration, /Runtime database role does not satisfy the least-privilege contract/);
  assert.match(migration, /ALTER ROLE evidence_runtime_login PASSWORD %L/);
  assert.doesNotMatch(
    migration,
    /ALTER ROLE evidence_runtime_login[^;]*(?:NOSUPERUSER|NOREPLICATION|NOBYPASSRLS)/,
  );
  assert.match(migration, /REVOKE ALL ON FUNCTION evidence\.configure_runtime_login\(text\) FROM PUBLIC/);
});
