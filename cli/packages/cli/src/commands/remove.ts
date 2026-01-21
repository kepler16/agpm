import { defineCommand } from "citty";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, saveConfig, loadLock, saveLock } from "@agpm/core";

// Target directories to clean up
const TARGET_DIRS = [".claude/skills", ".opencode/skills", ".codex/skills"];

export const removeCommand = defineCommand({
  meta: {
    name: "remove",
    description: "Remove an artifact from the project",
  },
  args: {
    artifact: {
      type: "positional",
      description: "Artifact to remove (name or full reference)",
      required: true,
    },
    keepFiles: {
      type: "boolean",
      alias: "k",
      description: "Keep installed files (only remove from config)",
      default: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const lock = await loadLock(cwd);

    // Find the artifact (match by name or full reference)
    const artifactRef = config.artifacts.find(
      (ref) =>
        ref === args.artifact ||
        ref.endsWith(`/${args.artifact}`)
    );

    if (!artifactRef) {
      console.log(`Artifact not found: ${args.artifact}`);
      console.log("\nConfigured artifacts:");
      for (const ref of config.artifacts) {
        console.log(`  - ${ref}`);
      }
      return;
    }

    // Get artifact name from reference
    const artifactName = artifactRef.slice(artifactRef.lastIndexOf("/") + 1);

    // Remove from config
    config.artifacts = config.artifacts.filter((ref) => ref !== artifactRef);
    await saveConfig(cwd, config);

    // Remove from lock
    if (lock.artifacts[artifactRef]) {
      delete lock.artifacts[artifactRef];
      await saveLock(cwd, lock);
    }

    console.log(`Removed: ${artifactRef}`);

    // Clean up files unless keepFiles is set
    if (!args.keepFiles) {
      for (const targetDir of TARGET_DIRS) {
        const targetPath = join(cwd, targetDir, artifactName);
        try {
          await rm(targetPath, { recursive: true, force: true });
          console.log(`  Deleted: ${targetDir}/${artifactName}`);
        } catch {
          // Directory doesn't exist, that's fine
        }
      }
    }
  },
});
