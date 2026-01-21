#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { sourceCommand } from "./commands/source.js";
import { addCommand } from "./commands/add.js";
import { installCommand } from "./commands/install.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { updateCommand } from "./commands/update.js";

// Sync is an alias for install
const syncCommand = defineCommand({
  meta: {
    name: "sync",
    description: "Sync artifacts (alias for install)",
  },
  args: installCommand.args,
  run: installCommand.run,
});

const main = defineCommand({
  meta: {
    name: "agpm",
    version: "0.0.1",
    description: "Agent Package Manager - Universal package manager for AI coding tool artifacts",
  },
  subCommands: {
    source: sourceCommand,
    add: addCommand,
    install: installCommand,
    sync: syncCommand,
    list: listCommand,
    remove: removeCommand,
    update: updateCommand,
  },
});

runMain(main);
