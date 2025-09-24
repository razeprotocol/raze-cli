import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { sleep } from "../utils/common.js";

export default function registerAsk(program) {
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
}
