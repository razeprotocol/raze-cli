import fs from "fs";
import path from "path";
import chalk from "chalk";

export default function registerRm(program) {
  program
    .command("rm")
    .description("Remove files or directories")
    .option(
      "-r, --recursive",
      "Remove directories and their contents recursively"
    )
    .option("-f, --force", "Ignore nonexistent files and do not prompt")
    .argument("<target>", "File or directory to remove")
    .action((target, opts) => {
      try {
        const full = path.resolve(target);
        if (!fs.existsSync(full)) {
          if (opts.force) return;
          console.error(chalk.red("rm: no such file or directory:"), full);
          return;
        }
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (!opts.recursive) {
            console.error(
              chalk.red("rm: cannot remove '%s': Is a directory (use -r)"),
              full
            );
            return;
          }
          // recursive remove
          fs.rmSync(full, { recursive: true, force: !!opts.force });
          console.log(chalk.green("Removed directory:"), chalk.yellow(full));
        } else {
          fs.unlinkSync(full);
          console.log(chalk.green("Removed file:"), chalk.yellow(full));
        }
      } catch (err) {
        console.error(chalk.red("rm failed:"), err.message || err);
      }
    });
}
