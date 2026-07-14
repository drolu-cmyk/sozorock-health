import assert from "node:assert/strict";
import test from "node:test";
import { safeProfileName, safeSearchTerm, validGeoidForKind } from "../app/lib/geography-validation.ts";
import { repairPublicDataText } from "../app/lib/text-normalization.ts";

test("preserves official U.S. geography names with diacritics", () => {
  assert.equal(safeSearchTerm("Cañon City"), "CAÑON CITY");
  assert.equal(safeSearchTerm("Doña Ana"), "DOÑA ANA");
  assert.equal(safeProfileName("Cañon City, Colorado"), "Cañon City, Colorado");
  assert.equal(safeProfileName("Doña Ana County"), "Doña Ana County");
});

test("validates geography identifiers by kind", () => {
  assert.equal(validGeoidForKind("state", "06"), true);
  assert.equal(validGeoidForKind("county", "06001"), true);
  assert.equal(validGeoidForKind("place", "0100100"), true);
  assert.equal(validGeoidForKind("zcta", "13753"), true);
  assert.equal(validGeoidForKind("locality", "1304200"), true);
  assert.equal(validGeoidForKind("locality", "2017317375"), true);
  assert.equal(validGeoidForKind("state", "06001"), false);
  assert.equal(validGeoidForKind("place", "13753"), false);
});

test("repairs only provable public-source UTF-8 mojibake", () => {
  assert.equal(repairPublicDataText("CaÃ±on City"), "Cañon City");
  assert.equal(repairPublicDataText("DoÃ±a Ana County"), "Doña Ana County");
  assert.equal(repairPublicDataText("Cañon City"), "Cañon City");
  assert.equal(repairPublicDataText("Añasco Municipio"), "Añasco Municipio");
});
