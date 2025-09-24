import path from "path";
import chalk from "chalk";

export default function registerPwd(program) {
  program
    .command("pwd")
    .description("Print the current working directory for the CLI")
    .action(() => {
      // resolve and print the current working directory
      const cwd = process.cwd();
      console.log(chalk.cyan.bold("Current directory:"), chalk.yellow(cwd));
    });
}
