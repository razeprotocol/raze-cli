#!/usr/bin/env node

import { Command } from "commander";

import registerAi from "./commands/ai.js";
import registerLoad from "./commands/load.js";
import registerStyle from "./commands/style.js";
import registerAsk from "./commands/ask.js";
import registerStart from "./commands/start.js";

const program = new Command();

program
  .name("raze")
  .version("1.0.0")
  .option("--no-banner", "Hide the startup banner (for scripts/CI)")
  .option("--no-anim", "Disable banner animation (still shows static banner)")
  .description("An example of a beautiful and cool CLI");

program.exitOverride();

// Register commands from modules
registerAi(program);
registerLoad(program);
registerStyle(program);
registerAsk(program);
registerStart(program);

// parse CLI args
program.parse(process.argv);
