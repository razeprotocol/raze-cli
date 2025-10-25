import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getProvider, getWebSocketProvider, getStableRates, getAnalytics, identifyAddress, CELO_NETWORKS, getCIP8MetadataURL, fetchCIP8Metadata, loadLocalTokenList, scanTokenBalances } from "../utils/celo.js";
import { exec as _exec } from "child_process";
import { promisify } from "util";
const exec = promisify(_exec);

export default function registerCelo(program) {
  program
    .command("celo")
    .description("Celo tools: scaffold dApps, analytics, rates, identity")
  .argument("[action]", "Action: scaffold | analytics | rates | identity | verify")
  .option("--network <network>", "celo network (mainnet|sepolia)", "mainnet")
  .option("--json", "Output JSON for machine consumption")
  .option("--address <address>", "Address for identity lookup (0x...)")
  .option("--name <name>", "Project name for scaffold")
  .option("--template <template>", "Template for scaffold (nft-drop|microfinance)")
  .option("--watch", "Watch mode for analytics (websocket)")
  .option("--metadata", "Fetch CIP-8 metadata during identity lookup")
  .option("--extended", "Scan extended token balances during identity lookup")
    .action(async (action, opts, cmd) => {
      if (!action) {
        const ans = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: "Select a Celo feature:",
            choices: ["scaffold", "analytics", "rates", "identity"],
          },
        ]);
        action = ans.action;
      }

      switch (action) {
        case "scaffold":
          await handleScaffold(program, opts); // pass program for help if needed
          break;
        case "analytics":
          await handleAnalytics(opts);
          break;
        case "rates":
          await handleRates(opts);
          break;
        case "identity":
          await handleIdentity(opts);
          break;
        case "verify":
          await handleVerify(opts);
          break;
        default:
          console.log(chalk.yellow("Unknown action. Use one of: scaffold, analytics, rates, identity"));
      }
    });
}

async function handleAnalytics(opts) {
  const spinner = ora("Fetching Celo analytics...").start();
  try {
    const provider = getProvider(opts.network);
    const data = await getAnalytics(provider);
    spinner.succeed("Analytics retrieved");
    if (opts.json) {
      console.log(JSON.stringify({ network: opts.network, ...data }, null, 2));
    } else {
      console.log(chalk.cyan(`\nCelo ${opts.network} analytics:`));
      console.log(`• Block: ${chalk.bold(data.blockNumber)} at ${data.timestamp}`);
      if (data.gasPrice) console.log(`• Gas price: ${chalk.bold(data.gasPrice)} wei`);
      if (data.baseFeePerGas) console.log(`• Base fee: ${chalk.bold(data.baseFeePerGas)} wei`);
      if (data.avgBlockTime) console.log(`• Avg block time: ${chalk.bold(data.avgBlockTime.toFixed(2))}s`);
    }

    if (opts.watch) {
      await watchAnalytics(opts);
    }
  } catch (e) {
    spinner.fail(`Failed: ${e.message}`);
  }
}

async function watchAnalytics(opts) {
  const wss = getWebSocketProvider(opts.network);
  if (!wss) {
    console.log(chalk.yellow("WebSocket provider not available. Falling back to polling every 5s..."));
    const provider = getProvider(opts.network);
    let last = 0;
    setInterval(async () => {
      try {
        const d = await getAnalytics(provider);
        if (d.blockNumber !== last) {
          last = d.blockNumber;
          printLiveLine(d);
        }
      } catch {}
    }, 5000);
    return new Promise(() => {});
  }

  console.log(chalk.gray("Watching new blocks (auto-reconnect enabled)..."));
  let closing = false;
  const onBlock = async (bn) => {
    try {
      const data = await getAnalytics(wss);
      printLiveLine(data);
    } catch {}
  };
  wss.on("block", onBlock);
  process.on("SIGINT", () => {
    closing = true;
    try { wss.destroy(); } catch {}
    process.exit(0);
  });
  return new Promise(() => {});
}

function printLiveLine(d) {
  const ts = d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : "";
  console.log(`${chalk.gray(ts)} block ${chalk.bold(d.blockNumber)} | gas ${d.gasPrice || "?"} | base ${d.baseFeePerGas || "?"}`);
}

async function handleRates(opts) {
  const spinner = ora("Fetching cStable rates...").start();
  try {
    const rates = await getStableRates("usd");
    spinner.succeed("Rates retrieved");
    if (opts.json) {
      console.log(JSON.stringify(rates, null, 2));
    } else {
      console.log(chalk.green("\nCelo stablecoin rates (vs USD):"));
      const fmt = (v) => (v == null ? "n/a" : `$${Number(v).toFixed(4)}`);
      console.log(`• cUSD: ${chalk.bold(fmt(rates.cUSD))}`);
      console.log(`• cEUR: ${chalk.bold(fmt(rates.cEUR))}`);
      console.log(`• cREAL: ${chalk.bold(fmt(rates.cREAL))}`);
      console.log(chalk.gray(`source: ${rates.source}`));
    }
  } catch (e) {
    spinner.fail(`Failed: ${e.message}`);
  }
}

async function handleIdentity(opts) {
  let address = opts.address;
  if (!address) {
    const ans = await inquirer.prompt([
      {
        type: "input",
        name: "address",
        message: "Enter address (0x...):",
        validate: (v) => (/^0x[a-fA-F0-9]{40}$/.test(v) ? true : "Invalid address"),
      },
    ]);
    address = ans.address;
  }

  const spinner = ora("Looking up identity...").start();
  try {
    const provider = getProvider(opts.network);
    const info = await identifyAddress(address, provider);

    let metadata = null;
    if (opts.metadata) {
      const url = await getCIP8MetadataURL(address, provider);
      metadata = await fetchCIP8Metadata(url);
    }

    let extended = null;
    if (opts.extended) {
      const extra = loadLocalTokenList();
      extended = await scanTokenBalances(address, provider, { threshold: 0, extraTokens: extra });
    }
    spinner.succeed("Identity resolved");

    if (opts.json) {
      console.log(JSON.stringify({ network: opts.network, address, ...info, metadata, tokens: extended }, null, 2));
      return;
    }

    console.log(chalk.blue(`\nAddress: ${address}`));
    console.log(`Type: ${info.isContract ? chalk.yellow("Contract") : chalk.green("EOA")}`);
    if (info.contractInfo?.name || info.contractInfo?.symbol) {
      const { name, symbol, standard } = info.contractInfo;
      console.log(`Contract: ${name ?? "?"} (${symbol ?? "?"}) ${standard ? `[${standard}]` : ""}`);
    }
    console.log("Balances:");
    console.log(`• CELO: ${chalk.bold(info.balances.CELO)}`);
    if (info.balances.cUSD != null) console.log(`• cUSD: ${chalk.bold(info.balances.cUSD)}`);
    if (info.balances.cEUR != null) console.log(`• cEUR: ${chalk.bold(info.balances.cEUR)}`);

    if (metadata) {
      console.log(chalk.magenta("\nCIP-8 Metadata:"));
      const fields = ["name", "twitter", "website", "telegram", "avatar"];
      fields.forEach((f) => {
        if (metadata[f]) console.log(`• ${f}: ${metadata[f]}`);
      });
      if (!fields.some((f) => metadata[f])) {
        console.log(chalk.gray("(no common fields found)"));
      }
    }

    if (extended && extended.length) {
      console.log(chalk.green("\nToken balances:"));
      extended.forEach((t) => {
        console.log(`• ${t.symbol || "TOKEN"} (${t.address.slice(0, 6)}…${t.address.slice(-4)}): ${t.balance}`);
      });
    }
  } catch (e) {
    spinner.fail(`Failed: ${e.message}`);
  }
}

async function handleScaffold(program, opts) {
  const ans = { name: opts.name, template: opts.template, network: opts.network };
  if (!ans.name || !ans.template) {
    const resp = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Project name:",
        validate: (v) => (v ? true : "Project name required"),
        when: !ans.name,
      },
      {
        type: "list",
        name: "template",
        message: "Choose a template:",
        choices: [
          { name: "NFT Drop (ERC721 + cUSD payments)", value: "nft-drop" },
          { name: "Microfinance (cUSD lending)", value: "microfinance" },
        ],
        when: !ans.template,
      },
      {
        type: "list",
        name: "network",
        message: "Default deploy network:",
        choices: [
          { name: "Celo mainnet", value: "mainnet" },
          { name: "Celo sepolia (testnet)", value: "sepolia" },
        ],
        default: ans.network || "sepolia",
      },
    ]);
    Object.assign(ans, resp);
  }

  const projectPath = path.resolve(ans.name);
  if (fs.existsSync(projectPath)) {
    console.log(chalk.red(`Directory ${ans.name} already exists`));
    return;
  }

  const spinner = ora("Creating Celo Hardhat project...").start();
  try {
    fs.mkdirSync(projectPath, { recursive: true });

    // package.json
    const pkg = {
      name: ans.name,
      version: "1.0.0",
      private: true,
      scripts: {
        compile: "npx hardhat compile",
        test: "npx hardhat test",
        deploy: "npx hardhat run scripts/deploy.js --network celo",
      },
      devDependencies: {
        hardhat: "^2.19.0",
        "@nomicfoundation/hardhat-toolbox": "^4.0.0",
      },
      dependencies: {
        "@openzeppelin/contracts": "^5.0.0",
        ethers: "^6.8.0",
      },
    };
    fs.writeFileSync(path.join(projectPath, "package.json"), JSON.stringify(pkg, null, 2));

    // hardhat.config.js
    const hardhatConfig = `require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    celo: {
      url: process.env.CELO_RPC_URL || "${CELO_NETWORKS.mainnet.rpcUrl}",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    celo_sepolia: {
      url: process.env.CELO_SEPOLIA_RPC_URL || "${CELO_NETWORKS.sepolia.rpcUrl}",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      celo: process.env.CELO_EXPLORER_API_KEY || "",
      celo_sepolia: process.env.CELO_SEPOLIA_EXPLORER_API_KEY || "",
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: process.env.CELO_EXPLORER_API_URL || "https://explorer.celo.org/mainnet/api",
          browserURL: process.env.CELO_BROWSER_URL || "https://explorer.celo.org/mainnet",
        },
      },
      {
        network: "celo_sepolia",
        chainId: 44787,
        urls: {
          apiURL: process.env.CELO_SEPOLIA_EXPLORER_API_URL || "https://explorer.celo.org/sepolia/api",
          browserURL: process.env.CELO_SEPOLIA_BROWSER_URL || "https://explorer.celo.org/sepolia",
        },
      },
    ],
  }
};
`;
    fs.writeFileSync(path.join(projectPath, "hardhat.config.js"), hardhatConfig);

    // contracts
    const contractsDir = path.join(projectPath, "contracts");
    fs.mkdirSync(contractsDir);

    if (ans.template === "nft-drop") {
      fs.writeFileSync(path.join(contractsDir, "CeloNFTDrop.sol"), NFT_DROP_CONTRACT);
    } else {
      fs.writeFileSync(path.join(contractsDir, "Microfinance.sol"), MICROFINANCE_CONTRACT);
    }

    // scripts
    const scriptsDir = path.join(projectPath, "scripts");
    fs.mkdirSync(scriptsDir);
    const deployScript = ans.template === "nft-drop" ? DEPLOY_NFT_DROP : DEPLOY_MICROFINANCE;
    fs.writeFileSync(path.join(scriptsDir, "deploy.js"), deployScript);

    // README
    fs.writeFileSync(
      path.join(projectPath, "README.md"),
      getReadme(ans.name, ans.template)
    );

    // .env.example
    const env = `# Private key without 0x
PRIVATE_KEY=your_private_key_here
CELO_RPC_URL=${CELO_NETWORKS.mainnet.rpcUrl}
CELO_SEPOLIA_RPC_URL=${CELO_NETWORKS.sepolia.rpcUrl}
`;
    fs.writeFileSync(path.join(projectPath, ".env.example"), env);

    spinner.succeed("Celo project scaffolded!");
    console.log(chalk.yellow(`\nNext steps:`));
    console.log(`cd ${ans.name}`);
    console.log(`npm install`);
    console.log(`cp .env.example .env && edit PRIVATE_KEY`);
    console.log(`npx hardhat run scripts/deploy.js --network ${ans.network === "mainnet" ? "celo" : "celo_sepolia"}`);
  } catch (e) {
    spinner.fail(`Failed: ${e.message}`);
  }
}

function getReadme(name, template) {
  return `# ${name}

Scaffolded via Raze CLI (Celo).

## Setup

- npm install
- cp .env.example .env
- Edit PRIVATE_KEY

## Deploy

- npx hardhat run scripts/deploy.js --network celo_sepolia

## Template

${template === "nft-drop" ? "NFT drop (ERC721, cUSD payments)" : "Microfinance (cUSD lending)"}
`;
}

// Templates
const NFT_DROP_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CeloNFTDrop is ERC721URIStorage, Ownable {
    IERC20 public immutable paymentToken; // e.g., cUSD
    uint256 public price; // price in paymentToken units (18 decimals cUSD)
    uint256 public nextId = 1;
    string public baseTokenURI;

    event Minted(address indexed to, uint256 indexed tokenId, uint256 price);

    constructor(address _paymentToken, uint256 _price, string memory _baseURI)
        ERC721("Celo NFT Drop", "cDROP")
        Ownable(msg.sender)
    {
        paymentToken = IERC20(_paymentToken);
        price = _price;
        baseTokenURI = _baseURI;
    }

    function setPrice(uint256 _price) external onlyOwner { price = _price; }
    function setBaseURI(string calldata _uri) external onlyOwner { baseTokenURI = _uri; }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function mint() external {
        // Pull payment in cUSD from minter
        require(paymentToken.transferFrom(msg.sender, owner(), price), "PAYMENT_FAIL");
        uint256 tokenId = nextId++;
        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, price);
    }
}
`;

const MICROFINANCE_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Microfinance is Ownable {
    IERC20 public immutable stable; // cUSD

    struct Loan {
        address borrower;
        uint256 principal;
        uint256 repaid;
        uint256 dueDate;
        bool disbursed;
    }

    mapping(uint256 => Loan) public loans;
    uint256 public nextId = 1;

    event LoanRequested(uint256 indexed id, address indexed borrower, uint256 principal, uint256 dueDate);
    event LoanDisbursed(uint256 indexed id);
    event LoanRepaid(uint256 indexed id, uint256 amount);

    constructor(address _stable) Ownable(msg.sender) { stable = IERC20(_stable); }

    function requestLoan(uint256 principal, uint256 durationDays) external returns (uint256 id) {
        id = nextId++;
        loans[id] = Loan({
            borrower: msg.sender,
            principal: principal,
            repaid: 0,
            dueDate: block.timestamp + durationDays * 1 days,
            disbursed: false
        });
        emit LoanRequested(id, msg.sender, principal, block.timestamp + durationDays * 1 days);
    }

    function disburse(uint256 id) external onlyOwner {
        Loan storage L = loans[id];
        require(!L.disbursed, "ALREADY");
        L.disbursed = true;
        require(stable.transfer(L.borrower, L.principal), "TRANSFER_FAIL");
        emit LoanDisbursed(id);
    }

    function repay(uint256 id, uint256 amount) external {
        Loan storage L = loans[id];
        require(msg.sender == L.borrower, "NOT_BORROWER");
        require(L.disbursed, "NOT_DISBURSED");
        require(stable.transferFrom(msg.sender, address(this), amount), "TRANSFER_FAIL");
        L.repaid += amount;
        emit LoanRepaid(id, amount);
    }
}
`;

const DEPLOY_NFT_DROP = `const { ethers } = require("hardhat");

// cUSD mainnet: 0x765DE816845861e75A25fCA122bb6898B8B1282a
// cUSD sepolia may differ; pass via env or replace below for testnet
const CUSD = process.env.CUSD_ADDRESS || "0x765DE816845861e75A25fCA122bb6898B8B1282a";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const price = ethers.parseUnits("5", 18); // 5 cUSD
  const baseURI = "https://your.cdn/metadata/";

  const F = await ethers.getContractFactory("CeloNFTDrop");
  const c = await F.deploy(CUSD, price, baseURI);
  await c.waitForDeployment();
  console.log("CeloNFTDrop deployed:", await c.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
`;

const DEPLOY_MICROFINANCE = `const { ethers } = require("hardhat");

const CUSD = process.env.CUSD_ADDRESS || "0x765DE816845861e75A25fCA122bb6898B8B1282a";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const F = await ethers.getContractFactory("Microfinance");
  const c = await F.deploy(CUSD);
  await c.waitForDeployment();
  console.log("Microfinance deployed:", await c.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
`;

async function handleVerify(opts) {
  // Simple wrapper to call Hardhat verify in the current project
  const answers = await inquirer.prompt([
    { type: "input", name: "address", message: "Contract address:", when: () => !opts.address, validate: (v) => (/^0x[a-fA-F0-9]{40}$/.test(v) ? true : "Invalid address") },
    { type: "input", name: "network", message: "Network (celo|celo_sepolia):", when: () => !opts.network, default: "celo_sepolia" },
    { type: "input", name: "args", message: "Constructor args (space-separated, optional):", default: "" },
  ]);

  const address = opts.address || answers.address;
  const network = (opts.network || answers.network || "celo_sepolia").trim();
  const args = (answers.args || "").trim();

  const spinner = ora(`Verifying ${address} on ${network}...`).start();
  try {
    const cmd = `npx hardhat verify --network ${network} ${address} ${args}`.trim();
    const { stdout, stderr } = await exec(cmd, { env: { ...process.env, FORCE_COLOR: "1" } });
    spinner.succeed("Verification command completed");
    if (stdout) console.log(chalk.gray(stdout));
    if (stderr) console.error(chalk.gray(stderr));
  } catch (e) {
    spinner.fail(`Verify failed: ${e.message}`);
  }
}
