#!/usr/bin/env node

import { Command } from "commander";

import registerAi from "./commands/ai.js";
import registerLoad from "./commands/load.js";
import registerStyle from "./commands/style.js";
import registerAsk from "./commands/ask.js";
import registerStart from "./commands/start.js";
import registerPwd from "./commands/filemanagement/pwd.js";
import registerMkdir from "./commands/filemanagement/mkdir.js";
import registerTouch from "./commands/filemanagement/touch.js";
import registerCd from "./commands/filemanagement/cd.js";
import registerLs from "./commands/filemanagement/ls.js";
import registerRm from "./commands/filemanagement/rm.js";

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
registerPwd(program);
registerMkdir(program);
registerTouch(program);
registerCd(program);
registerLs(program);
registerRm(program);

// parse CLI args
program.parse(process.argv);
