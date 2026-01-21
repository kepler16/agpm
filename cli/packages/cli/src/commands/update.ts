import { defineCommand } from "citty";
import {
  loadConfig,
  loadLock,
  saveLock,
  parseSource,
  ensureRepo,
  getRepoPath,
  discoverArtifacts,
  resolveRef,
} from "@agpm/core";

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
      // Parse artifact reference: source/artifact-name
      const lastSlash = artifactRef.lastIndexOf("/");
      const sourceStr = artifactRef.slice(0, lastSlash);
      const artifactName = artifactRef.slice(lastSlash + 1);

      const parsed = parseSource(sourceStr);

      console.log(`Checking ${artifactRef}...`);

      // Fetch latest
      await ensureRepo(parsed);
      const repoPath = getRepoPath(parsed);

      // Resolve latest SHA
      const latestSha = await resolveRef(repoPath, parsed.ref || "HEAD");

      // Check if update needed
      const lockEntry = lock.artifacts[artifactRef];
      if (lockEntry && lockEntry.sha === latestSha) {
        console.log(`  Already up to date (${latestSha.slice(0, 8)})`);
        continue;
      }

      // Discover to get path
      const artifacts = await discoverArtifacts(repoPath, parsed.subpath);
      const artifact = artifacts.find((a) => a.name === artifactName);

      if (!artifact) {
        console.log(`  Artifact not found in source`);
        continue;
      }

      const oldSha = lockEntry?.sha?.slice(0, 8) || "none";

      // Update lock
      lock.artifacts[artifactRef] = {
        sha: latestSha,
        integrity: `sha256-${latestSha.slice(0, 16)}`,
        path: artifact.path,
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
