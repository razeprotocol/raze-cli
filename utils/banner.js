import chalk from "chalk";
import figlet from "figlet";
import ora from "ora";
import os from "os";

export default function showBanner({
  noBanner = false,
  noAnim = false,
  version = "1.0.0",
} = {}) {
  if (noBanner) return;

  // Decorative swirl / mascot (safe-ascii)
  const swirl = `           -#####=
          -######-
    +###=    -######:
    ####* -#####%-................
    ####*######:=#################-
    ####* =%#-  =#################-
:*%=  ####*           ...:**:......
=####%==+++-              +####*
 :*####%=                =%####+
   *####%=              =%####+.
     *####*.         +####-=%####*.
       :::::=%+::::    .####:  =%##%-
################  .*#%-+####:    +-
%%%%%%%%%%%%%%%%.*###%=####:
                .*####%=.####:
               .*####%=  :####:
              +%##%=     ****:`;

  // Figlet title
  let title = "raze";
  try {
    title = figlet.textSync("raze", {
      horizontalLayout: "default",
      verticalLayout: "default",
    });
  } catch (e) {
    // fall back to simple title
  }

  console.log(chalk.magentaBright(swirl));
  console.log(chalk.cyanBright.bold(title));
  console.log(
    chalk.bold("Raze CLI — a minimal, fast, developer-friendly tool")
  );
  console.log(
    chalk.dim("────────────────────────────────────────────────────────")
  );
  console.log(
    `${chalk.gray("version")} ${chalk.yellow(version)}  ${chalk.gray(
      "node"
    )} ${chalk.yellow(process.version)}  ${chalk.gray(
      "platform"
    )} ${chalk.yellow(os.platform())}`
  );
  console.log(
    chalk.dim("────────────────────────────────────────────────────────")
  );

  if (!noAnim) {
    const spinner = ora({
      text: "Booting developer tools...",
      spinner: "dots",
    }).start();
    setTimeout(() => {
      spinner.succeed(
        chalk.green(
          "Ready — type " + chalk.bold("raze --help") + " to get started"
        )
      );
    }, 700);
  } else {
    console.log(
      chalk.green(
        "Ready — type " + chalk.bold("raze --help") + " to get started"
      )
    );
  }
}
