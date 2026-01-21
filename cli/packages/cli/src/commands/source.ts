import { defineCommand } from "citty";
import { loadConfig, saveConfig, parseSource, ensureRepo, getRepoPath, detectFormat, discoverArtifacts } from "@agpm/core";

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

    // Parse and validate the source
    const parsed = parseSource(args.source);
    console.log(`Adding source: ${parsed.original}`);

    // Check if already added
    if (config.sources.includes(args.source)) {
      console.log("Source already exists in config");
      return;
    }

    // Clone/fetch the repo to validate it exists
    console.log(`Fetching ${parsed.url}...`);
    const repo = await ensureRepo(parsed);
    console.log(`Cloned to ${repo.path} (${repo.sha.slice(0, 8)})`);

    // Add to config
    config.sources.push(args.source);
    await saveConfig(cwd, config);

    console.log(`Added source: ${args.source}`);
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
      const parsed = parseSource(source);
      console.log(`  ${source}`);
      if (parsed.subpath) {
        console.log(`    └─ subpath: ${parsed.subpath}`);
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
      description: "Source to remove",
      required: true,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    const index = config.sources.indexOf(args.source);
    if (index === -1) {
      console.log(`Source not found: ${args.source}`);
      return;
    }

    config.sources.splice(index, 1);
    await saveConfig(cwd, config);

    console.log(`Removed source: ${args.source}`);
  },
});

const discoverCommand = defineCommand({
  meta: {
    name: "discover",
    description: "Discover artifacts in a source",
  },
  args: {
    source: {
      type: "positional",
      description: "Source to discover artifacts in",
      required: true,
    },
  },
  async run({ args }) {
    const parsed = parseSource(args.source);
    const repoPath = getRepoPath(parsed);

    // Ensure repo is cloned
    console.log(`Checking ${parsed.original}...`);
    await ensureRepo(parsed);

    // Detect format
    const format = await detectFormat(repoPath);
    console.log(`Format: ${format}\n`);

    if (format === "unknown") {
      console.log("Unknown format - no .claude-plugin/marketplace.json or skills/ directory found");
      return;
    }

    // Discover artifacts
    const artifacts = await discoverArtifacts(repoPath, parsed.subpath);

    if (artifacts.length === 0) {
      console.log("No artifacts found");
      return;
    }

    console.log(`Found ${artifacts.length} artifact(s):\n`);
    for (const artifact of artifacts) {
      console.log(`  ${artifact.name}`);
      if (artifact.description) {
        // Truncate long descriptions
        const desc = artifact.description.length > 80
          ? artifact.description.slice(0, 77) + "..."
          : artifact.description;
        console.log(`    ${desc}`);
      }
      console.log(`    path: ${artifact.path}`);
      console.log();
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
