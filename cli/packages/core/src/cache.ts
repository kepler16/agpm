import { createHash } from "node:crypto";
import { readdir, readFile, stat, cp, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// Cache Directory Management
// ============================================================================

/**
 * Get the AGPM cache directory path.
 * Cache stores immutable repo snapshots at specific SHAs.
 */
export function getAgpmCacheDir(): string {
  return join(homedir(), ".agpm", "cache");
}

/**
 * Get the path for a cached repo at a specific SHA.
 */
export function getCachedRepoPath(sha: string): string {
  return join(getAgpmCacheDir(), sha);
}

/**
 * Check if a SHA is already cached.
 */
export async function isCached(sha: string): Promise<boolean> {
  try {
    await stat(getCachedRepoPath(sha));
    return true;
  } catch {
    return false;
  }
}

/**
 * Cache a repo at a specific SHA.
 * Copies repo contents (excluding .git) to the cache directory.
 *
 * @param repoPath - Path to the git repo (should already be checked out at the SHA)
 * @param sha - The SHA to cache under
 * @returns Path to the cached repo
 */
export async function cacheRepo(
  repoPath: string,
  sha: string
): Promise<string> {
  const cachePath = getCachedRepoPath(sha);

  // Skip if already cached
  if (await isCached(sha)) {
    return cachePath;
  }

  await mkdir(cachePath, { recursive: true });

  // Copy repo contents, excluding .git directory
  await cp(repoPath, cachePath, {
    recursive: true,
    filter: (src) => !src.includes("/.git") && !src.endsWith(".git"),
  });

  return cachePath;
}

// ============================================================================
// Integrity Hashing
// ============================================================================

/**
 * Recursively get all files in a directory.
 */
async function getFilesRecursive(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith(".")) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        // Skip hidden files
        if (!entry.name.startsWith(".")) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dirPath);
  return files;
}

/**
 * Compute SHA256 integrity hash of a directory's contents.
 *
 * Algorithm:
 * 1. Recursively list all files (sorted alphabetically by relative path)
 * 2. For each file: update hash with relative path + file contents
 * 3. Return hash as "sha256-<base64>"
 *
 * This produces a deterministic hash regardless of filesystem order.
 */
export async function hashDirectory(dirPath: string): Promise<string> {
  const files = await getFilesRecursive(dirPath);

  // Sort by relative path for deterministic ordering
  const relativePaths = files.map((f) => ({
    absolute: f,
    relative: relative(dirPath, f),
  }));
  relativePaths.sort((a, b) => a.relative.localeCompare(b.relative));

  const hash = createHash("sha256");

  for (const { absolute, relative: relPath } of relativePaths) {
    const content = await readFile(absolute);
    // Include path in hash to detect renames
    hash.update(relPath);
    hash.update(content);
  }

  return `sha256-${hash.digest("base64")}`;
}

/**
 * Verify a directory matches an expected integrity hash.
 */
export async function verifyIntegrity(
  dirPath: string,
  expectedIntegrity: string
): Promise<boolean> {
  const actualIntegrity = await hashDirectory(dirPath);
  return actualIntegrity === expectedIntegrity;
}
