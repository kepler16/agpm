import { defineCommand } from "citty";
import {
  loadConfig,
  saveConfig,
  parseSourceString,
  ensureRepo,
  getRepoPath,
  detectFormat,
  discover,
  type Source,
} from "@agpm/core";

/**
 * Find a source in the config by name (exact match or partial).
 */
function findSource(sources: Source[], query: string): Source | undefined {
  // Try exact name match first
  const exact = sources.find((s) => s.name === query);
  if (exact) return exact;

  // Try partial match
  return sources.find((s) => s.name.includes(query) || s.url.includes(query));
}

const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "Add a source to the project",
  },
  args: {
    source: {
      type: "positional",
      description: "Source reference (owner/repo, URL, or local path)",
      required: true,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    // Parse CLI shorthand into a Source object
    const source = parseSourceString(args.source);
    console.log(`Adding source: ${source.name}`);

    // Check if already added
    if (findSource(config.sources, source.name)) {
      console.log("Source already exists in config");
      return;
    }

    // Clone/fetch the repo to validate it exists
    console.log(`Fetching ${source.url}...`);
    const repo = await ensureRepo(source);
    console.log(`Cloned to ${repo.path} (${repo.sha.slice(0, 8)})`);

    // Add to config (as full object)
    config.sources.push(source);
    await saveConfig(cwd, config);

    console.log(`Added source: ${source.name}`);
  },
});

const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List configured sources",
  },
  async run() {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    if (config.sources.length === 0) {
      console.log("No sources configured");
      console.log("\nAdd a source with: agpm source add <repo>");
      return;
    }

    console.log("Configured sources:\n");
    for (const source of config.sources) {
      console.log(`  ${source.name}`);
      console.log(`    url: ${source.url}`);
      if (source.format && source.format !== "auto") {
        console.log(`    format: ${source.format}`);
      }
      if (source.subdir) {
        console.log(`    subdir: ${source.subdir}`);
      }
    }
  },
});

const removeCommand = defineCommand({
  meta: {
    name: "remove",
    description: "Remove a source from the project",
  },
  args: {
    source: {
      type: "positional",
      description: "Source name to remove",
      required: true,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    const index = config.sources.findIndex((s) => s.name === args.source);
    if (index === -1) {
      console.log(`Source not found: ${args.source}`);
      return;
    }

    const removed = config.sources.splice(index, 1)[0];
    await saveConfig(cwd, config);

    console.log(`Removed source: ${removed.name}`);
  },
});

const discoverCommand = defineCommand({
  meta: {
    name: "discover",
    description: "Discover artifacts and collections in a source",
  },
  args: {
    source: {
      type: "positional",
      description: "Source to discover artifacts in",
      required: true,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    // Check if source is in config, otherwise parse as new
    let source = findSource(config.sources, args.source);
    if (!source) {
      source = parseSourceString(args.source);
    }

    const repoPath = getRepoPath(source);

    // Ensure repo is cloned
    console.log(`Checking ${source.name}...`);
    await ensureRepo(source);

    // Detect format
    const format = await detectFormat(repoPath);
    console.log(`Format: ${format}\n`);

    if (format === "unknown") {
      console.log("Unknown format - no .claude-plugin/marketplace.json or skills/ directory found");
      return;
    }

    // Discover artifacts and collections
    const result = await discover(repoPath, source.subdir, source.format);

    if (result.artifacts.length === 0 && result.collections.length === 0) {
      console.log("No artifacts or collections found");
      return;
    }

    // Show collections first
    if (result.collections.length > 0) {
      console.log(`Found ${result.collections.length} collection(s):\n`);
      for (const collection of result.collections) {
        console.log(`  ${collection.name}`);
        if (collection.description) {
          const desc = collection.description.length > 80
            ? collection.description.slice(0, 77) + "..."
            : collection.description;
          console.log(`    ${desc}`);
        }
        console.log(`    artifacts: ${collection.artifacts.join(", ")}`);
        console.log();
      }
    }

    // Show artifacts
    if (result.artifacts.length > 0) {
      console.log(`Found ${result.artifacts.length} artifact(s):\n`);
      for (const artifact of result.artifacts) {
        console.log(`  ${artifact.name}`);
        if (artifact.description) {
          const desc = artifact.description.length > 80
            ? artifact.description.slice(0, 77) + "..."
            : artifact.description;
          console.log(`    ${desc}`);
        }
        console.log(`    path: ${artifact.path}`);
        console.log();
      }
    }
  },
});

export const sourceCommand = defineCommand({
  meta: {
    name: "source",
    description: "Manage artifact sources",
  },
  subCommands: {
    add: addCommand,
    list: listCommand,
    remove: removeCommand,
    discover: discoverCommand,
  },
});
