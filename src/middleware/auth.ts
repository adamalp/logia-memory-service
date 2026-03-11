import type { Context, Next } from "hono";
import { validateApiKey } from "../storage/agents.js";

/**
 * Auth middleware for memory endpoints.
 * Validates the API key and injects the verified agentId into the request.
 *
 * If REQUIRE_AUTH=false (or unset in dev), allows unauthenticated access
 * but still requires agentId in the body.
 */
export async function authMiddleware(c: Context, next: Next) {
  const requireAuth = process.env.REQUIRE_AUTH === "true";

  if (!requireAuth) {
    await next();
    return;
  }

  // Extract API key from header
  const authHeader = c.req.header("Authorization");
  const apiKey =
    c.req.header("X-API-Key") ||
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (!apiKey) {
    return c.json(
      { error: "API key required. Pass via X-API-Key header or Authorization: Bearer <key>" },
      401
    );
  }

  const agentId = await validateApiKey(apiKey);
  if (!agentId) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  // Inject verified agentId so the route can trust it
  c.set("verifiedAgentId", agentId);
  await next();
}
