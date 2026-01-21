import { simpleGit, SimpleGit } from "simple-git";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir } from "node:fs/promises";
import type { Source } from "./config.js";
import { cacheRepo, isCached, getCachedRepoPath } from "./cache.js";

// ============================================================================
// Types
// ============================================================================

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
 * Check if a string looks like a git URL.
 */
function isGitUrl(str: string): boolean {
  return (
    str.startsWith("https://") ||
    str.startsWith("http://") ||
    str.startsWith("git://") ||
    str.startsWith("git+ssh://") ||
    str.startsWith("git+https://") ||
    str.startsWith("ssh://") ||
    str.startsWith("git@")
  );
}

/**
 * Extract owner/repo from a GitHub-like URL.
 * Works with github.com, gitlab.com, bitbucket.org, etc.
 */
function extractRepoInfo(url: string): { owner: string; repo: string } | null {
  // Handle git@host:owner/repo.git format
  const sshMatch = url.match(/git@[\w.-]+:([\w.-]+)\/([\w.-]+)/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2].replace(/\.git$/, ""),
    };
  }

  // Handle URL formats (https://, git://, ssh://, etc.)
  const urlMatch = url.match(/(?:github\.com|gitlab\.com|bitbucket\.org)[/:]+([\w.-]+)\/([\w.-]+)/);
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2].replace(/\.git$/, ""),
    };
  }

  return null;
}

/**
 * Ensure URL ends with .git for consistency.
 */
function normalizeGitUrl(url: string): string {
  // Remove git+ prefix for storage (git+ssh:// -> ssh://)
  let normalized = url.replace(/^git\+(ssh|https):\/\//, "$1://");

  // Add .git suffix if missing
  if (!normalized.endsWith(".git")) {
    normalized = `${normalized}.git`;
  }

  return normalized;
}

/**
 * Parse a CLI source shorthand string into a normalized Source object.
 *
 * Supported formats:
 * - owner/repo (GitHub shorthand)
 * - owner/repo#subdir
 * - https://github.com/owner/repo
 * - git://github.com/owner/repo
 * - git+ssh://git@github.com/owner/repo
 * - git@github.com:owner/repo
 * - Any of the above with #subdir suffix
 *
 * Returns a Source object suitable for storing in agpm.json.
 */
export function parseSourceString(input: string): Source {
  // Split on # for subdir
  let subdir: string | undefined;
  let source = input;
  const hashIndex = source.indexOf("#");
  if (hashIndex !== -1) {
    subdir = source.slice(hashIndex + 1);
    source = source.slice(0, hashIndex);
  }

  // Full URL (various git protocols)
  if (isGitUrl(source)) {
    const repoInfo = extractRepoInfo(source);
    const url = normalizeGitUrl(source);

    if (repoInfo) {
      return {
        name: `${repoInfo.owner}/${repoInfo.repo}`,
        url,
        ...(subdir && { subdir }),
      };
    }

    // Non-standard URL - use sanitized version as name
    const name = source
      .replace(/^(git\+)?(https?|git|ssh):\/\//, "")
      .replace(/^git@/, "")
      .replace(/\.git$/, "")
      .replace(":", "/");

    return {
      name,
      url,
      ...(subdir && { subdir }),
    };
  }

  // owner/repo shorthand (assumes GitHub)
  const parts = source.split("/");
  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts[1];
    return {
      name: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}.git`,
      ...(subdir && { subdir }),
    };
  }

  throw new Error(`Invalid source format: ${input}`);
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
 * Get the path where a repo should be stored based on its URL.
 */
export function getRepoPath(source: Source): string {
  const agpmDir = getAgpmDir();

  // Parse the URL to extract host and path
  const url = source.url;

  // Handle git@host:path format
  const sshMatch = url.match(/git@([\w.-]+):([\w.-]+)\/([\w.-]+)/);
  if (sshMatch) {
    const host = sshMatch[1];
    const owner = sshMatch[2];
    const repo = sshMatch[3].replace(/\.git$/, "");
    return join(agpmDir, "repos", host, owner, repo);
  }

  // Handle URL formats
  const urlMatch = url.match(/(?:https?|git|ssh):\/\/([\w.-]+)\/([\w.-]+)\/([\w.-]+)/);
  if (urlMatch) {
    const host = urlMatch[1];
    const owner = urlMatch[2];
    const repo = urlMatch[3].replace(/\.git$/, "");
    return join(agpmDir, "repos", host, owner, repo);
  }

  // Fallback: sanitize the whole URL
  const sanitized = url
    .replace(/^(git\+)?(https?|git|ssh):\/\//, "")
    .replace(/^git@/, "")
    .replace(/\.git$/, "")
    .replace(/[^a-zA-Z0-9./-]/g, "_");

  return join(agpmDir, "repos", sanitized);
}

/**
 * Clone or fetch a repository.
 * Returns the path to the repo and the current HEAD SHA.
 */
export async function ensureRepo(source: Source): Promise<RepoInfo> {
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

/**
 * Checkout a ref and cache the repo at that SHA.
 *
 * 1. Resolves the ref to a full SHA
 * 2. If not already cached, checkouts the repo at that SHA and caches it
 * 3. Returns the SHA and path to the cached repo
 */
export async function checkoutToCache(
  repoPath: string,
  ref: string = "HEAD"
): Promise<{ sha: string; cachePath: string }> {
  // Resolve ref to full SHA
  const sha = await resolveRef(repoPath, ref);

  // Check if already cached
  if (await isCached(sha)) {
    return { sha, cachePath: getCachedRepoPath(sha) };
  }

  // Checkout the specific SHA
  await checkoutRef(repoPath, sha);

  // Cache the repo at this SHA
  const cachePath = await cacheRepo(repoPath, sha);

  return { sha, cachePath };
}
