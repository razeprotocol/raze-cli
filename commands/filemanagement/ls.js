import fs from "fs";
import path from "path";
import chalk from "chalk";

function perms(mode) {
  const types = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
  return (
    (mode & fs.constants.S_IFDIR ? "d" : "-") +
    types[(mode >> 6) & 7] +
    types[(mode >> 3) & 7] +
    types[mode & 7]
  );
}

export default function registerLs(program) {
  program
    .command("ls")
    .description("List files in a directory")
    .argument("[dir]", "Directory to list", ".")
    .option("-a, --all", "Include hidden files")
    .option("-l, --long", "Long listing format")
    .action((dir, opts) => {
      try {
        const target = path.resolve(dir || ".");
        const stat = fs.existsSync(target) && fs.statSync(target);
        if (!stat) {
          console.error(chalk.red("ls: no such file or directory:"), target);
          return;
        }
        if (!stat.isDirectory()) {
          // single file
          if (opts.long) {
            const s = fs.statSync(target);
            console.log(
              perms(s.mode),
              s.size.toString().padStart(8, " "),
              s.mtime.toISOString(),
              path.basename(target)
            );
          } else {
            console.log(path.basename(target));
          }
          return;
        }

        const entries = fs.readdirSync(target, { withFileTypes: true });
        const filtered = entries.filter(
          (e) => opts.all || !e.name.startsWith(".")
        );
        filtered.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        for (const e of filtered) {
          const full = path.join(target, e.name);
          if (opts.long) {
            const s = fs.statSync(full);
            const name = e.isDirectory()
              ? chalk.blue(e.name + "/")
              : e.isFile()
              ? s.mode & 0o111
                ? chalk.green(e.name)
                : e.name
              : e.name;
            console.log(
              perms(s.mode),
              s.size.toString().padStart(8, " "),
              s.mtime.toISOString(),
              name
            );
          } else {
            const name = e.isDirectory()
              ? chalk.blue(e.name + "/")
              : e.isFile()
              ? fs.statSync(full).mode & 0o111
                ? chalk.green(e.name)
                : e.name
              : e.name;
            process.stdout.write(name + "\t");
          }
        }
        if (!opts.long) process.stdout.write("\n");
      } catch (err) {
        console.error(chalk.red("ls failed:"), err.message || err);
      }
    });
}
