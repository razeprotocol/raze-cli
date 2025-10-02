import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
    .option("--local", "Deploy to local hardhat network (localhost)")
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

      // Parse chains and handle local deployment
      let chains = [];
      
      if (opts.local) {
        // Force local deployment
        chains = ["localhost"];
      } else if (opts.network) {
        chains = [opts.network];
      } else {
        chains = opts.chains.split(",").map((chain) => chain.trim());
      }

      // Map chains to actual networks
      const networkMap = {
        ethereum: opts.testnet ? "sepolia" : "sepolia", // Use sepolia for now since mainnet isn't configured
        polygon: opts.testnet ? "mumbai" : "polygon",
        arbitrum: opts.testnet ? "arbitrum-goerli" : "arbitrum",
        base: opts.testnet ? "base-goerli" : "base",
        optimism: opts.testnet ? "optimism-goerli" : "optimism",
        avalanche: opts.testnet ? "fuji" : "avalanche",
        bsc: opts.testnet ? "bsc-testnet" : "bsc",
        localhost: "localhost", // Add localhost mapping
      };

      const networksToUse = chains
        .map((chain) => {
          const network = networkMap[chain.toLowerCase()] || chain.toLowerCase();
          
          if (chain.toLowerCase() === "localhost") {
            return { chain: "localhost", network: "localhost" };
          }
          
          if (!networkMap[chain.toLowerCase()]) {
            console.warn(
              chalk.yellow(`⚠️  Unknown chain: ${chain}, skipping...`)
            );
            return null;
          }

          // Warn if trying to deploy to mainnet without proper config
          if (!opts.testnet && network !== "polygon") {
            console.warn(
              chalk.yellow(
                `⚠️  Mainnet deployment for ${chain} requires proper RPC configuration. Using testnet instead.`
              )
            );
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
          // Real deployment using Hardhat
          if (hardhatConfigExists) {
            // Handle localhost deployment specially
            if (network === "localhost") {
              spinner.text = `Checking localhost network...`;
              
              try {
                // Test if localhost is running
                await execAsync("curl -s http://127.0.0.1:8545 -X POST -H \"Content-Type: application/json\" -d '{\"jsonrpc\":\"2.0\",\"method\":\"net_version\",\"params\":[],\"id\":1}'", {
                  timeout: 2000
                });
              } catch (error) {
                spinner.warn(`⚠️  Localhost network not running. Try running 'npx hardhat node' in another terminal.`);
                continue;
              }
            }

            // Check if dependencies are installed
            if (!fs.existsSync(path.join(process.cwd(), "node_modules"))) {
              spinner.text = `Installing dependencies...`;
              try {
                await execAsync("npm install", { cwd: process.cwd() });
              } catch (installError) {
                spinner.fail(`❌ Failed to install dependencies: ${installError.message}`);
                continue;
              }
            }

            const deployCommand = `npx hardhat run scripts/deploy.js --network ${network}`;
            const { stdout, stderr } = await execAsync(deployCommand, {
              cwd: process.cwd(),
              env: { ...process.env, FORCE_COLOR: "1" },
              timeout: 60000 // 60 second timeout
            });

            // Extract contract address from output
            const addressMatch = stdout.match(
              /deployed to:?\s*(0x[a-fA-F0-9]{40})/i
            );
            const contractAddress = addressMatch
              ? addressMatch[1]
              : null;

            if (contractAddress) {
              spinner.succeed(`✅ Deployed to ${chain}: ${contractAddress}`);
              
              // Save deployment info to deployments.json
              const deploymentsFile = path.join(process.cwd(), "deployments.json");
              let deployments = {};
              
              if (fs.existsSync(deploymentsFile)) {
                try {
                  deployments = JSON.parse(fs.readFileSync(deploymentsFile, "utf8"));
                } catch {}
              }
              
              deployments[`${chain}-${network}`] = {
                address: contractAddress,
                timestamp: new Date().toISOString(),
                contract: contractFile,
                network: network,
                chain: chain
              };
              
              fs.writeFileSync(deploymentsFile, JSON.stringify(deployments, null, 2));
              
            } else {
              spinner.warn(`⚠️  Deployed to ${chain} but couldn't extract address. Check output above.`);
              if (stdout) console.log(chalk.gray(stdout));
            }

            // Handle verification
            if (opts.verify && contractAddress) {
              const verifySpinner = ora(`Verifying on ${chain} explorer...`).start();
              try {
                const verifyCommand = `npx hardhat verify --network ${network} ${contractAddress}`;
                await execAsync(verifyCommand, { 
                  cwd: process.cwd(),
                  timeout: 30000
                });
                verifySpinner.succeed(`✅ Verified on ${chain} explorer`);
              } catch (verifyError) {
                verifySpinner.warn(`⚠️  Verification failed: Contract may already be verified or verification service is unavailable`);
              }
            }

          } else {
            // Fallback to simulation for non-Hardhat projects
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const mockAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
            spinner.warn(
              `⚠️  Simulated deployment to ${chain}: ${mockAddress} (No real deployment - missing Hardhat config)`
            );
          }
        } catch (error) {
          spinner.fail(`❌ Failed to deploy to ${chain}: ${error.message}`);
          
          // Provide helpful error messages
          if (error.message.includes("network") || error.message.includes("HH100")) {
            console.log(chalk.yellow(`💡 Tip: Make sure ${network} is configured in your hardhat.config.js`));
          } else if (error.message.includes("insufficient funds") || error.message.includes("balance")) {
            console.log(chalk.yellow(`💡 Tip: Make sure you have enough ETH in your wallet for ${network}`));
          } else if (error.message.includes("private key") || error.message.includes("PRIVATE_KEY")) {
            console.log(chalk.yellow(`💡 Tip: Set your PRIVATE_KEY environment variable or add it to .env file`));
          } else if (error.message.includes("timeout")) {
            console.log(chalk.yellow(`💡 Tip: Network might be slow. Try again or use a different RPC endpoint`));
          }
        }
      }

      console.log(chalk.green("\n🎉 Multi-chain deployment completed!"));
      
      // Show deployment summary
      const deploymentsFile = path.join(process.cwd(), "deployments.json");
      if (fs.existsSync(deploymentsFile)) {
        try {
          const deployments = JSON.parse(fs.readFileSync(deploymentsFile, "utf8"));
          console.log(chalk.cyan("\n📄 Deployment Summary:"));
          Object.entries(deployments).forEach(([key, info]) => {
            console.log(chalk.gray(`  ${key}: ${info.address}`));
          });
          console.log(chalk.gray(`\n💾 Full details saved to: deployments.json`));
        } catch {}
      }
      
      console.log(chalk.gray("\nNext steps:"));
      if (opts.local || networksToUse.some(n => n.network === "localhost")) {
        console.log(chalk.gray("- Test your contract with: npx hardhat console --network localhost"));
        console.log(chalk.gray("- Interact with your contract using the address above"));
      } else {
        console.log(chalk.gray("- Check deployment status on block explorers"));
        console.log(chalk.gray("- Update your frontend with new contract addresses"));
      }
      console.log(chalk.gray("- Run 'raze test' to verify functionality"));
      console.log(chalk.gray("- Run 'raze analyze <contract>' to verify security"));
    });
}
