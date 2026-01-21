import { defineCommand } from "citty";
import {
  loadConfig,
  saveConfig,
  parseSourceString,
  ensureRepo,
  getRepoPath,
  discoverArtifacts,
  type DiscoveredArtifact,
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
    description: "Add an artifact to the project",
  },
  args: {
    source: {
      type: "positional",
      description: "Source containing the artifact (owner/repo or URL)",
      required: true,
    },
    artifact: {
      type: "positional",
      description: "Artifact name to add (optional if source has only one)",
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

    // Discover available artifacts (use source's explicit format if set)
    const artifacts = await discoverArtifacts(repoPath, source.subdir, source.format);

    if (artifacts.length === 0) {
      console.log("No artifacts found in source");
      return;
    }

    let artifact: DiscoveredArtifact | undefined;

    if (args.artifact) {
      // Find specific artifact
      artifact = artifacts.find(
        (a) =>
          a.name === args.artifact ||
          a.path === args.artifact ||
          a.path.endsWith(`/${args.artifact}`)
      );

      if (!artifact) {
        console.log(`Artifact "${args.artifact}" not found in source.`);
        console.log("\nAvailable artifacts:");
        for (const a of artifacts) {
          console.log(`  - ${a.name}`);
        }
        return;
      }
    } else if (artifacts.length === 1) {
      // Auto-select if only one artifact
      artifact = artifacts[0];
    } else {
      // Multiple artifacts, must specify
      console.log("Multiple artifacts found. Please specify which one to add:");
      console.log();
      for (const a of artifacts) {
        console.log(`  ${a.name}`);
        if (a.description) {
          const desc =
            a.description.length > 60
              ? a.description.slice(0, 57) + "..."
              : a.description;
          console.log(`    ${desc}`);
        }
      }
      console.log();
      console.log(`Usage: agpm add ${args.source} <artifact-name>`);
      return;
    }

    // Build artifact reference
    const artifactRef = `${source.name}/${artifact.name}`;

    // Check if already added
    if (config.artifacts.includes(artifactRef)) {
      console.log(`Artifact already configured: ${artifactRef}`);
      return;
    }

    // Also ensure source is in sources list
    if (!findSource(config.sources, source.name)) {
      config.sources.push(source);
    }

    // Add artifact
    config.artifacts.push(artifactRef);
    await saveConfig(cwd, config);

    console.log(`Added: ${artifactRef}`);
    if (artifact.description) {
      console.log(`  ${artifact.description}`);
    }
    console.log();
    console.log("Run `agpm install` to install the artifact.");
  },
});
