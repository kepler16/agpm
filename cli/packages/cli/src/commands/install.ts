import { defineCommand } from "citty";
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  loadConfig,
  loadLock,
  saveLock,
  parseSourceString,
  parseArtifactRef,
  ensureRepo,
  getRepoPath,
  discover,
  checkoutToCache,
  hashDirectory,
  type Source,
  type DiscoveredArtifact,
} from "@agpm/core";

// Default target directories for different AI tools
const TARGET_DIRS = [".claude/skills", ".opencode/skills", ".codex/skills"];

/**
 * Find a source in the config by name.
 */
function findSource(sources: Source[], name: string): Source | undefined {
  return sources.find((s) => s.name === name);
}

/**
 * Parse collection reference (source/name) into source name and collection name.
 * Collections don't support version refs.
 */
function parseCollectionRef(ref: string): { sourceName: string; collectionName: string } | null {
  const lastSlash = ref.lastIndexOf("/");
  if (lastSlash === -1) return null;

  return {
    sourceName: ref.slice(0, lastSlash),
    collectionName: ref.slice(lastSlash + 1),
  };
}

export const installCommand = defineCommand({
  meta: {
    name: "install",
    description: "Install configured artifacts to target directories",
  },
  args: {
    force: {
      type: "boolean",
      alias: "f",
      description: "Force reinstall even if already installed",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const lock = await loadLock(cwd);

    if (config.collections.length === 0 && config.artifacts.length === 0) {
      console.log("No artifacts or collections configured.");
      console.log("\nAdd artifacts with: agpm add <source> <name>");
      return;
    }

    // Build list of artifact refs to install (expand collections)
    const artifactRefs: string[] = [...config.artifacts];

    // Expand collections to their artifacts
    for (const collectionRef of config.collections) {
      const parsed = parseCollectionRef(collectionRef);
      if (!parsed) {
        console.log(`Invalid collection reference: ${collectionRef}`);
        continue;
      }

      const { sourceName, collectionName } = parsed;

      let source = findSource(config.sources, sourceName);
      if (!source) {
        try {
          source = parseSourceString(sourceName);
        } catch {
          console.log(`Source not found: ${sourceName}`);
          continue;
        }
      }

      // Discover to find the collection
      await ensureRepo(source);
      const repoPath = getRepoPath(source);
      const result = await discover(repoPath, source.subdir, source.format);

      const collection = result.collections.find((c) => c.name === collectionName);
      if (!collection) {
        console.log(`Collection not found: ${collectionName}`);
        continue;
      }

      // Add each artifact from the collection
      for (const artifactName of collection.artifacts) {
        const artifactRef = `${sourceName}/${artifactName}`;
        if (!artifactRefs.includes(artifactRef)) {
          artifactRefs.push(artifactRef);
        }
      }
    }

    console.log(`Installing ${artifactRefs.length} artifact(s)...\n`);

    let updated = false;

    // Cache discovered artifacts per source to avoid repeated discovery
    const discoveryCache = new Map<string, DiscoveredArtifact[]>();

    for (const artifactRef of artifactRefs) {
      const parsed = parseArtifactRef(artifactRef);
      if (!parsed) {
        console.log(`Invalid artifact reference: ${artifactRef}`);
        continue;
      }

      const { source: sourceName, artifact: artifactName, ref: versionRef } = parsed;

      let source = findSource(config.sources, sourceName);
      if (!source) {
        try {
          source = parseSourceString(sourceName);
        } catch {
          console.log(`Source not found: ${sourceName}`);
          continue;
        }
      }

      // Build the lock key (without version ref - lock tracks resolved SHA)
      const lockKey = `${sourceName}/${artifactName}`;

      // Check if we have a lock entry
      let lockEntry = lock.artifacts[lockKey];

      if (!lockEntry || args.force) {
        console.log(`Resolving ${artifactRef}...`);

        await ensureRepo(source);
        const repoPath = getRepoPath(source);

        // Checkout to cache at the specified ref (or HEAD)
        const { sha, cachePath } = await checkoutToCache(repoPath, versionRef ?? "HEAD");

        // Get or cache discovered artifacts (discovered from cached repo)
        const cacheKey = `${sourceName}@${sha}`;
        let artifacts = discoveryCache.get(cacheKey);
        if (!artifacts) {
          const result = await discover(cachePath, source.subdir, source.format);
          artifacts = result.artifacts;
          discoveryCache.set(cacheKey, artifacts);
        }

        const artifact = artifacts.find((a) => a.name === artifactName);
        if (!artifact) {
          console.log(`  Artifact not found: ${artifactName}`);
          continue;
        }

        // Compute integrity hash of the artifact directory
        const artifactPath = join(cachePath, artifact.path);
        const integrity = await hashDirectory(artifactPath);

        lockEntry = {
          sha,
          integrity,
          path: artifact.path,
          ...(versionRef && { ref: versionRef }),
          metadata: {
            name: artifact.name,
            description: artifact.description,
          },
        };

        lock.artifacts[lockKey] = lockEntry;
        updated = true;
      }

      // Install from cache to target directories
      // First, ensure we have the SHA in cache
      await ensureRepo(source);
      const repoPath = getRepoPath(source);
      const { cachePath } = await checkoutToCache(repoPath, lockEntry.sha);
      const sourcePath = join(cachePath, lockEntry.path);

      for (const targetDir of TARGET_DIRS) {
        const targetPath = join(cwd, targetDir, artifactName);

        try {
          await rm(targetPath, { recursive: true, force: true });
          await mkdir(join(cwd, targetDir), { recursive: true });
          await cp(sourcePath, targetPath, { recursive: true });
          console.log(`  Installed: ${targetDir}/${artifactName}`);
        } catch (error) {
          console.log(
            `  Failed to install to ${targetDir}: ${(error as Error).message}`
          );
        }
      }
    }

    if (updated) {
      await saveLock(cwd, lock);
      console.log("\nUpdated agpm-lock.json");
    }

    console.log("\nDone.");
  },
});
