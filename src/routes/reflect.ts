import type { Context } from "hono";
import { reflectMemory } from "../storage/git-memory.js";

export async function reflect(c: Context) {
  const body = await c.req.json();
  const { agentId } = body;

  if (!agentId) {
    return c.json({ error: "agentId is required" }, 400);
  }

  const reflection = await reflectMemory(agentId);
  return c.json(reflection);
}
