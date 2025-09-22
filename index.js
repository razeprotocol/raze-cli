#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import ora from "ora";
import inquirer from "inquirer";
import readline from "readline";
import { spawn } from "child_process";

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));
const program = new Command();

function renderStaticBlock() {
  const swirl = `
              .,;::::,..
          .:'';lllllc'........
       .:'lkkkkkkkkkkkkkkkkkkkk:...
     .:kkkkkkkkkkkkkkkkkkkkkkkkkkkdc.
    .ckkkkkkkkkkkkkkkkkkkkkkkkkkkkkkx,
   .ckkkkkkkkkkkkkkko:'...':okkkkkkkko.
  .okkkkkkkkkkkkkk:.         'okkkkkkko.
 .:kkkkkkkkkkkkkkc             ckkkkkkkd.
.okkkkkkkkkkkkkkkc             ckkkkkkkko.
ckkkkkkkkkkkkkkkk:             ckkkkkkkkko
okkkkkkkkkkkkkkkk:             ckkkkkkkkko
ckkkkkkkkkkkkkkkkc             ckkkkkkkkko
'okkkkkkkkkkkkkkko.           .okkkkkkkkko
.dkkkkkkkkkkkkkkkd.          .okkkkkkkkkk,
 .:kkkkkkkkkkkkkkkkc.      .:okkkkkkkkkkd.
  .okkkkkkkkkkkkkkkkkc.  .:okkkkkkkkkkko.
   .lkkkkkkkkkkkkkkkkkkxookkkkkkkkkkkko.
    .ckkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko.
     .':oxkkkkkkkkkkkkkkkkkkkkkkkkxo,
         ..';:cloxkOOkkxooc:;'..
               ..,;;;,,..
`;
  const block = figlet.textSync("RAZE", { font: "ANSI Shadow" }).split("\n");
  const palette = [
    chalk.magentaBright,
    chalk.hex("#d147ff"),
    chalk.hex("#a470ff"),
    chalk.cyanBright,
  ];
  console.log(swirl);
  console.log(block.map((l, i) => palette[i % palette.length](l)).join("\n"));
  console.log(
    chalk.gray("Raze CLI — a minimal, fast, developer-friendly tool\n")
  );
}

program
  .command("ai")
  .description("Query an AI model (Gemini). Reads GEMINI_API_KEY from env.")
  .argument("[prompt...]", "Prompt to send to the model")
  .option("--model <model>", "Model to use", "gemini-1.5-flash-latest")
  .action(async (promptParts, opts) => {
    const apiKey = "AIzaSyCadIp6D7oWiF9k8-rrgZ8DiPcohA0F-pA";
    if (!apiKey) {
      console.error(
        chalk.red(
          "GEMINI_API_KEY is not set. Set GEMINI_API_KEY environment variable."
        )
      );
      return;
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${apiKey}`;
    let prompt =
      promptParts && promptParts.length ? promptParts.join(" ") : undefined;
    if (!prompt) {
      const answers = await inquirer.prompt([
        { name: "q", message: "Enter prompt:" },
      ]);
      prompt = answers.q;
    }
    if (!prompt) {
      console.error(chalk.red("No prompt provided."));
      return;
    }
    if (typeof fetch !== "function") {
      console.error(
        chalk.red(
          "Global fetch() is not available in your Node runtime. Use Node 18+ or add a fetch polyfill."
        )
      );
      return;
    }
    const spinner = ora("AI is thinking...").start();
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!res.ok) {
        const errText = await res.text();
        spinner.fail();
        console.error(
          chalk.red(`AI request failed (${res.status}): ${errText}`)
        );
        return;
      }
      const data = await res.json();
      spinner.succeed(chalk.green("AI responded!"));
      const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log("\n" + chalk.cyan.bold("--- AI Response ---"));
      if (out) console.log(out);
      else {
        console.log(
          chalk.yellow("Could not parse response, showing raw JSON:")
        );
        console.log(JSON.stringify(data, null, 2));
      }
      console.log(chalk.cyan.bold("--- End Response ---"));
    } catch (err) {
      spinner.fail();
      console.error(chalk.red("AI request failed:"), err?.message || err);
      return;
    }
  });

program
  .name("raze")
  .version("1.0.0")
  .option("--no-banner", "Hide the startup banner (for scripts/CI)")
  .option("--no-anim", "Disable banner animation (still shows static banner)")
  .description("An example of a beautiful and cool CLI");

program.exitOverride();

program
  .command("load")
  .description("Simulate a long-running task with a spinner.")
  .action(async () => {
    const spinner = ora("Performing a very important task...").start();
    await sleep();
    spinner.succeed(chalk.green("Task completed successfully!"));
  });

program
  .command("style")
  .description("Showcase different text styles with Chalk.")
  .argument("<text>", "Text to display")
  .action((text) => {
    console.log(chalk.bold.blue("Here is your text styled:"));
    console.log(chalk.red("Red text"));
    console.log(chalk.green.underline.bold(text));
    console.log(chalk.bgYellow.black("Text with a background!"));
  });

program
  .command("ask")
  .description("Ask the user a series of interactive questions.")
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "What is your name?",
        default: "Guest",
      },
      {
        type: "list",
        name: "choice",
        message: "Choose your favorite color:",
        choices: ["Red", "Green", "Blue", "Yellow"],
      },
      {
        type: "confirm",
        name: "isConfirmed",
        message: "Are you sure you want to proceed?",
      },
    ]);
    if (answers.isConfirmed) {
      const spinner = ora("Processing your request...").start();
      await sleep(1500);
      spinner.succeed(chalk.green("Done!"));
      console.log(
        `\nHello ${chalk.yellow.bold(
          answers.name
        )}! Your favorite color is ${chalk.bold(answers.choice)}.`
      );
    } else {
      console.log(chalk.red("Operation cancelled."));
    }
  });

function parseArgsStringToArgv(str) {
  const args = [];
  let current = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  while (i < str.length) {
    const ch = str[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      i++;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      i++;
      continue;
    }
    if (ch === " " && !inSingle && !inDouble) {
      if (current.length) {
        args.push(current);
        current = "";
      }
      i++;
      continue;
    }
    if (ch === "\\" && i + 1 < str.length) {
      current += str[i + 1];
      i += 2;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.length) args.push(current);
  return args;
}

// Find the closest command name (simple Levenshtein distance)
function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0);
  const v1 = new Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j++) v0[j] = j;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function findClosest(token, list) {
  let best = null;
  let bestScore = Infinity;
  for (const item of list) {
    const d = levenshtein(token, item);
    if (d < bestScore) {
      bestScore = d;
      best = item;
    }
  }
  // only suggest if reasonably close
  return bestScore <= Math.max(2, Math.floor(token.length / 2)) ? best : null;
}

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

      // quick check: avoid spawning child for unknown commands so we don't get commander stack traces
      const firstToken = trimmed.split(/\s+/)[0];
      const knownCommands = program.commands.map((c) => c.name());
      if (!firstToken.startsWith("-") && !knownCommands.includes(firstToken)) {
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

      const parts = parseArgsStringToArgv(trimmed);
      try {
        await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [process.argv[1], ...parts], {
            stdio: "inherit",
          });
          child.on("error", reject);
          child.on("close", () => resolve());
        });
      } catch (err) {
        console.error(chalk.red("Failed to run command:"), err?.message || err);
      }
      rl.prompt();
    });

    rl.on("close", () => {
      console.log(chalk.gray("Goodbye."));
      process.exit(0);
    });
  });

program.parse(process.argv);
