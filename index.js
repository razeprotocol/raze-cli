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

// Display a cool welcome banner every time the CLI runs
console.log(
  chalk.cyan(figlet.textSync("Cool CLI", { horizontalLayout: "full" }))
);

program.version("1.0.0").description("An example of a beautiful and cool CLI");

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
program.parse(process.argv);
