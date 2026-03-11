import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { randomBytes, createHash } from "crypto";

const MEMORY_BASE = process.env.MEMORY_BASE_PATH || "./memory-store";
const AGENTS_FILE = join(MEMORY_BASE, "_agents.json");

interface AgentRecord {
  agentId: string;
  apiKeyHash: string;
  createdAt: string;
}

/**
 * Load the agent registry from disk.
 */
async function loadRegistry(): Promise<AgentRecord[]> {
  if (!existsSync(AGENTS_FILE)) return [];
  const data = await readFile(AGENTS_FILE, "utf-8");
  return JSON.parse(data);
}

async function saveRegistry(agents: AgentRecord[]): Promise<void> {
  await mkdir(MEMORY_BASE, { recursive: true });
  await writeFile(AGENTS_FILE, JSON.stringify(agents, null, 2));
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Register a new agent. Returns the API key (shown once).
 */
export async function registerAgent(
  agentId: string
): Promise<{ apiKey: string } | { error: string }> {
  const safeId = agentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const registry = await loadRegistry();

  if (registry.find((a) => a.agentId === safeId)) {
    return { error: "Agent already registered. Use your existing API key." };
  }

  const apiKey = `lm_${randomBytes(24).toString("hex")}`;

  registry.push({
    agentId: safeId,
    apiKeyHash: hashKey(apiKey),
    createdAt: new Date().toISOString(),
  });

  await saveRegistry(registry);

  return { apiKey };
}

/**
 * Validate an API key and return the associated agentId.
 * Returns null if invalid.
 */
export async function validateApiKey(
  apiKey: string
): Promise<string | null> {
  const registry = await loadRegistry();
  const hashed = hashKey(apiKey);
  const agent = registry.find((a) => a.apiKeyHash === hashed);
  return agent ? agent.agentId : null;
}
