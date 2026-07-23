import assert from "node:assert/strict";
import test from "node:test";
import { splitPostgresStatements } from "../src/operations/sql-splitter.ts";

test("splits PostgreSQL migrations without breaking dollar-quoted blocks", () => {
  const sql = `
    BEGIN;
    CREATE TABLE example (id text);
    DO $$ BEGIN
      PERFORM 'a; b';
    END $$;
    CREATE FUNCTION example_guard() RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN
      RAISE EXCEPTION 'immutable; record';
    END;
    $body$;
    COMMIT;
  `;
  const statements = splitPostgresStatements(sql);
  assert.equal(statements.length, 3);
  assert.match(statements[1], /PERFORM 'a; b'/);
  assert.match(statements[2], /immutable; record/);
  assert.equal(statements.some((statement) => /^(BEGIN|COMMIT)$/i.test(statement)), false);
});

test("retains comments and quoted identifiers without splitting early", () => {
  const statements = splitPostgresStatements(`
    -- semicolon ; in a comment
    SELECT "semi;colon", 'value;still';
    /* another ; comment */
    SELECT 2;
  `);
  assert.equal(statements.length, 2);
});
