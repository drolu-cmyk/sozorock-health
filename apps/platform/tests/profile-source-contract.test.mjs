import assert from "node:assert/strict";
import test from "node:test";
import { cdcProfileFieldsByKind, cdcProfileSources } from "../app/lib/cdc-profile-contract.ts";

test("uses dataset-specific CDC PLACES profile fields", () => {
  assert.ok(cdcProfileFieldsByKind.place.includes("placefips"));
  assert.ok(cdcProfileFieldsByKind.place.includes("stateabbr"));
  assert.ok(!cdcProfileFieldsByKind.place.includes("countyname"));
  assert.ok(!cdcProfileFieldsByKind.place.includes("zcta5"));
  assert.ok(!cdcProfileFieldsByKind.place.includes("loneliness_crudeprev"));

  assert.ok(cdcProfileFieldsByKind.zcta.includes("zcta5"));
  assert.ok(cdcProfileFieldsByKind.zcta.includes("loneliness_crudeprev"));
  assert.ok(!cdcProfileFieldsByKind.zcta.includes("stateabbr"));
  assert.ok(!cdcProfileFieldsByKind.zcta.includes("placefips"));
});

test("cites the correct CDC source for place and ZCTA profiles", () => {
  assert.equal(cdcProfileSources.place.id, "vgc8-iyc4");
  assert.match(cdcProfileSources.place.label, /Place Data/);
  assert.match(cdcProfileSources.place.url, /vgc8-iyc4$/);
  assert.equal(cdcProfileSources.zcta.id, "kee5-23sr");
  assert.match(cdcProfileSources.zcta.label, /ZCTA Data/);
  assert.match(cdcProfileSources.zcta.url, /kee5-23sr$/);
});

test("has no duplicate field in either upstream contract", () => {
  for (const fields of Object.values(cdcProfileFieldsByKind)) {
    assert.equal(new Set(fields).size, fields.length);
  }
});
