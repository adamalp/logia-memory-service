import type { Context } from "hono";
import { searchMemory } from "../storage/git-memory.js";

export async function recall(c: Context) {
  const body = await c.req.json();
  const { agentId, content, category } = body;

  if (!agentId || !content) {
    return c.json({ error: "agentId and content (search query) are required" }, 400);
  }

  const results = await searchMemory(agentId, content, category);

  if (results.length === 0) {
    return c.json({
      results: [],
      message: "No memories found matching your query.",
    });
  }

  return c.json({ results });
}
