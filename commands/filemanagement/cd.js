import path from "path";
import fs from "fs";
import chalk from "chalk";

export default function registerCd(program) {
  program
    .command("cd")
    .description("Change directory (non-interactive: prints the resolved path)")
    .argument("[dir]", "Directory to change to (empty -> home)")
    .action((dir) => {
      try {
        let target;
        if (!dir || dir === "~") {
          target = process.env.HOME || process.env.USERPROFILE || process.cwd();
        } else {
          target = path.resolve(dir);
        }
        // verify exists and is directory
        const stat = fs.existsSync(target) && fs.statSync(target);
        if (!stat || !stat.isDirectory()) {
          console.error(chalk.red("cd: no such directory:"), target);
          return;
        }
        // In non-interactive mode we cannot change parent process cwd, so print resolved path
        console.log(chalk.cyan("Change directory to:"), chalk.yellow(target));
      } catch (err) {
        console.error(chalk.red("cd failed:"), err.message || err);
      }
    });
}
