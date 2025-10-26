import chalk from "chalk";
import ora from "ora";
import fetch from 'node-fetch';
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getProvider, getWebSocketProvider, getStableRates, getAnalytics, identifyAddress, CELO_NETWORKS, getCIP8MetadataURL, fetchCIP8Metadata, loadLocalTokenList, scanTokenBalances, REGISTRY_ABI, DEFAULT_REGISTRY_ADDRESS } from "../utils/celo.js";
import { ethers } from "ethers";
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
            choices: ["scaffold", "analytics", "rates", "identity", "nlp", "login", "logs"],
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
        case "nlp":
          await handleNLP(opts);
          break;
        case "login":
          await handleLogin(opts);
          break;
        case "logs":
          await handleLogs(opts);
          break;
        case "verify":
          await handleVerify(opts);
          break;
        default:
          console.log(chalk.yellow("Unknown action. Use one of: scaffold, analytics, rates, identity"));
      }
    });
}

async function scaffoldCeloReactApp(projectPath, appName) {
  // Clone external template repo into projectPath
  const repo = "https://github.com/vinsmoke24033/celo-minidapp.git";
  // Ensure parent directory exists but avoid creating the target dir (git will create it)
  const parent = path.dirname(projectPath);
  fs.mkdirSync(parent, { recursive: true });
  try {
    // Clone shallow for speed
    await exec(`git clone --depth 1 ${repo} "${projectPath}"`);
  } catch (e) {
    throw new Error(`Failed to clone template repo. Ensure git is installed and network is available. ${e.message}`);
  }

  // Remove .git to detach from source repo
  try { fs.rmSync(path.join(projectPath, ".git"), { recursive: true, force: true }); } catch {}

  // Update package name
  try {
    const pkgPath = path.join(projectPath, "package.json");
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkgJson.name = appName;
    fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
  } catch {}
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
          { name: "Celo App (React mini dApp)", value: "celo-app" },
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

  const spinner = ora(ans.template === "celo-app" ? "Cloning Celo mini dApp template..." : "Creating Celo Hardhat project...").start();
  try {
    if (ans.template === "celo-app") {
      await scaffoldCeloReactApp(projectPath, ans.name);
    } else {
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
    }

    spinner.succeed("Celo project scaffolded!");
    console.log(chalk.yellow(`\nNext steps:`));
    console.log(`cd ${ans.name}`);
    if (ans.template === "celo-app") {
      console.log(`npm install`);
      console.log(`npm run dev`);
    } else {
      console.log(`npm install`);
      console.log(`cp .env.example .env && edit PRIVATE_KEY`);
      console.log(`npx hardhat run scripts/deploy.js --network ${ans.network === "mainnet" ? "celo" : "celo_sepolia"}`);
    }
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
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);

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
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);
  const F = await ethers.getContractFactory("Microfinance");
  const c = await F.deploy(CUSD);
  await c.waitForDeployment();
  console.log("Microfinance deployed:", await c.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
`;

// ----------------
// NLP helpers
// ----------------
async function handleNLP(opts) {
  const prompt = opts.prompt || (await inquirer.prompt([{ name: 'prompt', message: 'Describe the Celo action ' }])).prompt;
  if (!prompt) return console.log(chalk.yellow('No prompt provided'));
  const mcpUrl = opts.mcp || process.env.MCP_HTTP_URL || 'http://localhost:5005';

  console.log(chalk.cyan(`Celo NLP — "${prompt}" (MCP: ${mcpUrl})`));

  let parsed = null;

  // Check MCP health first; if unavailable we'll fallback to local provider for read-only ops
  let mcpAlive = false;
  try {
    const h = await fetch(`${mcpUrl}/health`, { method: 'GET', timeout: 3000 });
    if (h.ok) mcpAlive = true;
  } catch (e) {
    // not alive
  }

  if (mcpAlive) {
    try {
      const resp = await fetch(`${mcpUrl}/tools/parse-nlp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      if (resp.ok) parsed = await resp.json();
    } catch (e) {
      // parse endpoint failed; continue to fallback
    }
  } else {
    console.log(chalk.yellow(`MCP HTTP not reachable at ${mcpUrl} — falling back to local provider for read-only ops.`));
  }

  if (!parsed) parsed = nlpFallbackParse(prompt);

  console.log(chalk.gray('Parsed:'), parsed);

  if (!opts.yes && parsed.action && parsed.action !== 'balance') {
    const ok = await nlpConfirm(parsed);
    if (!ok) return console.log(chalk.yellow('Aborted'));
  }

  try {
    const action = (parsed.action || '').toLowerCase();
    if (!mcpAlive) {
      // Fallback behaviors when MCP unreachable
      if (action === 'balance') {
        // Use local provider to fetch balances
        const addr = parsed.address || (await inquirer.prompt([{ name: 'addr', message: 'Address to check balance:', type: 'input' }])).addr;
        const provider = getProvider(opts.network || 'mainnet');
        const info = await identifyAddress(addr, provider);
        console.log(chalk.green(JSON.stringify(info.balances, null, 2)));
        return;
      }

      if (action === 'send') {
        // Attempt to send using local PRIVATE_KEY if available
        if (!process.env.PRIVATE_KEY) {
          console.log(chalk.red('MCP not available and no PRIVATE_KEY in environment. Cannot send transaction.'));
          return;
        }
        const provider = getProvider(opts.network || 'mainnet');
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const to = parsed.to || (await inquirer.prompt([{ name: 'to', message: 'Recipient (0x...):' }])).to;
        const amount = parsed.amount || (await inquirer.prompt([{ name: 'amount', message: 'Amount to send:' }])).amount;
        const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(String(amount)) });
        console.log(chalk.green('Transaction sent. Hash:'), tx.hash);
        await tx.wait();
        console.log(chalk.green('Transaction confirmed'));
        return;
      }

      // For swap/estimate without MCP, inform user
      console.log(chalk.red('MCP not reachable — advanced operations (swap/estimate) require the MCP server or a configured wallet.'));
      return;
    }

    // MCP is alive — call MCP endpoints
    switch (action) {
      case 'balance':
        await nlpDoBalance(mcpUrl, parsed);
        break;
      case 'send':
        await nlpDoSend(mcpUrl, parsed);
        break;
      case 'swap':
        await nlpDoSwap(mcpUrl, parsed);
        break;
      case 'estimate':
        await nlpDoEstimate(mcpUrl, parsed);
        break;
      default:
        console.log(chalk.yellow('Could not map prompt to an action. Showing parsed output for debugging:'));
        console.log(parsed);
    }
  } catch (e) {
    console.error(chalk.red('Execution error:'), e.message || e);
  }
}

function nlpFallbackParse(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('balance')) {
    const m = text.match(/0x[a-fA-F0-9]{40}/);
    return { action: 'balance', address: m ? m[0] : null };
  }
  if (t.includes('swap') || t.includes('exchange')) {
    const amt = (text.match(/(\d+\.?\d*)/) || [null])[0];
    const toToken = /cusd|cUSD/i.test(text) ? 'cUSD' : 'CELO';
    return { action: 'swap', amount: amt || null, from: 'CELO', to: toToken, slippage: 1 };
  }
  if (t.includes('send') || t.includes('transfer')) {
    const mAmt = text.match(/(\d+\.?\d*)\s*(celo|cUSD|cusd)?/i);
    const mAddr = text.match(/0x[a-fA-F0-9]{40}/);
    return {
      action: 'send',
      amount: mAmt ? mAmt[1] : null,
      token: mAmt && mAmt[2] ? mAmt[2] : 'CELO',
      to: mAddr ? mAddr[0] : null,
    };
  }
  if (t.includes('estimate') || t.includes('gas')) {
    return { action: 'estimate', text };
  }
  return { action: null, text };
}

async function nlpConfirm(parsed) {
  const ans = await inquirer.prompt([{ type: 'confirm', name: 'ok', message: `Proceed with action?\n${JSON.stringify(parsed, null, 2)}` }]);
  return ans.ok;
}

async function nlpDoBalance(mcpUrl, parsed) {
  const addr = parsed.address || (await inquirer.prompt([{ name: 'addr', message: 'Address to check balance:', type: 'input' }])).addr;
  const spinner = ora('Checking balance...').start();
  try {
    const res = await fetch(`${mcpUrl}/chain/balance?address=${encodeURIComponent(addr)}`);
    const j = await res.json();
    spinner.succeed('Balance fetched');
    console.log(chalk.green(JSON.stringify(j, null, 2)));
  } catch (e) {
    spinner.fail('Failed to fetch balance');
    throw e;
  }
}

async function nlpDoSend(mcpUrl, parsed) {
  if (!parsed.to) {
    const ans = await inquirer.prompt([{ name: 'to', message: 'Recipient address (0x...):', type: 'input' }]);
    parsed.to = ans.to;
  }
  if (!parsed.amount) {
    const ans = await inquirer.prompt([{ name: 'amount', message: 'Amount to send:', type: 'input' }]);
    parsed.amount = ans.amount;
  }
  const spinner = ora('Submitting transaction via MCP...').start();
  try {
    const resp = await fetch(`${mcpUrl}/chain/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: parsed.to, amount: parsed.amount, token: parsed.token || 'CELO' }) });
    const j = await resp.json();
    spinner.succeed('Transaction submitted');
    console.log(chalk.green(JSON.stringify(j, null, 2)));
  } catch (e) {
    spinner.fail('Failed to submit transaction');
    throw e;
  }
}

async function nlpDoSwap(mcpUrl, parsed) {
  const spinner = ora('Preparing swap via MCP...').start();
  try {
    const body = { from: parsed.from || 'CELO', to: parsed.to || 'cUSD', amount: parsed.amount || '0', slippage: parsed.slippage || 1 };
    const resp = await fetch(`${mcpUrl}/chain/swap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await resp.json();
    spinner.succeed('Swap result');
    console.log(chalk.green(JSON.stringify(j, null, 2)));
  } catch (e) {
    spinner.fail('Swap failed');
    throw e;
  }
}

async function nlpDoEstimate(mcpUrl, parsed) {
  const spinner = ora('Estimating gas via MCP...').start();
  try {
    const resp = await fetch(`${mcpUrl}/chain/estimate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: parsed.text || parsed }) });
    const j = await resp.json();
    spinner.succeed('Estimate received');
    console.log(chalk.green(JSON.stringify(j, null, 2)));
  } catch (e) {
    spinner.fail('Estimate failed');
    throw e;
  }
}

// ----------------
// Login by phone number (CIP-8 style lookup)
// ----------------
async function handleLogin(opts) {
  const ans = await inquirer.prompt([
    { type: 'input', name: 'phone', message: 'Phone number (include country code, e.g. +1415555...):' },
    { type: 'list', name: 'network', message: 'Network', choices: ['mainnet', 'sepolia'], default: opts.network || 'mainnet' },
  ]);

  const phoneRaw = String(ans.phone || '').trim();
  if (!phoneRaw) return console.log(chalk.yellow('No phone number provided'));

  const provider = getProvider(ans.network);
  const spinner = ora('Looking up Accounts registry for phone identifier...').start();

  try {
    const registry = new (await import('ethers')).Contract(DEFAULT_REGISTRY_ADDRESS, REGISTRY_ABI, provider);

    // Build candidate identifiers (naive): exact, tel:+..., plain digits, phone:...
    const digits = phoneRaw.replace(/[^0-9+]/g, '');
    const normalized = digits.startsWith('+') ? digits : (digits ? `+${digits}` : phoneRaw);
    const candidates = [phoneRaw, normalized, `tel:${normalized}`, `phone:${normalized}`].filter(Boolean);

    let found = null;
    for (const id of candidates) {
      try {
        const addr = await registry.getAddressForString(id);
        if (addr && addr !== (await import('ethers')).ZeroAddress) {
          found = { identifier: id, address: addr };
          break;
        }
      } catch (e) {
        // ignore - try next candidate
      }
    }

    if (!found) {
      spinner.fail('No account mapped to that phone identifier in the registry');
      console.log(chalk.gray('Tried candidates:'), candidates);
      return;
    }

    spinner.succeed('Account resolved');
    console.log(chalk.green(`Resolved ${found.identifier} -> ${found.address}`));

    const infoSpinner = ora('Fetching identity & balances...').start();
    const info = await identifyAddress(found.address, provider);
    infoSpinner.succeed('Fetched identity');
    console.log(chalk.blue(`
Address: ${found.address}
Type: ${info.isContract ? 'Contract' : 'EOA'}`));
    console.log('Balances:');
    console.log(`• CELO: ${chalk.bold(info.balances.CELO)}`);
    if (info.balances.cUSD != null) console.log(`• cUSD: ${chalk.bold(info.balances.cUSD)}`);

    // Persist session locally
    try {
      const home = process.env.HOME || process.env.USERPROFILE || process.cwd();
      const dir = path.join(home, '.raze');
      fs.mkdirSync(dir, { recursive: true });
      const sess = { address: found.address, identifier: found.identifier, network: ans.network, timestamp: Date.now() };
      fs.writeFileSync(path.join(dir, 'celo-session.json'), JSON.stringify(sess, null, 2), 'utf8');
      console.log(chalk.green(`Saved session to ${path.join(dir, 'celo-session.json')}`));
    } catch (e) {
      console.log(chalk.yellow('Could not save session file:'), e.message);
    }
  } catch (e) {
    spinner.fail('Lookup failed');
    console.error(chalk.red(e.message || e));
  }
}

// ----------------
// View transaction logs / history for an address
// ----------------
async function handleLogs(opts) {
  const address = opts.address || (await inquirer.prompt([{ name: 'address', message: 'Address (0x...):', validate: (v) => (/^0x[a-fA-F0-9]{40}$/.test(v) ? true : 'Invalid address') }])).address;
  const limit = Number(opts.limit || 20);
  // Default to sepolia testnet unless explicitly overridden
  const network = opts.network || 'sepolia';
  const provider = getProvider(network);

  const spinner = ora('Fetching transaction history (trying explorer API first)...').start();

  // Try Blockscout / Explorer API first (Blockscout-compatible endpoints)
  try {
    // explorer.celo.org is Blockscout-based and supports the 'txlist' endpoint
    const explorerBase = process.env.CELO_EXPLORER_API || (network === 'sepolia' ? 'https://explorer.celo.org/sepolia' : 'https://explorer.celo.org/mainnet');
    const apiUrl = `${explorerBase}/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`;
    const resp = await fetch(apiUrl);
    if (resp.ok) {
      const j = await resp.json();
      if (j && Array.isArray(j.result) && j.result.length) {
        spinner.succeed(`Explorer API returned ${j.result.length} transactions`);
        const rows = j.result.slice(0, limit).map((t) => {
          return {
            hash: t.hash || t.transactionHash || t.txhash || t.txHash,
            block: t.blockNumber || t.block || null,
            from: t.from,
            to: t.to,
            value: t.value ? Number(t.value) / 1e18 : null,
            timestamp: t.timeStamp || t.timestamp || null,
          };
        });
        console.log(chalk.green(`Showing ${rows.length} recent transactions (explorer):`));
        rows.forEach((r) => console.log(`${r.hash}  block:${r.block}  ${r.from} -> ${r.to}  ${r.value ?? '?'} CELO`));
        return;
      }
    }
  } catch (e) {
    // ignore and fallback to on-chain scan
  }

  spinner.text = 'Explorer API unavailable or returned no results; scanning recent blocks (may be slow)...';
  try {
    const head = await provider.getBlockNumber();
    const depth = Number(opts.blocks || 5000);
    const start = Math.max(0, head - depth);
    const found = [];
  const rpcUrl = (CELO_NETWORKS[network] && CELO_NETWORKS[network].rpcUrl) || CELO_NETWORKS.sepolia.rpcUrl;
    const rpcCall = async (method, params) => {
      const body = { jsonrpc: '2.0', id: Date.now(), method, params };
      const res = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`RPC ${res.status} ${res.statusText}`);
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || 'RPC error');
      return j.result;
    };
    for (let bn = head; bn >= start; bn--) {
      // Fetch full block with transactions over JSON-RPC
      const hexBn = '0x' + bn.toString(16);
      const block = await rpcCall('eth_getBlockByNumber', [hexBn, true]);
      if (!block) continue;
      const tsHex = block.timestamp;
      const tsNum = typeof tsHex === 'string' && tsHex.startsWith('0x') ? parseInt(tsHex, 16) : Number(tsHex);
      const ts = tsNum ? new Date(tsNum * 1000).toISOString() : null;
      for (const tx of block.transactions || []) {
        if (!tx) continue;
        const from = (tx.from || '').toLowerCase();
        const to = (tx.to || '').toLowerCase();
        if (from === address.toLowerCase() || to === address.toLowerCase()) {
          const valHex = tx.value || '0x0';
          const val = typeof valHex === 'string' ? Number(ethers.formatEther(BigInt(valHex))) : Number(valHex);
          found.push({ hash: tx.hash, blockNumber: bn, from: tx.from, to: tx.to, value: val, timestamp: ts });
          if (found.length >= limit) break;
        }
      }
      if (found.length >= limit) break;
      // small progress update every 100 blocks
      if ((head - bn) % 100 === 0) spinner.text = `Scanning blocks ${bn}..${head} — found ${found.length}`;
      // be polite to the RPC endpoint
      if ((head - bn) % 50 === 0) await sleep(25);
    }

    if (found.length) {
      spinner.succeed(`Found ${found.length} transactions in recent ${depth} blocks`);
      found.forEach((f) => console.log(`${f.hash}  block:${f.blockNumber}  ${f.from} -> ${f.to}  ${f.value} CELO`));
    } else {
      spinner.fail('No transactions found in scanned range');
    }
  } catch (e) {
    spinner.fail('Failed to scan blocks');
    console.error(chalk.red(e.message || e));
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
