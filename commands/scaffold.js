import chalk from "chalk";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import ora from "ora";

const execAsync = promisify(exec);

export default function registerScaffold(program) {
  program
    .command("scaffold")
    .description("Create a new Web3 project with smart contract templates")
    .argument("<project>", "Project name")
    .option(
      "--template <template>",
      "Template to use (hardhat, foundry, brownie)",
      "hardhat"
    )
    .option(
      "--contract <contract>",
      "Contract type (erc20, erc721, basic)",
      "basic"
    )
    .action(async (projectName, options) => {
      const { template, contract } = options;

      console.log(
        chalk.cyan(`🚀 Scaffolding ${template} project: ${projectName}`)
      );

      try {
        await scaffoldProject(projectName, template, contract);
        console.log(
          chalk.green(`✅ Project ${projectName} created successfully!`)
        );
        console.log(chalk.yellow(`📁 Navigate to: cd ${projectName}`));
        console.log(chalk.yellow(`🧪 Run tests: raze test`));
        console.log(chalk.yellow(`🚀 Deploy: raze deploy --network <network>`));
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to scaffold project: ${error.message}`)
        );
        process.exit(1);
      }
    });
}

async function scaffoldProject(projectName, template, contractType) {
  const projectPath = path.resolve(projectName);

  // Create project directory
  if (fs.existsSync(projectPath)) {
    throw new Error(`Directory ${projectName} already exists`);
  }

  fs.mkdirSync(projectPath, { recursive: true });

  switch (template) {
    case "hardhat":
      await scaffoldHardhatProject(projectPath, projectName, contractType);
      break;
    case "foundry":
      await scaffoldFoundryProject(projectPath, projectName, contractType);
      break;
    case "brownie":
      await scaffoldBrownieProject(projectPath, projectName, contractType);
      break;
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

async function scaffoldHardhatProject(projectPath, projectName, contractType) {
  const spinner = ora("Setting up Hardhat project...").start();

  try {
    // Create package.json
    const packageJson = {
      name: projectName,
      version: "1.0.0",
      description: "A Web3 project created with Raze CLI",
      scripts: {
        test: "npx hardhat test",
        compile: "npx hardhat compile",
        deploy: "npx hardhat run scripts/deploy.js",
      },
      devDependencies: {
        "@nomicfoundation/hardhat-toolbox": "^4.0.0",
        hardhat: "^2.19.0",
      },
      dependencies: {
        "@openzeppelin/contracts": "^5.0.0",
      },
    };

    fs.writeFileSync(
      path.join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    // Create hardhat.config.js
    const hardhatConfig = `require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      url: process.env.SEPOLIA_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    mainnet: {
      url: process.env.MAINNET_URL || "https://mainnet.infura.io/v3/YOUR_INFURA_KEY",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    polygon: {
      url: process.env.POLYGON_URL || "https://polygon-rpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    mumbai: {
      url: process.env.MUMBAI_URL || "https://rpc-mumbai.maticvigil.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
`;

    fs.writeFileSync(
      path.join(projectPath, "hardhat.config.js"),
      hardhatConfig
    );

    // Create contracts directory and contract
    const contractsDir = path.join(projectPath, "contracts");
    fs.mkdirSync(contractsDir);

    const contractContent = getContractTemplate(contractType, projectName);
    fs.writeFileSync(
      path.join(
        contractsDir,
        `${getContractName(contractType, projectName)}.sol`
      ),
      contractContent
    );

    // Create test directory and test file
    const testDir = path.join(projectPath, "test");
    fs.mkdirSync(testDir);

    const testContent = getTestTemplate(contractType, projectName);
    fs.writeFileSync(
      path.join(
        testDir,
        `${getContractName(contractType, projectName)}.test.js`
      ),
      testContent
    );

    // Create scripts directory and deploy script
    const scriptsDir = path.join(projectPath, "scripts");
    fs.mkdirSync(scriptsDir);

    const deployContent = getDeployTemplate(contractType, projectName);
    fs.writeFileSync(path.join(scriptsDir, "deploy.js"), deployContent);

    // Create .env.example
    const envExample = `# Private key for deployment (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# RPC URLs
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
POLYGON_URL=https://polygon-rpc.com

# API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key
`;

    fs.writeFileSync(path.join(projectPath, ".env.example"), envExample);

    // Create README
    const readme = `# ${projectName}

A Web3 project created with Raze CLI

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Copy environment file and configure:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your private key and RPC URLs
   \`\`\`

## Commands

- Compile contracts: \`npm run compile\`
- Run tests: \`npm run test\`
- Deploy to network: \`npm run deploy\`

## Raze CLI Commands

- Test: \`raze test\`
- Deploy: \`raze deploy --network sepolia\`
`;

    fs.writeFileSync(path.join(projectPath, "README.md"), readme);

    spinner.succeed("Hardhat project setup complete!");
  } catch (error) {
    spinner.fail("Failed to setup Hardhat project");
    throw error;
  }
}

async function scaffoldFoundryProject(projectPath, projectName, contractType) {
  const spinner = ora("Setting up Foundry project...").start();

  try {
    // Create foundry.toml
    const foundryConfig = `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.19"

[rpc_endpoints]
sepolia = "\${SEPOLIA_URL}"
polygon = "\${POLYGON_URL}"
`;

    fs.writeFileSync(path.join(projectPath, "foundry.toml"), foundryConfig);

    // Create src directory and contract
    const srcDir = path.join(projectPath, "src");
    fs.mkdirSync(srcDir);

    const contractContent = getContractTemplate(contractType, projectName);
    fs.writeFileSync(
      path.join(srcDir, `${getContractName(contractType, projectName)}.sol`),
      contractContent
    );

    // Create test directory and test file
    const testDir = path.join(projectPath, "test");
    fs.mkdirSync(testDir);

    const testContent = getFoundryTestTemplate(contractType, projectName);
    fs.writeFileSync(
      path.join(testDir, `${getContractName(contractType, projectName)}.t.sol`),
      testContent
    );

    // Create script directory and deploy script
    const scriptDir = path.join(projectPath, "script");
    fs.mkdirSync(scriptDir);

    const deployContent = getFoundryDeployTemplate(contractType, projectName);
    fs.writeFileSync(path.join(scriptDir, "Deploy.s.sol"), deployContent);

    // Create .env.example
    const envExample = `PRIVATE_KEY=your_private_key_here
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
POLYGON_URL=https://polygon-rpc.com
ETHERSCAN_API_KEY=your_etherscan_api_key
`;

    fs.writeFileSync(path.join(projectPath, ".env.example"), envExample);

    spinner.succeed("Foundry project setup complete!");
  } catch (error) {
    spinner.fail("Failed to setup Foundry project");
    throw error;
  }
}

async function scaffoldBrownieProject(projectPath, projectName, contractType) {
  const spinner = ora("Setting up Brownie project...").start();

  try {
    // Create brownie-config.yaml
    const brownieConfig = `dependencies:
  - OpenZeppelin/openzeppelin-contracts@4.9.0

compiler:
  solc:
    version: 0.8.19

networks:
  default: development
  sepolia:
    host: \${WEB3_INFURA_PROJECT_ID}
    required_confs: 1
  polygon-main:
    host: https://polygon-rpc.com
    required_confs: 1
`;

    fs.writeFileSync(
      path.join(projectPath, "brownie-config.yaml"),
      brownieConfig
    );

    // Create contracts directory and contract
    const contractsDir = path.join(projectPath, "contracts");
    fs.mkdirSync(contractsDir);

    const contractContent = getContractTemplate(contractType, projectName);
    fs.writeFileSync(
      path.join(
        contractsDir,
        `${getContractName(contractType, projectName)}.sol`
      ),
      contractContent
    );

    // Create tests directory and test file
    const testsDir = path.join(projectPath, "tests");
    fs.mkdirSync(testsDir);

    const testContent = getBrownieTestTemplate(contractType, projectName);
    fs.writeFileSync(
      path.join(testsDir, `test_${contractType}.py`),
      testContent
    );

    // Create scripts directory and deploy script
    const scriptsDir = path.join(projectPath, "scripts");
    fs.mkdirSync(scriptsDir);

    const deployContent = getBrownieDeployTemplate(contractType, projectName);
    fs.writeFileSync(path.join(scriptsDir, "deploy.py"), deployContent);

    spinner.succeed("Brownie project setup complete!");
  } catch (error) {
    spinner.fail("Failed to setup Brownie project");
    throw error;
  }
}

function getContractName(contractType, projectName) {
  // Convert project name to valid contract name (remove hyphens, underscores, make PascalCase)
  const cleanName = projectName
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");

  switch (contractType) {
    case "erc20":
      return `${cleanName}Token`;
    case "erc721":
      return `${cleanName}NFT`;
    default:
      return cleanName;
  }
}

function getContractTemplate(contractType, projectName) {
  const contractName = getContractName(contractType, projectName);

  switch (contractType) {
    case "erc20":
      return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ${contractName} is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("${projectName} Token", "${projectName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")}") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10**decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
`;
    case "erc721":
      return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ${contractName} is ERC721, Ownable {
    uint256 private _tokenId;

    constructor() ERC721("${projectName} NFT", "${projectName.toUpperCase()}") {}

    function mint(address to) public onlyOwner returns (uint256) {
        _tokenId++;
        _mint(to, _tokenId);
        return _tokenId;
    }
}
`;
    default:
      return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ${contractName} {
    string public name;
    address public owner;

    constructor(string memory _name) {
        name = _name;
        owner = msg.sender;
    }

    function setName(string memory _name) public {
        require(msg.sender == owner, "Only owner can set name");
        name = _name;
    }
}
`;
  }
}

function getTestTemplate(contractType, projectName) {
  const contractName = getContractName(contractType, projectName);

  switch (contractType) {
    case "erc20":
      return `const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("${contractName}", function () {
  let token;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("${contractName}");
    token = await Token.deploy(1000000); // 1M tokens
  });

  it("Should have correct name and symbol", async function () {
    expect(await token.name()).to.equal("${projectName} Token");
    expect(await token.symbol()).to.equal("${projectName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")}");
  });

  it("Should assign total supply to owner", async function () {
    const ownerBalance = await token.balanceOf(owner.address);
    expect(await token.totalSupply()).to.equal(ownerBalance);
  });

  it("Should allow minting by owner", async function () {
    await token.mint(addr1.address, 1000);
    expect(await token.balanceOf(addr1.address)).to.equal(1000);
  });
});
`;
    default:
      return `const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("${contractName}", function () {
  let contract;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory("${contractName}");
    contract = await Contract.deploy("${projectName}");
    await contract.deployed();
  });

  it("Should set the right owner", async function () {
    expect(await contract.owner()).to.equal(owner.address);
  });

  it("Should have correct initial name", async function () {
    expect(await contract.name()).to.equal("${projectName}");
  });

  it("Should allow owner to set name", async function () {
    await contract.setName("New Name");
    expect(await contract.name()).to.equal("New Name");
  });
});
`;
  }
}

function getDeployTemplate(contractType, projectName) {
  const contractName = getContractName(contractType, projectName);

  switch (contractType) {
    case "erc20":
      return `async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const Token = await ethers.getContractFactory("${contractName}");
  const token = await Token.deploy(1000000); // 1M tokens

  console.log("${contractName} deployed to:", await token.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
`;
    default:
      return `async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const Contract = await ethers.getContractFactory("${contractName}");
  const contract = await Contract.deploy("${projectName}");

  console.log("${contractName} deployed to:", await contract.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
`;
  }
}

function getFoundryTestTemplate(contractType, projectName) {
  const contractName = getContractName(contractType, projectName);

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/${contractName}.sol";

contract ${contractName}Test is Test {
    ${contractName} public contractInstance;

    function setUp() public {
        ${
          contractType === "erc20"
            ? `contractInstance = new ${contractName}(1000000);`
            : `contractInstance = new ${contractName}("${projectName}");`
        }
    }

    function testInitialSetup() public {
        ${
          contractType === "erc20"
            ? `assertEq(contractInstance.name(), "${projectName} Token");`
            : `assertEq(contractInstance.name(), "${projectName}");`
        }
    }
}
`;
}

function getFoundryDeployTemplate(contractType, projectName) {
  const contractName = getContractName(contractType, projectName);

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/${contractName}.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        
        ${
          contractType === "erc20"
            ? `${contractName} token = new ${contractName}(1000000);`
            : `${contractName} contract = new ${contractName}("${projectName}");`
        }
        
        vm.stopBroadcast();
    }
}
`;
}

function getBrownieTestTemplate(contractType, projectName) {
  const contractName = getContractName(contractType, projectName);

  return `import pytest
from brownie import ${contractName}, accounts

@pytest.fixture
def contract():
    ${
      contractType === "erc20"
        ? `return ${contractName}.deploy(1000000, {"from": accounts[0]})`
        : `return ${contractName}.deploy("${projectName}", {"from": accounts[0]})`
    }

def test_initial_setup(contract):
    ${
      contractType === "erc20"
        ? `assert contract.name() == "${projectName} Token"`
        : `assert contract.name() == "${projectName}"`
    }
    assert contract.owner() == accounts[0]
`;
}

function getBrownieDeployTemplate(contractType, projectName) {
  const contractName = getContractName(contractType, projectName);

  return `from brownie import ${contractName}, accounts

def main():
    account = accounts.load('deployment')  # or accounts[0] for development
    
    ${
      contractType === "erc20"
        ? `contract = ${contractName}.deploy(1000000, {"from": account})`
        : `contract = ${contractName}.deploy("${projectName}", {"from": account})`
    }
    
    print(f"${contractName} deployed at: {contract.address}")
    return contract
`;
}
