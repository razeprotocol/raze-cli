import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

export default function registerNft(program) {
  program
    .command("nft")
    .description("NFT and Web3 gaming development tools")
    .option("--standard <standard>", "NFT standard (ERC721, ERC1155)", "ERC721")
    .option(
      "--marketplace <marketplace>",
      "Target marketplace (opensea, rarible, foundation)",
      "opensea"
    )
    .argument("[action]", "NFT action to perform")
    .action(async (action, opts) => {
      const nftActions = [
        "Create NFT collection",
        "Generate artwork programmatically",
        "Setup minting website",
        "Create gaming NFTs",
        "Build marketplace integration",
        "Setup royalty mechanism",
        "Create utility NFTs",
        "Build NFT staking",
        "Setup dynamic NFTs",
        "Create cross-chain NFTs",
      ];

      if (!action) {
        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: "What NFT feature would you like to build?",
            choices: nftActions,
          },
        ]);
        action = answers.action;
      }

      console.log(chalk.magenta(`🎨 NFT Action: ${action}`));
      console.log(
        chalk.gray(
          `Standard: ${opts.standard} | Marketplace: ${opts.marketplace}`
        )
      );

      const spinner = ora("Creating NFT feature...").start();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      spinner.succeed(chalk.green("NFT feature ready!"));
    });
}
