# 🚀 How to Use Raze CLI's MCP Features - User Guide

## 📖 Overview

Raze CLI includes **MCP (Model Context Protocol)** integration that allows AI assistants like **Claude Desktop**, **ChatGPT Desktop**, or **Cursor** to directly interact with your computer through the CLI. This means AI can:

- Execute commands on your system
- Read and write files in your projects
- Launch applications like VS Code
- Manage development processes
- Deploy smart contracts and build dApps

## 🎯 Step-by-Step Setup Guide

### Step 1: Install Raze CLI

```bash
# Clone the repository
git clone https://github.com/razeprotocol/raze-cli.git
cd raze-cli/cli/my-web3-cli

# Install dependencies
npm install

# Make it globally available (optional)
npm link
```

### Step 2: Test Basic Functionality

```bash
# Test if Raze CLI works
raze --help

# Test MCP command
raze mcp --help
```

### Step 3: Start the MCP Server

```bash
# Option 1: Interactive menu (recommended for beginners)
raze mcp

# Option 2: Direct command
raze mcp start
```

You should see:

```
🚀 Raze MCP Server started successfully!
📡 Server PID: 12345
🔧 Available tools: System commands, file operations, application control
```

### Step 4: Generate AI Assistant Configuration

```bash
# Generate the configuration file for your AI assistant
raze mcp config
```

This creates a `mcp-client-config.json` file that looks like:

```json
{
  "mcpServers": {
    "raze-system": {
      "command": "node",
      "args": ["C:/path/to/raze-cli/mcp-server.js"],
      "env": {},
      "capabilities": {
        "tools": true,
        "resources": true
      }
    }
  }
}
```

## 🤖 Connecting AI Assistants

### For Claude Desktop

1. **Find Claude's config file:**

   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Add Raze MCP configuration:**

   ```json
   {
     "mcpServers": {
       "raze-web3-cli": {
         "command": "node",
         "args": [
           "C:/Users/YourUsername/path/to/raze-cli/cli/my-web3-cli/mcp-server.js"
         ],
         "env": {}
       }
     }
   }
   ```

3. **Restart Claude Desktop**

### For Cursor IDE

1. **Open Cursor Settings** (`Ctrl+,`)
2. **Search for "MCP"**
3. **Add server configuration:**
   ```json
   {
     "raze-cli": {
       "command": "node",
       "args": ["path/to/mcp-server.js"]
     }
   }
   ```

### For Other AI Assistants

Any AI assistant that supports MCP can connect using the generated configuration.

## ✅ Testing the Connection

### Method 1: Ask AI to Test

Once connected, ask your AI assistant:

> "Can you check if the MCP connection is working? Try to get system information."

The AI should be able to:

- Get your system info (OS, CPU, memory)
- List files in your current directory
- Execute simple commands

### Method 2: Use Built-in Test

```bash
# Run the integration test
raze mcp test
```

## 🎪 Real-World Usage Examples

### Example 1: Create a Web3 Project

**Ask your AI assistant:**

> "Create a complete DeFi yield farming project with smart contracts and a React frontend. Deploy it to Polygon testnet."

**The AI will:**

1. Create project directories
2. Write Solidity smart contracts
3. Set up Hardhat configuration
4. Install dependencies
5. Compile contracts
6. Deploy to testnet
7. Create React frontend
8. Open VS Code

### Example 2: Debug a Failed Deployment

**Ask your AI assistant:**

> "My smart contract deployment failed. Can you help me debug it?"

**The AI will:**

1. Read deployment logs
2. Check Hardhat configuration
3. Verify network settings
4. Run tests to identify issues
5. Suggest fixes
6. Implement corrections

### Example 3: Set up Development Environment

**Ask your AI assistant:**

> "Set up a complete Web3 development environment with all the tools I need."

**The AI will:**

1. Check installed software
2. Install missing dependencies
3. Configure development tools
4. Set up project structure
5. Install Web3 libraries
6. Configure wallet connections

## 🛠️ Available Commands Through AI

When your AI assistant is connected to Raze MCP, it can:

### File Operations

```
"Create a new smart contract file called MyToken.sol"
"Read the package.json file"
"Update the hardhat config with new network settings"
"List all files in the contracts directory"
```

### Command Execution

```
"Run npm install to install dependencies"
"Compile the smart contracts using Hardhat"
"Deploy the contracts to Polygon testnet"
"Start the React development server"
"Run the test suite"
```

### Application Control

```
"Open VS Code in the current project"
"Launch the browser and open localhost:3000"
"Start the Hardhat node for local development"
```

### System Management

```
"Check if port 3000 is available"
"Show me the current system resources"
"Kill any processes using port 8545"
"Find installed Node.js versions"
```

## 🔧 Troubleshooting

### Common Issues

#### 1. MCP Server Won't Start

```bash
# Check if already running
raze mcp status

# Stop existing server
raze mcp stop

# Start fresh
raze mcp start
```

#### 2. AI Can't Connect

- Verify the path in your AI assistant's config is correct
- Make sure the MCP server is running (`raze mcp status`)
- Restart your AI assistant after adding configuration

#### 3. Permission Errors

```bash
# Make sure the script is executable
chmod +x mcp-server.js

# Check file permissions
ls -la mcp-server.js
```

#### 4. Path Issues

- Use absolute paths in configuration files
- Replace forward slashes with backslashes on Windows if needed
- Verify Node.js is in your PATH

### Getting Help

```bash
# Check MCP server status
raze mcp status

# View available tools
raze mcp tools

# Test system integration
raze mcp test

# View configuration
raze mcp config
```

## 🎯 Pro Tips

### 1. **Start with Simple Commands**

Begin by asking AI to do simple tasks like "list files" or "get system info" before complex operations.

### 2. **Use Specific Instructions**

Instead of: "Help with my project"
Try: "Create a React component for wallet connection and save it to src/components/WalletConnect.js"

### 3. **Let AI Explain**

Ask: "Explain what you're doing as you create this smart contract"

### 4. **Combine with Web3 Features**

Use both MCP and Raze's Web3 commands: "Use Raze CLI to deploy this contract to multiple chains"

### 5. **Safety First**

- Start MCP server only when needed
- Review AI's actions before execution
- Keep backups of important files

## 🚀 Advanced Usage

### Custom Workflows

Create complex development workflows that AI can execute:

```
"Set up a complete NFT marketplace project:
1. Create smart contracts for NFT and marketplace
2. Write comprehensive tests
3. Deploy to testnet
4. Create React frontend with Web3 integration
5. Set up IPFS for metadata
6. Add wallet connection
7. Deploy frontend to Vercel
8. Open the live site"
```

### Team Collaboration

Share MCP configurations with your team:

```bash
# Export your configuration
raze mcp export-config team-config.json

# Team members can import it
raze mcp import-config team-config.json
```

## 🎉 What Makes This Special

### 🌟 **Revolutionary Development Experience**

- **Natural Language Programming**: Describe what you want, AI builds it
- **Complete Automation**: From idea to deployed dApp in minutes
- **Real-time Debugging**: AI reads logs and fixes issues instantly
- **System Integration**: AI controls your entire development environment

### 🎯 **Perfect for Hackathons**

- **Rapid Prototyping**: Build MVPs in minutes, not hours
- **Live Demos**: Show AI building projects in real-time
- **Complex Projects**: Create sophisticated dApps quickly
- **Debugging on Stage**: AI fixes issues during presentations

### 💡 **Learning Accelerator**

- **Learn by Watching**: See best practices implemented
- **Interactive Tutorials**: AI guides you through Web3 concepts
- **Instant Feedback**: AI explains its decisions
- **Hands-on Experience**: Work with real projects, not toy examples

---

## 🎊 Get Started Now!

```bash
# 1. Start the MCP server
raze mcp start

# 2. Configure your AI assistant (follow steps above)

# 3. Ask your AI:
"Hi! I can see you're connected to my Raze CLI. Can you help me build a simple DeFi staking contract?"
```

**Welcome to the future of AI-assisted Web3 development!** 🚀

Your AI assistant can now be your pair programming partner, system administrator, and deployment engineer all in one. Start with simple tasks and gradually build up to complex multi-chain dApp development workflows.

**Happy building!** 🎯
