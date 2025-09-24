import ora from "ora";
import chalk from "chalk";
import { sleep } from "../utils/common.js";

export default function registerLoad(program) {
  program
    .command("load")
    .description("Simulate a long-running task with a spinner.")
    .action(async () => {
      const spinner = ora("Performing a very important task...").start();
      await sleep();
      spinner.succeed(chalk.green("Task completed successfully!"));
    });
}
