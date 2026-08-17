import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import imageSize from "image-size";
import imageUtils from "image-size/dist/types/utils.js";

const { findBox } = imageUtils;

function writeBox(buffer, offset, size, name) {
  buffer.writeUInt32BE(size, offset);
  buffer.write(name, offset + 4, 4, "ascii");
}

function littleEndianTiff({ ifdOffset = 8 } = {}) {
  const input = Buffer.alloc(38);
  input.write("II", 0, 2, "ascii");
  input.writeUInt16LE(42, 2);
  input.writeUInt32LE(ifdOffset, 4);
  if (ifdOffset === 8) {
    input.writeUInt16LE(2, 8);
    input.writeUInt16LE(256, 10);
    input.writeUInt16LE(4, 12);
    input.writeUInt32LE(1, 14);
    input.writeUInt32LE(1, 18);
    input.writeUInt16LE(257, 22);
    input.writeUInt16LE(4, 24);
    input.writeUInt32LE(1, 26);
    input.writeUInt32LE(1, 30);
    input.writeUInt32LE(0, 34);
  }
  return input;
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

test("TIFF reads metadata from one opened descriptor and rejects out-of-file offsets", () => {
  const directory = mkdtempSync(join(tmpdir(), "sozorock-image-size-"));
  const validPath = join(directory, "valid.tiff");
  const invalidPath = join(directory, "invalid.tiff");
  try {
    writeFileSync(validPath, littleEndianTiff());
    writeFileSync(invalidPath, littleEndianTiff({ ifdOffset: 4096 }));

    assert.deepEqual(imageSize(validPath), { height: 1, type: "tiff", width: 1 });
    assert.throws(() => imageSize(invalidPath), /IFD offset is outside the file/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("valid PNG dimensions still parse", () => {
  const input = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );

  assert.deepEqual(imageSize(input), { height: 1, type: "png", width: 1 });
});
