/**
 * Read-only HTTP fetch for grounding on public docs/pages.
 * Truncates large bodies; no JS execution.
 */

const DEFAULT_MAX_CHARS = 40_000;
const TIMEOUT_MS = 20_000;

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
      redirect: "follow",
    });
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
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
