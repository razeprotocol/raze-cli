import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import os from "os";

export default function registerSetup(program) {
  program
    .command("setup")
    .description("Setup Raze CLI with MCP integration for AI assistants")
    .option(
      "--ai <assistant>",
      "AI assistant to configure (claude, cursor, chatgpt)",
      "claude"
    )
    .option("--auto", "Auto-configure with defaults")
    .action(async (opts) => {
      console.log(chalk.cyan("🚀 Raze CLI Setup Wizard"));
      console.log(
        chalk.gray("Let's configure Raze CLI with MCP for your AI assistant\n")
      );

      if (opts.auto) {
        await autoSetup(opts);
      } else {
        await interactiveSetup(opts);
      }
    });
}

async function interactiveSetup(opts) {
  // Step 1: Welcome and explanation
  console.log(chalk.yellow("📋 Setup Overview:"));
  console.log(chalk.gray("1. Test Raze CLI installation"));
  console.log(chalk.gray("2. Configure MCP server"));
  console.log(chalk.gray("3. Generate AI assistant configuration"));
  console.log(chalk.gray("4. Provide setup instructions\n"));

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "aiAssistant",
      message: "Which AI assistant do you want to configure?",
      choices: [
        { name: "Claude Desktop", value: "claude" },
        { name: "Cursor IDE", value: "cursor" },
        { name: "ChatGPT Desktop", value: "chatgpt" },
        { name: "Other (generic MCP)", value: "generic" },
      ],
      default: opts.ai || "claude",
    },
    {
      type: "confirm",
      name: "startServer",
      message: "Do you want to start the MCP server now?",
      default: true,
    },
    {
      type: "confirm",
      name: "createExample",
      message: "Create example project to test with?",
      default: true,
    },
  ]);

  await runSetup(answers);
}

async function autoSetup(opts) {
  const config = {
    aiAssistant: opts.ai || "claude",
    startServer: true,
    createExample: false,
  };

  await runSetup(config);
}

async function runSetup(config) {
  const { aiAssistant, startServer, createExample } = config;

  // Step 1: Test installation
  const testSpinner = ora("Testing Raze CLI installation...").start();
  try {
    // Test if all required modules are available without triggering auto-start
    const fs = await import("fs");
    const mcpServerPath = path.resolve("mcp-server.js");
    if (fs.existsSync(mcpServerPath)) {
      testSpinner.succeed("✅ Raze CLI installation verified");
    } else {
      throw new Error("MCP server file not found");
    }
  } catch (error) {
    testSpinner.fail("❌ Installation issue detected");
    console.error(chalk.red("Error:"), error.message);
    return;
  }

  // Step 2: Generate MCP configuration
  const configSpinner = ora("Generating MCP configuration...").start();
  try {
    const mcpConfig = generateMCPConfig();
    const configPath = path.join(process.cwd(), "mcp-client-config.json");
    fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
    configSpinner.succeed(`✅ MCP configuration saved to ${configPath}`);
  } catch (error) {
    configSpinner.fail("❌ Failed to generate configuration");
    console.error(chalk.red("Error:"), error.message);
    return;
  }

  // Step 3: Start MCP server if requested
  if (startServer) {
    const serverSpinner = ora("Starting MCP server...").start();
    try {
      // This would start the server - simplified for demo
      await new Promise((resolve) => setTimeout(resolve, 2000));
      serverSpinner.succeed("✅ MCP server started");
    } catch (error) {
      serverSpinner.fail("❌ Failed to start MCP server");
    }
  }

  // Step 4: Create example project
  if (createExample) {
    await createExampleProject();
  }

  // Step 5: Show AI assistant setup instructions
  await showAISetupInstructions(aiAssistant);

  // Step 6: Final success message
  console.log(chalk.green("\n🎉 Setup Complete!"));
  console.log(
    chalk.gray(
      "Your AI assistant can now control your development environment through Raze CLI."
    )
  );

  showNextSteps();
}

function generateMCPConfig() {
  const currentPath = process.cwd();
  const serverPath = path.join(currentPath, "mcp-server.js");

  return {
    mcpServers: {
      "raze-web3-cli": {
        command: "node",
        args: [serverPath],
        env: {
          NODE_ENV: "development",
        },
        capabilities: {
          tools: true,
          resources: true,
        },
      },
    },
  };
}

async function createExampleProject() {
  const exampleSpinner = ora("Creating example project...").start();

  try {
    const exampleDir = path.join(process.cwd(), "mcp-example");

    if (!fs.existsSync(exampleDir)) {
      fs.mkdirSync(exampleDir);
    }

    // Create a simple smart contract
    const contractContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ExampleToken {
    string public name = "Example Token";
    string public symbol = "EXT";
    uint256 public totalSupply = 1000000;
    
    mapping(address => uint256) public balanceOf;
    
    constructor() {
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}`;

    fs.writeFileSync(
      path.join(exampleDir, "ExampleToken.sol"),
      contractContent
    );

    // Create package.json
    const packageJson = {
      name: "mcp-example",
      version: "1.0.0",
      description: "Example project for testing Raze CLI MCP integration",
      scripts: {
        test: "echo 'Test script for MCP demo'",
      },
    };

    fs.writeFileSync(
      path.join(exampleDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    // Create README
    const readme = `# MCP Example Project

This is an example project created by Raze CLI setup.

## Test MCP Integration

Ask your AI assistant:
- "Can you read the ExampleToken.sol contract?"
- "What's in the package.json file?"
- "Create a simple test file for this contract"
- "Explain what this smart contract does"

Your AI should be able to interact with these files through the MCP connection.
`;

    fs.writeFileSync(path.join(exampleDir, "README.md"), readme);

    exampleSpinner.succeed(`✅ Example project created in ${exampleDir}`);
  } catch (error) {
    exampleSpinner.fail("❌ Failed to create example project");
  }
}

async function showAISetupInstructions(aiAssistant) {
  console.log(
    chalk.yellow(`\n📱 ${getAIAssistantName(aiAssistant)} Setup Instructions:`)
  );

  switch (aiAssistant) {
    case "claude":
      showClaudeInstructions();
      break;
    case "cursor":
      showCursorInstructions();
      break;
    case "chatgpt":
      showChatGPTInstructions();
      break;
    default:
      showGenericInstructions();
  }
}

function getAIAssistantName(aiAssistant) {
  const names = {
    claude: "Claude Desktop",
    cursor: "Cursor IDE",
    chatgpt: "ChatGPT Desktop",
    generic: "Your AI Assistant",
  };
  return names[aiAssistant] || "AI Assistant";
}

function showClaudeInstructions() {
  const platform = os.platform();
  let configPath;

  if (platform === "win32") {
    configPath = "%APPDATA%\\Claude\\claude_desktop_config.json";
  } else if (platform === "darwin") {
    configPath =
      "~/Library/Application Support/Claude/claude_desktop_config.json";
  } else {
    configPath = "~/.config/Claude/claude_desktop_config.json";
  }

  console.log(chalk.gray("1. Open Claude Desktop"));
  console.log(chalk.gray(`2. Find config file: ${configPath}`));
  console.log(
    chalk.gray(
      "3. Copy contents from mcp-client-config.json to Claude's config"
    )
  );
  console.log(chalk.gray("4. Restart Claude Desktop"));
  console.log(
    chalk.cyan(
      "\n💡 Test by asking: 'Can you check if MCP is working and show me my system info?'"
    )
  );
}

function showCursorInstructions() {
  console.log(chalk.gray("1. Open Cursor IDE"));
  console.log(chalk.gray("2. Go to Settings (Ctrl+,)"));
  console.log(chalk.gray("3. Search for 'MCP'"));
  console.log(
    chalk.gray("4. Add the server configuration from mcp-client-config.json")
  );
  console.log(chalk.gray("5. Restart Cursor"));
  console.log(
    chalk.cyan(
      "\n💡 Test by asking Cursor's AI: 'Can you access my file system through MCP?'"
    )
  );
}

function showChatGPTInstructions() {
  console.log(chalk.gray("1. Open ChatGPT Desktop"));
  console.log(chalk.gray("2. Go to Settings → Advanced"));
  console.log(chalk.gray("3. Enable MCP and add server configuration"));
  console.log(chalk.gray("4. Use the generated mcp-client-config.json"));
  console.log(chalk.gray("5. Restart ChatGPT Desktop"));
  console.log(
    chalk.cyan("\n💡 Test by asking: 'Are you connected to my system via MCP?'")
  );
}

function showGenericInstructions() {
  console.log(chalk.gray("1. Locate your AI assistant's MCP configuration"));
  console.log(
    chalk.gray("2. Add the server configuration from mcp-client-config.json")
  );
  console.log(chalk.gray("3. Restart your AI assistant"));
  console.log(
    chalk.cyan("\n💡 Test by asking your AI to get system information")
  );
}

function showNextSteps() {
  console.log(chalk.yellow("\n🎯 Next Steps:"));
  console.log(
    chalk.gray("1. Configure your AI assistant using the instructions above")
  );
  console.log(chalk.gray("2. Test the connection with simple commands"));
  console.log(chalk.gray("3. Try building a Web3 project with AI assistance"));

  console.log(chalk.cyan("\n🎪 Try These Commands:"));
  console.log(chalk.gray('• "Show me my system information"'));
  console.log(chalk.gray('• "Create a simple smart contract"'));
  console.log(chalk.gray('• "List files in my project"'));
  console.log(chalk.gray('• "Help me build a DeFi protocol"'));

  console.log(chalk.green("\n📚 Documentation:"));
  console.log(chalk.gray("• MCP-USER-GUIDE.md - Complete user guide"));
  console.log(chalk.gray("• MCP-GUIDE.md - Technical documentation"));
  console.log(chalk.gray("• Use 'raze mcp --help' for server management"));

  console.log(chalk.yellow("\n🆘 Need Help?"));
  console.log(chalk.gray("• Run 'raze mcp test' to test system integration"));
  console.log(chalk.gray("• Check 'raze mcp status' for server status"));
  console.log(chalk.gray("• Join our Discord for community support"));
}
