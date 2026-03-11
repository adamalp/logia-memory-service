import type { Context } from "hono";
import { storeMemory, searchMemory, reflectMemory } from "../storage/git-memory.js";

const MAX_RESPONSE_CHARS = 1900; // Stay under Join39's 2000 char limit

/**
 * Truncate a JSON-serializable response to fit within Join39's char limit.
 */
function truncateResponse(data: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(data);
  if (json.length <= MAX_RESPONSE_CHARS) return data;

  // For recall results, trim matches
  if (Array.isArray(data.results)) {
    const trimmed = { ...data, results: [] as unknown[] };
    for (const result of data.results as { file: string; matches: string[] }[]) {
      const entry = { file: result.file, matches: [] as string[] };
      for (const match of result.matches) {
        const next = JSON.stringify({ ...trimmed, results: [...(trimmed.results as unknown[]), { ...entry, matches: [...entry.matches, match] }] });
        if (next.length > MAX_RESPONSE_CHARS) break;
        entry.matches.push(match);
      }
      if (entry.matches.length > 0) (trimmed.results as unknown[]).push(entry);
    }
    return trimmed;
  }

  // For reflect, trim commits list
  if (Array.isArray(data.recentCommits)) {
    const trimmed = { ...data };
    const commits = data.recentCommits as unknown[];
    while (JSON.stringify(trimmed).length > MAX_RESPONSE_CHARS && commits.length > 1) {
      commits.pop();
    }
    trimmed.recentCommits = commits;
    return trimmed;
  }

  return data;
}

/**
 * Resolve agentId. Priority:
 * 1. Verified agentId from auth middleware (when REQUIRE_AUTH=true)
 * 2. Body param (dev mode / unauthenticated)
 */
function getAgentId(c: Context, body: Record<string, unknown>): string | null {
  // If auth middleware verified the key, trust that agentId
  const verified = c.get("verifiedAgentId") as string | undefined;
  if (verified) return verified;

  return (body.agentId as string) || null;
}

/**
 * Unified endpoint for Join39 — single tool with action parameter.
 */
export async function unified(c: Context) {
  const body = await c.req.json();
  const { action, content, category } = body;
  const agentId = getAgentId(c, body);

  if (!agentId) {
    return c.json({ error: "agentId is required (pass in body or X-Agent-Username header)" }, 400);
  }

  switch (action) {
    case "remember": {
      if (!content) {
        return c.json({ error: "content is required for remember" }, 400);
      }
      const result = await storeMemory(agentId, content, category || "notes");
      return c.json(truncateResponse(result as unknown as Record<string, unknown>));
    }

    case "recall": {
      if (!content) {
        return c.json({ error: "content (search query) is required for recall" }, 400);
      }
      const results = await searchMemory(agentId, content, category);
      if (results.length === 0) {
        return c.json({ results: [], message: "No memories found matching your query." });
      }
      return c.json(truncateResponse({ results }));
    }

    case "reflect": {
      const reflection = await reflectMemory(agentId);
      return c.json(truncateResponse(reflection as unknown as Record<string, unknown>));
    }

    default:
      return c.json(
        { error: `Unknown action "${action}". Use: remember, recall, or reflect.` },
        400
      );
  }
}
