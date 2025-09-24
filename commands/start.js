import chalk from "chalk";
import readline from "readline";
import { spawn } from "child_process";
import {
  renderStaticBlock,
  parseArgsStringToArgv,
  findClosest,
} from "../utils/common.js";

export default function registerStart(program) {
  program
    .command("start")
    .description(
      "Start an interactive session. Type commands without the 'raze' prefix."
    )
    .action(() => {
      if (!process.stdin.isTTY) {
        console.log("Interactive session requires a TTY.");
        return;
      }
      if (process.stdout.isTTY) renderStaticBlock();
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green("raze> "),
      });
      console.log(
        chalk.gray(
          'Entering interactive session. Type "help" for commands, "exit" to quit.'
        )
      );
      rl.prompt();

      rl.on("line", async (line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          rl.prompt();
          return;
        }
        if (trimmed === "exit" || trimmed === "quit") {
          rl.close();
          return;
        }
        if (trimmed === "help") {
          program.outputHelp();
          rl.prompt();
          return;
        }

        const firstToken = trimmed.split(/\s+/)[0];
        const knownCommands = program.commands.map((c) => c.name());
        if (
          !firstToken.startsWith("-") &&
          !knownCommands.includes(firstToken)
        ) {
          const suggestion = findClosest(firstToken, knownCommands);
          console.log(
            chalk.yellow(
              `Unknown command: '${firstToken}'.${
                suggestion ? ` Did you mean '${suggestion}'?` : ""
              }`
            )
          );
          console.log(
            chalk.gray("Available commands:"),
            knownCommands.join(", ")
          );
          rl.prompt();
          return;
        }

        // handle interactive cd locally so the session cwd changes
        const parts = parseArgsStringToArgv(trimmed);
        if (parts[0] === "cd") {
          // support: cd, cd ., cd .., cd ../x, cd path
          const targetRaw = parts[1] || "";
          try {
            let target;
            if (!targetRaw || targetRaw === "~") {
              target =
                process.env.HOME || process.env.USERPROFILE || process.cwd();
            } else if (
              targetRaw === ".." ||
              targetRaw === "../" ||
              targetRaw === "..\\"
            ) {
              target = require("path").resolve(process.cwd(), "..");
            } else {
              target = require("path").resolve(process.cwd(), targetRaw);
            }
            // validate
            const fs = require("fs");
            if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
              console.log(chalk.red(`cd: no such directory: ${target}`));
            } else {
              process.chdir(target);
              console.log(
                chalk.cyan("Directory changed to:"),
                chalk.yellow(process.cwd())
              );
            }
          } catch (err) {
            console.error(chalk.red("cd failed:"), err?.message || err);
          }
        } else {
          try {
            await new Promise((resolve, reject) => {
              const child = spawn(
                process.execPath,
                [process.argv[1], ...parts],
                {
                  stdio: "inherit",
                }
              );
              child.on("error", reject);
              child.on("close", () => resolve());
            });
          } catch (err) {
            console.error(
              chalk.red("Failed to run command:"),
              err?.message || err
            );
          }
        }
        rl.prompt();
      });

      rl.on("close", () => {
        console.log(chalk.gray("Goodbye."));
        process.exit(0);
      });
    });
}
