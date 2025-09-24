import fs from "fs";
import path from "path";
import chalk from "chalk";

export default function registerMkdir(program) {
  program
    .command("mkdir")
    .description("Create a directory (recursive by default)")
    .argument("<dir>", "Directory to create")
    .action((dir) => {
      try {
        const target = path.resolve(dir);
        fs.mkdirSync(target, { recursive: true });
        console.log(chalk.green("Created:"), chalk.yellow(target));
      } catch (err) {
        console.error(chalk.red("mkdir failed:"), err.message || err);
      }
    });
}
