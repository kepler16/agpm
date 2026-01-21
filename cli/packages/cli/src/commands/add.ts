import { defineCommand } from "citty";
import {
  loadConfig,
  saveConfig,
  parseSourceString,
  ensureRepo,
  getRepoPath,
  discover,
  type DiscoveredArtifact,
  type DiscoveredCollection,
  type Source,
} from "@agpm/core";

/**
 * Find a source in the config by name.
 */
function findSource(sources: Source[], name: string): Source | undefined {
  return sources.find((s) => s.name === name);
}

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "Add an artifact or collection to the project",
  },
  args: {
    source: {
      type: "positional",
      description: "Source containing the artifact (owner/repo or URL)",
      required: true,
    },
    name: {
      type: "positional",
      description: "Artifact or collection name to add",
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    // Parse CLI shorthand into a Source object
    const source = parseSourceString(args.source);
    console.log(`Resolving ${source.name}...`);

    // Ensure repo is cloned
    await ensureRepo(source);
    const repoPath = getRepoPath(source);

    // Discover available artifacts and collections
    const result = await discover(repoPath, source.subdir, source.format);

    if (result.artifacts.length === 0 && result.collections.length === 0) {
      console.log("No artifacts or collections found in source");
      return;
    }

    // Also ensure source is in sources list
    if (!findSource(config.sources, source.name)) {
      config.sources.push(source);
    }

    if (args.name) {
      // Check if it's a collection first
      const collection = result.collections.find(
        (c) => c.name === args.name
      );

      if (collection) {
        return addCollection(config, source, collection, cwd);
      }

      // Otherwise, find specific artifact
      const artifact = result.artifacts.find(
        (a) =>
          a.name === args.name ||
          a.path === args.name ||
          a.path.endsWith(`/${args.name}`)
      );

      if (artifact) {
        return addArtifact(config, source, artifact, cwd);
      }

      // Not found
      console.log(`"${args.name}" not found in source.`);
      showAvailable(result.collections, result.artifacts, args.source);
      return;
    }

    // No name specified - auto-select or show options
    if (result.collections.length === 1 && result.artifacts.length === 0) {
      // Only one collection, auto-add it
      return addCollection(config, source, result.collections[0], cwd);
    }

    if (result.artifacts.length === 1 && result.collections.length === 0) {
      // Only one artifact, auto-add it
      return addArtifact(config, source, result.artifacts[0], cwd);
    }

    // Multiple options, must specify
    console.log("Multiple items found. Please specify which one to add:\n");
    showAvailable(result.collections, result.artifacts, args.source);
  },
});

async function addCollection(
  config: Awaited<ReturnType<typeof loadConfig>>,
  source: Source,
  collection: DiscoveredCollection,
  cwd: string
) {
  const collectionRef = `${source.name}/${collection.name}`;

  if (config.collections.includes(collectionRef)) {
    console.log(`Collection already configured: ${collectionRef}`);
    return;
  }

  config.collections.push(collectionRef);
  await saveConfig(cwd, config);

  console.log(`Added collection: ${collectionRef}`);
  if (collection.description) {
    console.log(`  ${collection.description}`);
  }
  console.log(`  Contains: ${collection.artifacts.join(", ")}`);
  console.log();
  console.log("Run `agpm install` to install the collection.");
}

async function addArtifact(
  config: Awaited<ReturnType<typeof loadConfig>>,
  source: Source,
  artifact: DiscoveredArtifact,
  cwd: string
) {
  const artifactRef = `${source.name}/${artifact.name}`;

  if (config.artifacts.includes(artifactRef)) {
    console.log(`Artifact already configured: ${artifactRef}`);
    return;
  }

  config.artifacts.push(artifactRef);
  await saveConfig(cwd, config);

  console.log(`Added: ${artifactRef}`);
  if (artifact.description) {
    console.log(`  ${artifact.description}`);
  }
  console.log();
  console.log("Run `agpm install` to install the artifact.");
}

function showAvailable(
  collections: DiscoveredCollection[],
  artifacts: DiscoveredArtifact[],
  sourceArg: string
) {
  if (collections.length > 0) {
    console.log("Collections:");
    for (const c of collections) {
      console.log(`  ${c.name}`);
      if (c.description) {
        const desc = c.description.length > 60
          ? c.description.slice(0, 57) + "..."
          : c.description;
        console.log(`    ${desc}`);
      }
      console.log(`    (${c.artifacts.length} artifacts)`);
    }
    console.log();
  }

  if (artifacts.length > 0) {
    console.log("Artifacts:");
    for (const a of artifacts) {
      console.log(`  ${a.name}`);
      if (a.description) {
        const desc = a.description.length > 60
          ? a.description.slice(0, 57) + "..."
          : a.description;
        console.log(`    ${desc}`);
      }
    }
    console.log();
  }

  console.log(`Usage: agpm add ${sourceArg} <name>`);
}
