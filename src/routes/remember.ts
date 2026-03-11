import type { Context } from "hono";
import { storeMemory } from "../storage/git-memory.js";

export async function remember(c: Context) {
  const body = await c.req.json();
  const { agentId, content, category } = body;

  if (!agentId || !content) {
    return c.json({ error: "agentId and content are required" }, 400);
  }

  const result = await storeMemory(
    agentId,
    content,
    category || "notes"
  );

  return c.json(result);
}
