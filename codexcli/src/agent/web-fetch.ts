/**
 * Read-only HTTP fetch for grounding on public docs/pages.
 * Truncates large bodies; no JS execution.
 */

import { lookup } from "node:dns/promises";

const DEFAULT_MAX_CHARS = 40_000;
const TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 2_000_000;

export async function webFetch(url: string, maxChars = DEFAULT_MAX_CHARS): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Invalid URL: ${url}`;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `Unsupported protocol: ${parsed.protocol}`;
  }
  if (isBlockedAddress(parsed.hostname)) {
    return "Blocked URL: local and private network addresses are not allowed.";
  }
  try {
    const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
    if (addresses.some(({ address }) => isBlockedAddress(address))) {
      return "Blocked URL: hostname resolves to a local or private network address.";
    }
  } catch {
    return `Fetch failed for ${parsed.toString()}: hostname could not be resolved.`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent":
          "CodexCLI/1.0 (+https://github.com/Suryanshu-Nabheet/CodeX)",
        accept: "text/html,application/xhtml+xml,application/json,text/plain,*/*",
      },
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      return "Redirect blocked; fetch the final public URL directly.";
    }
    const contentType = res.headers.get("content-type") || "";
    const declaredLength = Number(res.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      return `Response too large (limit is ${MAX_RESPONSE_BYTES} bytes).`;
    }
    const reader = res.body?.getReader();
    if (!reader) return "(empty body)";
    const chunks: Array<Uint8Array> = [];
    let totalBytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return `Response too large (limit is ${MAX_RESPONSE_BYTES} bytes).`;
      }
      chunks.push(value);
    }
    const bodyBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder().decode(bodyBytes);
    let body = text;
    if (contentType.includes("html")) {
      body = stripHtml(text);
    }
    body = body.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (body.length > maxChars) {
      body =
        body.slice(0, maxChars) +
        `\n\n… truncated (${body.length} chars total, showing ${maxChars})`;
    }
    return [
      `URL: ${parsed.toString()}`,
      `Status: ${res.status} ${res.statusText}`,
      `Content-Type: ${contentType}`,
      "",
      body || "(empty body)",
    ].join("\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Fetch failed for ${parsed.toString()}: ${msg}`;
  } finally {
    clearTimeout(timer);
  }
}

function isBlockedAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return true;
  if (host.startsWith("::ffff:")) return isBlockedAddress(host.slice(7));
  if (/^(fc|fd)[0-9a-f]{2}:/.test(host) || host.startsWith("fe80:")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length === 4 && octets.every(Number.isInteger) && octets.every((n) => n >= 0 && n <= 255)) {
    const a = octets[0] ?? -1;
    const b = octets[1] ?? -1;
    return a === 0 || a === 10 || a === 100 && b >= 64 && b <= 127 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0) || (a === 192 && b === 168) || (a === 198 && b >= 18 && b <= 19);
  }
  return host.endsWith(".internal") || host.endsWith(".local");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
