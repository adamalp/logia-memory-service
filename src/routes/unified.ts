import type { Context } from "hono";
import { storeMemory, searchMemory, reflectMemory } from "../storage/git-memory.js";

/**
 * Unified endpoint for Join39 — single tool with action parameter.
 * This is what the Join39 function definition routes to.
 */
export async function unified(c: Context) {
  const body = await c.req.json();
  const { agentId, action, content, category } = body;

  if (!agentId) {
    return c.json({ error: "agentId is required" }, 400);
  }

  switch (action) {
    case "remember": {
      if (!content) {
        return c.json({ error: "content is required for remember" }, 400);
      }
      const result = await storeMemory(agentId, content, category || "notes");
      return c.json(result);
    }

    case "recall": {
      if (!content) {
        return c.json({ error: "content (search query) is required for recall" }, 400);
      }
      const results = await searchMemory(agentId, content, category);
      if (results.length === 0) {
        return c.json({ results: [], message: "No memories found matching your query." });
      }
      return c.json({ results });
    }

    case "reflect": {
      const reflection = await reflectMemory(agentId);
      return c.json(reflection);
    }

    default:
      return c.json(
        { error: `Unknown action "${action}". Use: remember, recall, or reflect.` },
        400
      );
  }
}
