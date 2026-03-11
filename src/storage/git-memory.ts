import { simpleGit, SimpleGit } from "simple-git";
import { mkdir, readFile, writeFile, readdir, stat } from "fs/promises";
import { join, relative } from "path";
import { existsSync } from "fs";

const MEMORY_BASE = process.env.MEMORY_BASE_PATH || "./memory-store";

// Default categories and their initial content
const DEFAULT_FILES: Record<string, string> = {
  "notes.md": "# Notes\n\nGeneral facts and observations.\n",
  "interactions.md": "# Interactions\n\nLog of notable interactions and events.\n",
  "preferences.md": "# Preferences\n\nUser preferences, habits, and patterns.\n",
};

export interface MemoryEntry {
  timestamp: string;
  content: string;
  category: string;
}

export interface SearchResult {
  file: string;
  matches: string[];
}

export interface ReflectionResult {
  files: { name: string; lines: number; lastModified: string }[];
  recentCommits: { hash: string; message: string; date: string }[];
  summary: string;
}

/**
 * Get or initialize a git-backed memory repo for an agent
 */
async function getAgentRepo(agentId: string): Promise<{
  git: SimpleGit;
  dir: string;
}> {
  // Sanitize agentId to prevent path traversal
  const safeId = agentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = join(MEMORY_BASE, safeId);

  await mkdir(dir, { recursive: true });
  const gitDir = join(dir, ".git");

  if (!existsSync(gitDir)) {
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig("user.email", "logia-memory@join39.org");
    await git.addConfig("user.name", "Logia Memory Service");

    // Create default files
    for (const [filename, content] of Object.entries(DEFAULT_FILES)) {
      await writeFile(join(dir, filename), content);
    }
    await git.add(".");
    await git.commit("Initialize agent memory");
  }

  return { git: simpleGit(dir), dir };
}

const VALID_CATEGORIES = new Set(["notes", "interactions", "preferences"]);

function safeCategory(category: string): string {
  return VALID_CATEGORIES.has(category) ? category : "notes";
}

/**
 * Store a memory — appends to the appropriate markdown file and commits
 */
export async function storeMemory(
  agentId: string,
  content: string,
  category: string = "notes"
): Promise<{ success: boolean; file: string; timestamp: string }> {
  category = safeCategory(category);
  const { git, dir } = await getAgentRepo(agentId);
  const timestamp = new Date().toISOString();
  const filename = `${category}.md`;
  const filepath = join(dir, filename);

  // Read existing or create with header
  let existing = "";
  if (existsSync(filepath)) {
    existing = await readFile(filepath, "utf-8");
  } else {
    existing = `# ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
  }

  // Append timestamped entry
  const entry = `\n## ${timestamp}\n\n${content}\n`;
  await writeFile(filepath, existing + entry);

  await git.add(filename);
  await git.commit(`remember: ${content.slice(0, 60)}`);

  return { success: true, file: filename, timestamp };
}

/**
 * Search memories using simple text matching (BM25-lite)
 */
export async function searchMemory(
  agentId: string,
  query: string,
  category?: string
): Promise<SearchResult[]> {
  const { dir } = await getAgentRepo(agentId);
  const results: SearchResult[] = [];
  const queryTerms = query.toLowerCase().split(/\s+/);

  const files = await readdir(dir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const targetFiles = category ? [`${safeCategory(category)}.md`] : mdFiles;

  for (const filename of targetFiles) {
    const filepath = join(dir, filename);
    if (!existsSync(filepath)) continue;

    const content = await readFile(filepath, "utf-8");
    const sections = content.split(/^## /m).slice(1); // Split by H2 headers

    const matches: string[] = [];
    for (const section of sections) {
      const lower = section.toLowerCase();
      // Score: how many query terms appear in this section
      const score = queryTerms.filter((term) => lower.includes(term)).length;
      if (score > 0) {
        matches.push(section.trim().slice(0, 500)); // Cap each match
      }
    }

    // Sort by relevance (more term matches = higher)
    if (matches.length > 0) {
      matches.sort((a, b) => {
        const scoreA = queryTerms.filter((t) =>
          a.toLowerCase().includes(t)
        ).length;
        const scoreB = queryTerms.filter((t) =>
          b.toLowerCase().includes(t)
        ).length;
        return scoreB - scoreA;
      });
      results.push({ file: filename, matches: matches.slice(0, 5) });
    }
  }

  return results;
}

/**
 * Reflect — get an overview of what the agent knows + recent history
 */
export async function reflectMemory(
  agentId: string
): Promise<ReflectionResult> {
  const { git, dir } = await getAgentRepo(agentId);

  // File stats
  const allFiles = await readdir(dir);
  const mdFiles = allFiles.filter((f) => f.endsWith(".md"));
  const fileStats = await Promise.all(
    mdFiles.map(async (f) => {
      const filepath = join(dir, f);
      const content = await readFile(filepath, "utf-8");
      const fstat = await stat(filepath);
      return {
        name: f,
        lines: content.split("\n").length,
        lastModified: fstat.mtime.toISOString(),
      };
    })
  );

  // Recent git history
  const log = await git.log({ maxCount: 10 });
  const recentCommits = log.all.map((entry) => ({
    hash: entry.hash.slice(0, 7),
    message: entry.message,
    date: entry.date,
  }));

  // Build summary
  const totalEntries = fileStats.reduce((sum, f) => sum + f.lines, 0);
  const summary = `Agent has ${mdFiles.length} memory files with ~${totalEntries} total lines. ${recentCommits.length} recent commits.`;

  return { files: fileStats, recentCommits, summary };
}

/**
 * Get the full content of a memory file (for deeper reads)
 */
export async function readMemoryFile(
  agentId: string,
  category: string
): Promise<string | null> {
  const { dir } = await getAgentRepo(agentId);
  const filepath = join(dir, `${category}.md`);
  if (!existsSync(filepath)) return null;
  return readFile(filepath, "utf-8");
}

/**
 * Get git diff/history for a specific time range
 */
export async function getMemoryHistory(
  agentId: string,
  since?: string
): Promise<{ hash: string; message: string; date: string }[]> {
  const { git } = await getAgentRepo(agentId);
  const options: Record<string, string> = { maxCount: "20" };
  if (since) options["--since"] = since;

  const log = await git.log(options as any);
  return log.all.map((entry) => ({
    hash: entry.hash.slice(0, 7),
    message: entry.message,
    date: entry.date,
  }));
}
