import { defineCommand } from "citty";
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
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

// Default target directories for different AI tools
const TARGET_DIRS = [".claude/skills", ".opencode/skills", ".codex/skills"];

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

    if (config.artifacts.length === 0) {
      console.log("No artifacts configured.");
      console.log("\nAdd artifacts with: agpm add <source> <artifact>");
      return;
    }

    console.log(`Installing ${config.artifacts.length} artifact(s)...\n`);

    let updated = false;

    for (const artifactRef of config.artifacts) {
      // Parse artifact reference: source/artifact-name
      const lastSlash = artifactRef.lastIndexOf("/");
      if (lastSlash === -1) {
        console.log(`Invalid artifact reference: ${artifactRef}`);
        continue;
      }

      const sourceStr = artifactRef.slice(0, lastSlash);
      const artifactName = artifactRef.slice(lastSlash + 1);

      const parsed = parseSource(sourceStr);

      // Check if we have a lock entry
      let lockEntry = lock.artifacts[artifactRef];

      if (!lockEntry || args.force) {
        // Need to resolve
        console.log(`Resolving ${artifactRef}...`);

        // Ensure repo is cloned
        await ensureRepo(parsed);
        const repoPath = getRepoPath(parsed);

        // Discover artifacts to get the path
        const artifacts = await discoverArtifacts(repoPath, parsed.subpath);
        const artifact = artifacts.find((a) => a.name === artifactName);

        if (!artifact) {
          console.log(`  Artifact not found: ${artifactName}`);
          continue;
        }

        // Resolve SHA
        const sha = await resolveRef(repoPath, parsed.ref || "HEAD");

        lockEntry = {
          sha,
          integrity: `sha256-${sha.slice(0, 16)}`, // Placeholder integrity
          path: artifact.path,
          metadata: {
            name: artifact.name,
            description: artifact.description,
          },
        };

        lock.artifacts[artifactRef] = lockEntry;
        updated = true;
      }

      // Install to target directories
      const installRepoPath = getRepoPath(parsed);
      const sourcePath = join(installRepoPath, lockEntry.path);

      for (const targetDir of TARGET_DIRS) {
        const targetPath = join(cwd, targetDir, artifactName);

        try {
          // Remove existing
          await rm(targetPath, { recursive: true, force: true });

          // Create parent directory
          await mkdir(join(cwd, targetDir), { recursive: true });

          // Copy skill directory
          await cp(sourcePath, targetPath, { recursive: true });

          console.log(`  Installed: ${targetDir}/${artifactName}`);
        } catch (error) {
          console.log(
            `  Failed to install to ${targetDir}: ${(error as Error).message}`
          );
        }
      }
    }

    // Save lock file if updated
    if (updated) {
      await saveLock(cwd, lock);
      console.log("\nUpdated agpm-lock.json");
    }

    console.log("\nDone.");
  },
});
