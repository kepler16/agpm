import { defineCommand } from "citty";
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

/**
 * Find a source in the config by name.
 */
function findSource(sources: Source[], name: string): Source | undefined {
  return sources.find((s) => s.name === name);
}

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Update artifacts to latest versions",
  },
  args: {
    artifact: {
      type: "positional",
      description: "Specific artifact to update (optional, updates all if not specified)",
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const lock = await loadLock(cwd);

    if (config.artifacts.length === 0) {
      console.log("No artifacts configured.");
      return;
    }

    // Filter to specific artifact if provided
    let artifactsToUpdate = config.artifacts;
    if (args.artifact) {
      artifactsToUpdate = config.artifacts.filter(
        (ref) =>
          ref === args.artifact ||
          ref.endsWith(`/${args.artifact}`)
      );

      if (artifactsToUpdate.length === 0) {
        console.log(`Artifact not found: ${args.artifact}`);
        return;
      }
    }

    console.log(`Updating ${artifactsToUpdate.length} artifact(s)...\n`);

    let updated = 0;

    for (const artifactRef of artifactsToUpdate) {
      // Parse artifact reference: source-name/artifact-name[@ref]
      const parsed = parseArtifactRef(artifactRef);
      if (!parsed) {
        console.log(`Invalid artifact reference: ${artifactRef}`);
        continue;
      }

      const { source: sourceName, artifact: artifactName, ref: versionRef } = parsed;

      // Look up source from config, fallback to parsing as new
      let source = findSource(config.sources, sourceName);
      if (!source) {
        try {
          source = parseSourceString(sourceName);
        } catch {
          console.log(`Source not found: ${sourceName}`);
          continue;
        }
      }

      // Lock key is without version ref
      const lockKey = `${sourceName}/${artifactName}`;

      console.log(`Checking ${artifactRef}...`);

      // Fetch latest
      await ensureRepo(source);
      const repoPath = getRepoPath(source);

      // Resolve ref to SHA (use pinned ref if specified, otherwise HEAD)
      const refToResolve = versionRef ?? "HEAD";
      const { sha: latestSha, cachePath } = await checkoutToCache(repoPath, refToResolve);

      // Check if update needed
      const lockEntry = lock.artifacts[lockKey];
      if (lockEntry && lockEntry.sha === latestSha) {
        console.log(`  Already up to date (${latestSha.slice(0, 8)})`);
        continue;
      }

      // Discover to get path from cached repo
      const result = await discover(cachePath, source.subdir, source.format);
      const artifact = result.artifacts.find((a: DiscoveredArtifact) => a.name === artifactName);

      if (!artifact) {
        console.log(`  Artifact not found in source`);
        continue;
      }

      // Compute integrity hash
      const artifactPath = join(cachePath, artifact.path);
      const integrity = await hashDirectory(artifactPath);

      const oldSha = lockEntry?.sha?.slice(0, 8) || "none";

      // Update lock
      lock.artifacts[lockKey] = {
        sha: latestSha,
        integrity,
        path: artifact.path,
        ...(versionRef && { ref: versionRef }),
        metadata: {
          name: artifact.name,
          description: artifact.description,
        },
      };

      console.log(`  Updated: ${oldSha} -> ${latestSha.slice(0, 8)}`);
      updated++;
    }

    if (updated > 0) {
      await saveLock(cwd, lock);
      console.log(`\nUpdated ${updated} artifact(s) in agpm-lock.json`);
      console.log("Run `agpm install` to apply updates.");
    } else {
      console.log("\nAll artifacts are up to date.");
    }
  },
});
