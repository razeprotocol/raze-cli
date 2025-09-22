#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import ora from "ora";
import inquirer from "inquirer";
import readline from "readline";

// A simple utility function for creating a delay
const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

// --- Main Program Setup ---
const program = new Command();

// ---- Banner / Logo Rendering ----
// Provide an Ubuntu/Debian-inspired stylized logo.
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

  // Use the requested magenta/violet/cyan palette
  const palette = [
    chalk.magentaBright,
    chalk.hex("#d147ff"),
    chalk.hex("#a470ff"),
    chalk.cyanBright,
  ];
  const coloredBlock = block.map((line, i) =>
    palette[i % palette.length](line)
  );
  // Print swirl then colored block
  console.log(swirl);
  console.log(coloredBlock.join("\n"));
  console.log(
    chalk.gray("Raze CLI — a minimal, fast, developer-friendly tool\n")
  );
}

// --- Command 4: AI via Gemini (HTTP) ---
program
  .command("ai")
  .description("Query an AI model (Gemini). Reads GEMINI_API_KEY from env.")
  .argument("[prompt...]", "Prompt to send to the model")
  .option("--model <model>", "Model to use", "gemini-1.5-flash-latest")
  .action(async (promptParts, opts) => {
    // Prefer environment variable; fallback only for local testing (not recommended).
    const apiKey =
      process.env.GEMINI_API_KEY || "AIzaSyCadIp6D7oWiF9k8-rrgZ8DiPcohA0F-pA";
    if (!apiKey) {
      console.error(
        chalk.red(
          "GEMINI_API_KEY is not set. Export your key as an environment variable (do NOT commit it to source)."
        )
      );
      return; // return instead of exiting so REPL can continue
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
          "Global fetch() is not available in your Node runtime. Use Node 18+ or install a fetch polyfill."
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
      if (out) {
        console.log(out);
      } else {
        console.log(
          chalk.yellow("Could not parse response, showing raw JSON:")
        );
        console.log(JSON.stringify(data, null, 2));
      }
      console.log(chalk.cyan.bold("--- End Response ---"));
    } catch (err) {
      spinner.fail();
      console.error(chalk.red("AI request failed:"), err.message || err);
      return;
    }
  });

async function renderAnimatedBanner() {
  if (!process.stdout.isTTY) {
    renderStaticBlock();
    return;
  }
  const frames = [
    "   .\n  .:;\n .:kk;\n .:kk;\n  .:;\n   .",
    "    ..\n  .:ll:.\n .:kkkk:.\n .:kkkk:.\n  .:ll:.\n    ..",
    "      ..\n   .:llll:.\n  .:kkkkkk:.\n  .:kkkkkk:.\n   .:llll:.\n      ..",
    "        ..\n    .:lllll:.\n   .:kkkkkkkk:.\n   .:kkkkkkkk:.\n    .:lllll:.\n        ..",
  ];
  const blockLines = figlet
    .textSync("RAZE", { font: "ANSI Shadow" })
    .split("\n");
  const palette = [
    chalk.magentaBright,
    chalk.hex("#d147ff"),
    chalk.hex("#a470ff"),
    chalk.cyanBright,
  ];
  const coloredBlock = blockLines.map((l, i) => palette[i % palette.length](l));
  for (let i = 0; i < frames.length; i++) {
    console.clear();
    console.log(chalk.gray(frames[i]));
    console.log(coloredBlock.join("\n"));
    console.log(
      chalk.gray("Raze CLI — a minimal, fast, developer-friendly tool\n")
    );
    await new Promise((r) => setTimeout(r, 120));
  }
}

program
  .name("raze")
  .version("1.0.0")
  .option("--no-banner", "Hide the startup banner (for scripts/CI)")
  .option("--no-anim", "Disable banner animation (still shows static banner)")
  .description("An example of a beautiful and cool CLI");

// Make commander throw instead of calling process.exit — the REPL will catch errors and continue.
program.exitOverride();

// --- Command 1: A command with a spinner ---
program
  .command("load")
  .description("Simulate a long-running task with a spinner.")
  .action(async () => {
    const spinner = ora("Performing a very important task...").start();
    await sleep(); // Simulate work
    spinner.succeed(chalk.green("Task completed successfully!"));
  });

// --- Command 2: A command with styled output ---
program
  .command("style")
  .description("Showcase different text styles with Chalk.")
  .argument("<text>", "Text to display")
  .action((text) => {
    console.log(chalk.bold.blue("Here is your text styled:"));
    console.log(chalk.red("Red text"));
    console.log(chalk.green.underline.bold(text)); // Chaining styles
    console.log(chalk.bgYellow.black("Text with a background!"));
  });

// --- Command 3: An interactive command ---
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

(async () => {
  const argv = process.argv;
  const hideBanner = argv.includes("--no-banner");
  if (!hideBanner) {
    try {
      renderStaticBlock();
    } catch (_) {
      /* ignore */
    }
  }
  // Helper: split a typed command line into argv-style tokens.
  // Simple port of npm's `string-argv` logic to handle quoted strings.
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
        // handle simple escape
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

  // Interactive 'start' session: allow running subcommands without typing the `raze` prefix.
  program
    .command("start")
    .description(
      "Start an interactive session. Type commands (load, style, ask, ai, help, exit) without prefix."
    )
    .action(async () => {
      if (!process.stdin.isTTY) {
        console.log("Interactive session requires a TTY.");
        return;
      }

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

        // Parse the line into argv-like array and dispatch to commander
        const parts = parseArgsStringToArgv(trimmed);
        // Build argv like: [node, script, ...parts]
        const fakeArgv = [process.argv[0], process.argv[1], ...parts];
        try {
          await program.parseAsync(fakeArgv);
        } catch (err) {
          // Commander throws on unknown commands because of exitOverride().
          // Don't exit the REPL — report error and continue.
          if (err && typeof err.exitCode === "number") {
            // Known commander exit (like missing required arg). Print the message.
            console.error(chalk.red(err.message));
          } else {
            console.error(
              chalk.red("Error executing command:"),
              err.message || err
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

  program.parse(process.argv);
})();
