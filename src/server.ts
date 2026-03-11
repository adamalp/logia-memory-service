import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth.js";
import { remember } from "./routes/remember.js";
import { recall } from "./routes/recall.js";
import { reflect } from "./routes/reflect.js";
import { unified } from "./routes/unified.js";
import { register } from "./routes/register.js";

export const app = new Hono();

app.use("*", cors());

// Global error handler — surface real errors instead of "Internal Server Error"
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: err.message }, 500);
});

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "logia-memory" }));

// Registration (no auth required)
app.post("/register", register);

// Memory endpoints (auth required in production)
app.use("/memory", authMiddleware);
app.use("/remember", authMiddleware);
app.use("/recall", authMiddleware);
app.use("/reflect", authMiddleware);

app.post("/remember", remember);
app.post("/recall", recall);
app.post("/reflect", reflect);
app.post("/memory", unified);
