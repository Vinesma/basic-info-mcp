// Web search over a self-hosted SearXNG instance via its JSON API.
// Dependency-free: uses the global fetch API (Node >= 18).

export interface SearchParams {
  query: string;
  categories?: string;
  language?: string;
  pageno?: number;
  time_range?: "day" | "month" | "year";
  safesearch?: 0 | 1 | 2;
  max_results: number;
}

interface SearxResult {
  url?: string;
  title?: string;
  content?: string;
  engine?: string;
  thumbnail?: string;
}

interface SearxResponse {
  query?: string;
  results?: SearxResult[];
  unresponsive_engines?: string[];
  number_of_results?: number;
}

export async function webSearch(url: string, params: SearchParams): Promise<string> {
  const base = new URL(url);
  base.pathname = "/search";
  base.searchParams.set("q", params.query);
  base.searchParams.set("format", "json");

  if (params.categories) {
    base.searchParams.set("categories", params.categories);
  }
  if (params.language) {
    base.searchParams.set("language", params.language);
  }
  if (params.pageno && params.pageno > 1) {
    base.searchParams.set("pageno", String(params.pageno));
  }
  if (params.time_range) {
    base.searchParams.set("time_range", params.time_range);
  }
  if (params.safesearch !== undefined) {
    base.searchParams.set("safesearch", String(params.safesearch));
  }

  let response: Response;
  try {
    response = await fetch(base.href, { method: "GET" });
  } catch (err) {
    throw new Error(`SearXNG request failed: ${base.href} (${(err as Error).message})`, {
      cause: err,
    });
  }

  let data: SearxResponse;
  try {
    const body = await response.text();
    data = JSON.parse(body);
  } catch (err) {
    throw new Error(`SearXNG response was not valid JSON (${(err as Error).message}).`, {
      cause: err,
    });
  }

  const results = (data.results ?? []).slice(0, params.max_results);
  if (results.length === 0) {
    return "No results found.";
  }

  const parts = results.map((r, i) => {
    const title = (r.title ?? "").trim();
    const content = (r.content ?? "").trim();
    const line = [
      `${i + 1}. ${title || "(untitled)"}`,
      r.url ? `   URL: ${r.url}` : "",
      content ? `   ${content}` : "",
    ].filter(Boolean);
    return line.join("\n");
  });

  const tail: string[] = [];
  if (data.unresponsive_engines?.length) {
    tail.push(`Unresponsive engines: ${data.unresponsive_engines.join(", ")}`);
  }

  return [...parts, ...tail].join("\n");
}
