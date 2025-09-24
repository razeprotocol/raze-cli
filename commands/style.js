import chalk from "chalk";

export default function registerStyle(program) {
  program
    .command("style")
    .description("Showcase different text styles with Chalk.")
    .argument("<text>", "Text to display")
    .action((text) => {
      console.log(chalk.bold.blue("Here is your text styled:"));
      console.log(chalk.red("Red text"));
      console.log(chalk.green.underline.bold(text));
      console.log(chalk.bgYellow.black("Text with a background!"));
    });
}
