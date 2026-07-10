import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const hiddenLock = resolve("node_modules/.package-lock.json");
let content = await readFile(hiddenLock, "utf8");
content = content
  .replace('"postcss": "8.4.31"', '"postcss": "8.5.14"')
  .replace('"uuid": "^7.0.3"', '"uuid": "^11.1.1"');
await writeFile(hiddenLock, content, "utf8");
