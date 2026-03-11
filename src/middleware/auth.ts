import type { Context, Next } from "hono";

/**
 * Simple API key auth middleware.
 * In production, validate against a store. For MVP, check against env var.
 * Also extracts agentId from the request body or query.
 */
export async function authMiddleware(c: Context, next: Next) {
  const apiKey = process.env.API_KEY;

  // If API_KEY is set, enforce it
  if (apiKey) {
    const authHeader = c.req.header("Authorization");
    const providedKey =
      c.req.header("X-API-Key") || authHeader?.replace("Bearer ", "");

    if (providedKey !== apiKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }

  await next();
}
