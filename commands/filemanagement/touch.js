import fs from "fs";
import path from "path";
import chalk from "chalk";

export default function registerTouch(program) {
  program
    .command("touch")
    .description("Create an empty file or update its timestamp")
    .argument("<file>", "File to touch")
    .action((file) => {
      try {
        const target = path.resolve(file);
        const time = new Date();
        try {
          fs.utimesSync(target, time, time);
        } catch (e) {
          // file may not exist
          fs.closeSync(fs.openSync(target, "w"));
        }
        console.log(chalk.green("Touched:"), chalk.yellow(target));
      } catch (err) {
        console.error(chalk.red("touch failed:"), err.message || err);
      }
    });
}
