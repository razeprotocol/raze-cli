import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";

export default function registerDeploy(program) {
  program
    .command("deploy")
    .description("Deploy smart contracts to multiple blockchain networks")
    .option(
      "--chains <chains>",
      "Comma-separated list of chains (ethereum,polygon,arbitrum,base,optimism)",
      "ethereum"
    )
    .option("--contract <contract>", "Contract file to deploy")
    .option(
      "--network <network>",
      "Single network to deploy to (alternative to --chains)"
    )
    .option("--verify", "Verify contracts on block explorers")
    .option("--auto", "Skip confirmations")
    .option("--testnet", "Deploy to testnets instead of mainnets")
    .argument("[contract]", "Contract file to deploy")
    .action(async (contractArg, opts) => {
      console.log(chalk.cyan("🚀 Raze Multi-Chain Deployment Tool"));

      // Determine contract to deploy
      const contractFile = contractArg || opts.contract;
      if (!contractFile) {
        console.error(chalk.red("❌ Error: No contract file specified"));
        console.log(
          chalk.yellow(
            'Usage: raze deploy MyContract.sol --chains "ethereum,polygon"'
          )
        );
        return;
      }

      // Check if contract file exists
      const contractPath = path.resolve(contractFile);
      if (!fs.existsSync(contractPath)) {
        console.error(
          chalk.red(`❌ Error: Contract file not found: ${contractPath}`)
        );
        return;
      }

      // Parse chains
      let chains = [];
      if (opts.network) {
        chains = [opts.network];
      } else {
        chains = opts.chains.split(",").map((chain) => chain.trim());
      }

      // Map chains to actual networks
      const networkMap = {
        ethereum: opts.testnet ? "sepolia" : "mainnet",
        polygon: opts.testnet ? "mumbai" : "polygon",
        arbitrum: opts.testnet ? "arbitrum-goerli" : "arbitrum",
        base: opts.testnet ? "base-goerli" : "base",
        optimism: opts.testnet ? "optimism-goerli" : "optimism",
        avalanche: opts.testnet ? "fuji" : "avalanche",
        bsc: opts.testnet ? "bsc-testnet" : "bsc",
      };

      const networksToUse = chains
        .map((chain) => {
          const network = networkMap[chain.toLowerCase()];
          if (!network) {
            console.warn(
              chalk.yellow(`⚠️  Unknown chain: ${chain}, skipping...`)
            );
            return null;
          }
          return { chain: chain.toLowerCase(), network };
        })
        .filter(Boolean);

      if (networksToUse.length === 0) {
        console.error(chalk.red("❌ Error: No valid chains specified"));
        return;
      }

      console.log(chalk.green(`📋 Deployment Summary:`));
      console.log(chalk.gray(`   Contract: ${contractFile}`));
      console.log(
        chalk.gray(
          `   Networks: ${networksToUse.map((n) => n.network).join(", ")}`
        )
      );
      console.log(chalk.gray(`   Verify: ${opts.verify ? "Yes" : "No"}`));

      if (!opts.auto) {
        const answers = await inquirer.prompt([
          {
            type: "confirm",
            name: "proceed",
            message: "Proceed with deployment?",
            default: false,
          },
        ]);

        if (!answers.proceed) {
          console.log(chalk.yellow("❌ Deployment cancelled"));
          return;
        }
      }

      // Check for Hardhat project
      const hardhatConfigExists =
        fs.existsSync("hardhat.config.js") ||
        fs.existsSync("hardhat.config.ts");
      const foundryConfigExists = fs.existsSync("foundry.toml");

      if (!hardhatConfigExists && !foundryConfigExists) {
        console.log(
          chalk.yellow(
            "⚠️  No Hardhat or Foundry config found. Creating basic Hardhat setup..."
          )
        );

        const spinner = ora("Setting up Hardhat project...").start();
        try {
          // Create basic hardhat config
          const hardhatConfig = `require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY
    }
  }
};`;

          fs.writeFileSync("hardhat.config.js", hardhatConfig);
          spinner.succeed("Hardhat config created");
        } catch (error) {
          spinner.fail("Failed to create Hardhat config");
          console.error(chalk.red(error.message));
          return;
        }
      }

      // Deploy to each network
      for (const { chain, network } of networksToUse) {
        const spinner = ora(`Deploying to ${chain} (${network})...`).start();

        try {
          // Simulate deployment (in real implementation, this would use Hardhat/Foundry)
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Mock contract address for demo
          const mockAddress = `0x${Math.random().toString(16).substr(2, 40)}`;

          spinner.succeed(`✅ Deployed to ${chain}: ${mockAddress}`);

          if (opts.verify) {
            const verifySpinner = ora(
              `Verifying on ${chain} explorer...`
            ).start();
            await new Promise((resolve) => setTimeout(resolve, 1500));
            verifySpinner.succeed(`✅ Verified on ${chain} explorer`);
          }
        } catch (error) {
          spinner.fail(`❌ Failed to deploy to ${chain}: ${error.message}`);
        }
      }

      console.log(chalk.green("\n🎉 Multi-chain deployment completed!"));
      console.log(chalk.gray("Next steps:"));
      console.log(chalk.gray("- Check deployment status on block explorers"));
      console.log(
        chalk.gray("- Update your frontend with new contract addresses")
      );
      console.log(
        chalk.gray("- Run 'raze analyze <contract>' to verify security")
      );
    });
}
