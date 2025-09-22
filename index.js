#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import ora from "ora";
import inquirer from "inquirer";

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

  // Apply a soft gradient (magenta -> violet -> cyan) across lines
  const palette = [
    chalk.magentaBright,
    chalk.hex("#ff7038ff"),
    chalk.hex("#ffffffff"),
    chalk.cyanBright,
  ];
  const coloredBlock = block.map((line, i) =>
    palette[i % palette.length](line)
  );
  console.log(swirl);
  console.log(coloredBlock.join("\n"));
  console.log(
    chalk.gray("Raze CLI — a minimal, fast, developer-friendly tool\n")
  );
}

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
    process.stdout.write("\x1b[2J\x1b[0;0H"); // clear screen
    console.log(chalk.red(frames[i]));
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

// This line is essential for parsing the arguments and executing the commands
// Peek for --no-banner before parsing (so we don't need a preliminary parse pass)
// We need an async wrapper to allow optional animation before full parse.
(async () => {
  const argv = process.argv;
  const hideBanner = argv.includes("--no-banner");
  const noAnim = argv.includes("--no-anim");
  if (!hideBanner) {
    try {
      if (!noAnim) {
        await renderAnimatedBanner();
      } else {
        renderStaticBlock();
      }
    } catch (_) {
      /* ignore */
    }
  }
  program.parse(argv);
})();
