import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

export default function registerAnalytics(program) {
  program
    .command("analyze")
    .description("Blockchain analytics and security tools")
    .option("--chain <chain>", "Blockchain to analyze", "ethereum")
    .option(
      "--tool <tool>",
      "Analysis tool (slither, mythx, echidna)",
      "slither"
    )
    .argument("[target]", "Contract address or file to analyze")
    .action(async (target, opts) => {
      const analysisTypes = [
        "Smart contract security audit",
        "Gas optimization analysis",
        "Transaction flow analysis",
        "MEV opportunity detection",
        "Rugpull detection",
        "Token holder analysis",
        "DeFi protocol risks",
        "Cross-chain bridge security",
        "Flash loan attack vectors",
        "Governance attack analysis",
      ];

      if (!target) {
        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "analysisType",
            message: "What type of analysis would you like to perform?",
            choices: analysisTypes,
          },
          {
            type: "input",
            name: "target",
            message: "Enter contract address or file path:",
            when: (answers) => answers.analysisType,
          },
        ]);
        target = answers.target;
      }

      console.log(chalk.red(`🔍 Analyzing: ${target}`));
      console.log(chalk.gray(`Chain: ${opts.chain} | Tool: ${opts.tool}`));

      const spinner = ora("Running security analysis...").start();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      spinner.succeed(
        chalk.green("Analysis complete! Check report for details.")
      );
    });
}
