import { serve } from "@hono/node-server";
import { app } from "./server.js";

const port = parseInt(process.env.PORT || "3001");

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Logia Memory Service running on http://localhost:${info.port}`);
});
