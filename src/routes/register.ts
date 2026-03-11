import type { Context } from "hono";
import { registerAgent } from "../storage/agents.js";

export async function register(c: Context) {
  const body = await c.req.json();
  const { agentId } = body;

  if (!agentId) {
    return c.json({ error: "agentId is required" }, 400);
  }

  // Validate agentId format
  if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
    return c.json(
      { error: "agentId must be alphanumeric with hyphens/underscores only" },
      400
    );
  }

  const result = await registerAgent(agentId);
  if ("error" in result) {
    return c.json(result, 409);
  }

  return c.json({
    message: `Agent "${agentId}" registered. Save your API key — it won't be shown again.`,
    apiKey: result.apiKey,
  });
}
