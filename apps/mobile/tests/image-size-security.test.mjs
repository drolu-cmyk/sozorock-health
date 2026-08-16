import assert from "node:assert/strict";
import test from "node:test";

import imageSize from "image-size";
import imageUtils from "image-size/dist/types/utils.js";

const { findBox } = imageUtils;

function writeBox(buffer, offset, size, name) {
  buffer.writeUInt32BE(size, offset);
  buffer.write(name, offset + 4, 4, "ascii");
}

test("malformed ICNS entries with zero length are rejected", () => {
  const input = Buffer.alloc(16);
  input.write("icns", 0, 4, "ascii");
  input.writeUInt32BE(input.length, 4);
  input.write("ic07", 8, 4, "ascii");
  input.writeUInt32BE(0, 12);

  assert.throws(() => imageSize(input), /Invalid ICNS entry length/);
});

test("zero-sized JXL and HEIF boxes stop box scanning", () => {
  const input = Buffer.alloc(24);
  writeBox(input, 0, 0, "junk");
  writeBox(input, 8, 16, "ftyp");
  input.write("jxl ", 16, 4, "ascii");

  assert.equal(findBox(input, "ftyp", 0), undefined);
});

test("valid PNG dimensions still parse", () => {
  const input = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );

  assert.deepEqual(imageSize(input), { height: 1, type: "png", width: 1 });
});
