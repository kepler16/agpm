import { simpleGit, SimpleGit } from "simple-git";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";

// ============================================================================
// Types
// ============================================================================

export interface ParsedSource {
  /** Full git URL for cloning */
  url: string;
  /** GitHub owner (if GitHub) */
  owner?: string;
  /** Repository name */
  repo?: string;
  /** Git ref (branch, tag, SHA) */
  ref?: string;
  /** Subpath within repo (after #) */
  subpath?: string;
  /** Original source string */
  original: string;
}

export interface RepoInfo {
  /** Path to the cloned repo */
  path: string;
  /** Current HEAD SHA */
  sha: string;
}

// ============================================================================
// Source Parsing
// ============================================================================

/**
 * Parse a source string into its components.
 *
 * Supported formats:
 * - owner/repo
 * - owner/repo#subpath
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo#subpath
 * - ./local/path
 */
export function parseSource(source: string): ParsedSource {
  const original = source;

  // Local path
  if (source.startsWith("./") || source.startsWith("/") || source.startsWith("~")) {
    return {
      url: source,
      original,
    };
  }

  // Split on # for subpath
  let subpath: string | undefined;
  const hashIndex = source.indexOf("#");
  if (hashIndex !== -1) {
    subpath = source.slice(hashIndex + 1);
    source = source.slice(0, hashIndex);
  }

  // Full URL
  if (source.startsWith("https://") || source.startsWith("git@")) {
    const match = source.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/);
    if (match) {
      return {
        url: source.endsWith(".git") ? source : `${source}.git`,
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
        subpath,
        original,
      };
    }
    return { url: source, subpath, original };
  }

  // owner/repo shorthand
  const parts = source.split("/");
  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts[1];
    return {
      url: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      subpath,
      original,
    };
  }

  throw new Error(`Invalid source format: ${original}`);
}

// ============================================================================
// Repository Management
// ============================================================================

/**
 * Get the global agpm directory path.
 */
export function getAgpmDir(): string {
  return join(homedir(), ".agpm");
}

/**
 * Get the path where a repo should be stored.
 */
export function getRepoPath(source: ParsedSource): string {
  const apmDir = getAgpmDir();

  if (source.owner && source.repo) {
    return join(apmDir, "repos", "github.com", source.owner, source.repo);
  }

  // For non-GitHub URLs, use a sanitized version
  const sanitized = source.url
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/[^a-zA-Z0-9.-]/g, "_");

  return join(apmDir, "repos", sanitized);
}

/**
 * Clone or fetch a repository.
 * Returns the path to the repo and the current HEAD SHA.
 */
export async function ensureRepo(source: ParsedSource): Promise<RepoInfo> {
  const repoPath = getRepoPath(source);

  // Ensure parent directory exists
  await mkdir(join(repoPath, ".."), { recursive: true });

  const git: SimpleGit = simpleGit();

  try {
    // Check if repo exists
    const repoGit = simpleGit(repoPath);
    await repoGit.status();

    // Repo exists, fetch latest
    await repoGit.fetch(["--all"]);
  } catch {
    // Repo doesn't exist, clone it
    await git.clone(source.url, repoPath);
  }

  // Get current SHA
  const repoGit = simpleGit(repoPath);
  const log = await repoGit.log({ maxCount: 1 });
  const sha = log.latest?.hash ?? "";

  return { path: repoPath, sha };
}

/**
 * Checkout a specific ref (branch, tag, or SHA) in a repo.
 */
export async function checkoutRef(repoPath: string, ref: string): Promise<string> {
  const git = simpleGit(repoPath);
  await git.checkout(ref);

  const log = await git.log({ maxCount: 1 });
  return log.latest?.hash ?? "";
}

/**
 * Resolve a ref to a full SHA.
 */
export async function resolveRef(repoPath: string, ref: string = "HEAD"): Promise<string> {
  const git = simpleGit(repoPath);
  const result = await git.revparse([ref]);
  return result.trim();
}
