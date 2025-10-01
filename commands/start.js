import chalk from "chalk";
import readline from "readline";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  renderStaticBlock,
  parseArgsStringToArgv,
  findClosest,
} from "../utils/common.js";

// All themes
const THEMES = {
  kali: (user, host, cwd) =>
    chalk.white("┌──(") +
    chalk.green(user) +
    chalk.white("@") +
    chalk.cyan(host) +
    chalk.white(")-[") +
    chalk.yellow(cwd) +
    chalk.white("]\n") +
    chalk.white("└─$ "),

  google: (user, host, cwd) =>
    chalk.red("[") +
    chalk.blue("G") +
    chalk.green("o") +
    chalk.yellow("o") +
    chalk.blue("g") +
    chalk.red("l") +
    chalk.green("e") +
    chalk.red("] ") +
    chalk.cyan(user + "@" + host) +
    " " +
    chalk.yellow(cwd) +
    "\n➜ ",

  github: (user, host, cwd) =>
    chalk.white(user + "@" + host + ":") +
    chalk.blue(cwd) +
    chalk.gray(" (main)") + // later: detect actual branch
    "\n$ ",

  vscode: (_u, _h, cwd) =>
    chalk.cyan("PS ") + chalk.yellow("~/" + cwd) + chalk.white("> "),

  xcode: (user, host, cwd) =>
    chalk.blue("▶ ") +
    chalk.white(user + "@" + host) +
    " " +
    chalk.yellow(cwd) +
    "\n❯ ",

  cyberpunk: (user, host, cwd) =>
    chalk.magentaBright(
      "✦ " + user.toUpperCase() + "@" + host.toUpperCase() + " ✦ "
    ) +
    chalk.cyanBright(cwd) +
    "\n» ",

  arcade: (user, host, cwd) =>
    chalk.yellow("╔═ " + user + "@" + host + " ═╗") +
    "\n" +
    chalk.green("╚═ " + cwd + " > "),

  fire: (user, host, cwd) =>
    chalk.red("🔥 " + user + "@" + host + " ") +
    chalk.yellow(cwd) +
    chalk.red(" 🔥\n→ "),

  matrix: (_u, _h, cwd) => chalk.green(`▮▮▮ ${cwd} ▮▮▮\nλ `),

  emoji: (user, host, cwd) =>
    `👤 ${chalk.green(user)}@${chalk.cyan(host)} 📂 ${chalk.yellow(cwd)}\n⚡ `,

  simple: (_u, _h, cwd) => chalk.blue(`${cwd} > `),

  box: (user, host, cwd) =>
    chalk.white("╔═[" + chalk.green(user) + "@" + chalk.cyan(host) + "]\n") +
    chalk.white("╚═[" + chalk.yellow(cwd) + "]> "),

  neon: (user, host, cwd) =>
    chalk.magentaBright(`<<< ${user}@${host} >>>`) +
    chalk.greenBright(` {${cwd}} `) +
    "\n➤ ",
};

function getPrompt(theme) {
  const user = process.env.USER || process.env.USERNAME || "user";
  const host = os.hostname();
  const cwd = path.basename(process.cwd()) || "~";
  return (THEMES[theme] || THEMES["kali"])(user, host, cwd);
}

export default function registerStart(program) {
  program
    .command("start")
    .description("Start an interactive session with themes")
    .action(() => {
      if (!process.stdin.isTTY) {
        console.log("Interactive session requires a TTY.");
        return;
      }
      if (process.stdout.isTTY) renderStaticBlock();

      let currentTheme = "kali";

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: getPrompt(currentTheme),
      });

      console.log(
        chalk.gray(
          'Interactive session. "help" for commands, "exit" to quit, "theme" to select theme.'
        )
      );
      rl.prompt();

      rl.on("line", async (line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          rl.setPrompt(getPrompt(currentTheme));
          rl.prompt();
          return;
        }

        if (trimmed === "exit" || trimmed === "quit") {
          rl.close();
          return;
        }

        if (trimmed === "help") {
          program.outputHelp();
          console.log(
            chalk.gray(
              "Extra commands:\n  theme              open theme menu\n  theme <name>       switch theme directly"
            )
          );
          rl.setPrompt(getPrompt(currentTheme));
          rl.prompt();
          return;
        }

        // THEME COMMAND
        if (trimmed.startsWith("theme")) {
          const parts = trimmed.split(/\s+/);
          if (parts.length === 1) {
            console.log(chalk.cyan("Select a theme:"));
            const keys = Object.keys(THEMES);
            keys.forEach((t, i) => {
              console.log(`${i + 1}. ${t}`);
            });

            rl.question("Enter number or name: ", (answer) => {
              let themeName;
              if (/^\d+$/.test(answer)) {
                const idx = parseInt(answer, 10) - 1;
                themeName = Object.keys(THEMES)[idx];
              } else {
                themeName = answer.trim();
              }
              if (themeName && THEMES[themeName]) {
                currentTheme = themeName;
                console.log(chalk.green(`Theme set to '${themeName}'`));
              } else {
                console.log(chalk.red("Invalid theme"));
              }
              rl.setPrompt(getPrompt(currentTheme));
              rl.prompt();
            });
            return;
          } else {
            const themeName = parts[1];
            if (THEMES[themeName]) {
              currentTheme = themeName;
              console.log(chalk.green(`Theme set to '${themeName}'`));
            } else {
              console.log(chalk.red(`Unknown theme: ${themeName}`));
              console.log("Available:", Object.keys(THEMES).join(", "));
            }
            rl.setPrompt(getPrompt(currentTheme));
            rl.prompt();
            return;
          }
        }

        // cd support
        const parts = parseArgsStringToArgv(trimmed);
        if (parts[0] === "cd") {
          const targetRaw = parts[1] || "";
          try {
            let target;
            if (!targetRaw || targetRaw === "~") {
              target =
                process.env.HOME || process.env.USERPROFILE || process.cwd();
            } else if (["..", "../", "..\\"].includes(targetRaw)) {
              target = path.resolve(process.cwd(), "..");
            } else {
              target = path.resolve(process.cwd(), targetRaw);
            }
            if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
              console.log(chalk.red(`cd: no such directory: ${target}`));
            } else {
              process.chdir(target);
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

        rl.setPrompt(getPrompt(currentTheme));
        rl.prompt();
      });

      rl.on("close", () => {
        console.log(chalk.gray("Goodbye."));
        process.exit(0);
      });
    });
}
