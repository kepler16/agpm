import { defineCommand } from "citty";
import { loadConfig, loadLock } from "@agpm/core";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List configured artifacts and their status",
  },
  async run() {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const lock = await loadLock(cwd);

    if (config.artifacts.length === 0) {
      console.log("No artifacts configured.");
      console.log("\nAdd artifacts with: agpm add <source> <artifact>");
      return;
    }

    console.log("Configured artifacts:\n");

    for (const artifactRef of config.artifacts) {
      const lockEntry = lock.artifacts[artifactRef];

      console.log(`  ${artifactRef}`);

      if (lockEntry) {
        console.log(`    SHA: ${lockEntry.sha.slice(0, 8)}`);
        console.log(`    Path: ${lockEntry.path}`);
        if (lockEntry.metadata.description) {
          const desc =
            lockEntry.metadata.description.length > 60
              ? lockEntry.metadata.description.slice(0, 57) + "..."
              : lockEntry.metadata.description;
          console.log(`    ${desc}`);
        }
      } else {
        console.log(`    (not installed)`);
      }
      console.log();
    }

    console.log(`${config.artifacts.length} artifact(s) configured`);
  },
});
