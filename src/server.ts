import { Hono } from "hono";
import { cors } from "hono/cors";
import { remember } from "./routes/remember.js";
import { recall } from "./routes/recall.js";
import { reflect } from "./routes/reflect.js";
import { unified } from "./routes/unified.js";

export const app = new Hono();

app.use("*", cors());

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "logia-memory" }));

// Individual endpoints
app.post("/remember", remember);
app.post("/recall", recall);
app.post("/reflect", reflect);

// Unified endpoint for Join39 (single tool, action param)
app.post("/memory", unified);
