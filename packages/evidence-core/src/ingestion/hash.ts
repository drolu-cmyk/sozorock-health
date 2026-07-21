import { createHash } from "node:crypto";

export function sha256(value: string | Uint8Array) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function deterministicId(namespace: string, ...parts: Array<string | number | null>) {
  return createHash("sha256")
    .update([namespace, ...parts.map((part) => String(part ?? ""))].join("\u001f"))
    .digest("hex");
}

export function deterministicUuid(namespace: string, ...parts: Array<string | number | null>) {
  const hex = deterministicId(namespace, ...parts);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
