# Raze CLI - MCP Server Integration Guide

Complete guide to using Raze CLI's Model Context Protocol (MCP) server for AI-assisted Web3 development.

## 🔌 Table of Contents

1. [🎯 Overview](#-overview)
2. [🚀 Quick Setup](#-quick-setup)
3. [🛠️ MCP Tools Reference](#️-mcp-tools-reference)
4. [🎪 Workflow Examples](#-workflow-examples)
5. [🔧 AI Assistant Setup](#-ai-assistant-setup)
6. [🔐 Security & Permissions](#-security--permissions)
7. [🐛 Troubleshooting](#-troubleshooting)
8. [💡 Advanced Usage](#-advanced-usage)

---

## 🎯 Overview

The Raze CLI MCP server transforms your development workflow by allowing AI assistants to directly control your development environment. Instead of just providing suggestions, AI can:

- **Execute Commands**: Run npm, git, deployment scripts
- **Manage Files**: Read contracts, write new code, update configs
- **Control Applications**: Launch VS Code, open browsers, start servers
- **Monitor System**: Check processes, ports, system resources
- **Deploy Contracts**: Complete multi-chain deployments
- **Debug Issues**: Read logs, analyze errors, fix problems

### 🏗️ Architecture

```
┌─────────────────┐    MCP Protocol    ┌─────────────────┐
│                 │ ◄─────────────────► │                 │
│  AI Assistant   │                    │  Raze MCP       │
│  (Claude,       │                    │  Server         │
│   ChatGPT, etc) │                    │                 │
└─────────────────┘                    └─────────────────┘
                                                │
                                                ▼
                                    ┌─────────────────┐
                                    │                 │
                                    │  Your System    │
                                    │  • File System  │
                                    │  • Applications │
                                    │  • Commands     │
                                    │  • Processes    │
                                    └─────────────────┘
```

---

## 🚀 Quick Setup

### 1. Start MCP Server

```bash
# Start the MCP server (works from any directory)
raze mcp start

# Check if running
raze mcp status
```

### 2. Generate AI Configuration

```bash
# Generate configuration for AI assistants
raze mcp config

# Run complete setup wizard
raze setup
```

### 3. Configure Your AI Assistant

#### For Claude (Desktop App)
1. Open Claude Settings → Developer
2. Add MCP Server with the generated configuration
3. Restart Claude

#### For ChatGPT (Custom GPT)
1. Create new Custom GPT
2. Add the generated configuration as actions
3. Enable the Raze CLI integration

### 4. Test Integration

Ask your AI assistant:
```
"Check the status of my Raze MCP server and show me the current directory contents"
```

The AI should be able to execute these commands and show you results!

---

## 🛠️ MCP Tools Reference

### 📂 File Operations

#### `read_file`
Read any file in your project.

**Parameters:**
- `filepath`: Path to file (relative or absolute)
- `encoding`: File encoding (default: utf8)

**Example Use:**
```
AI: "Read the main smart contract file"
MCP: read_file("contracts/MyToken.sol")
```

#### `write_file`
Create or update files.

**Parameters:**
- `filepath`: Path to file
- `content`: File content
- `encoding`: File encoding (default: utf8)

**Example Use:**
```
AI: "Create a new ERC20 token contract"
MCP: write_file("contracts/MyERC20.sol", "pragma solidity ^0.8.0;...")
```

#### `list_directory`
Browse directory contents.

**Parameters:**
- `dirpath`: Directory path
- `recursive`: List subdirectories (default: false)

**Example Use:**
```
AI: "Show me all the contract files"
MCP: list_directory("contracts/", true)
```

### ⚡ Command Execution

#### `execute_command`
Run shell commands.

**Parameters:**
- `command`: Command to execute
- `cwd`: Working directory (optional)
- `timeout`: Timeout in milliseconds (default: 30000)

**Example Use:**
```
AI: "Install OpenZeppelin contracts"
MCP: execute_command("npm install @openzeppelin/contracts")
```

**Common Commands:**
- `npm install ethers hardhat`
- `npx hardhat compile`
- `npx hardhat test`
- `git add . && git commit -m "feat: add staking"`
- `npx hardhat deploy --network mumbai`

### 🖥️ System Information

#### `get_system_info`
Get comprehensive system information.

**Returns:**
- Platform, architecture, memory
- Node.js version, current directory
- CPU count, system uptime

**Example Use:**
```
AI: "Check system resources before deploying"
MCP: get_system_info()
```

#### `check_port`
Check if a port is available.

**Parameters:**
- `port`: Port number to check

**Example Use:**
```
AI: "Is port 3000 available for the frontend server?"
MCP: check_port(3000)
```

### 🚀 Application Control

#### `find_applications`
Find installed applications.

**Parameters:**
- `search_term`: Application name or keyword

**Example Use:**
```
AI: "Find VS Code installation"
MCP: find_applications("code")
```

#### `launch_application`
Launch applications.

**Parameters:**
- `app_name`: Application name or path
- `args`: Command line arguments (optional)

**Example Use:**
```
AI: "Open this project in VS Code"
MCP: launch_application("code", ["."])
```

### 🔄 Process Management

#### `kill_process`
Stop processes by name or PID.

**Parameters:**
- `identifier`: Process name or PID
- `force`: Force kill (default: false)

**Example Use:**
```
AI: "Stop any running hardhat nodes"
MCP: kill_process("hardhat")
```

---

## 🎪 Workflow Examples

### 🏗️ Complete DeFi Project Setup

```
AI Prompt: "Create a yield farming project with React frontend, deploy to Polygon testnet, and open in VS Code"

Execution Flow:
1. execute_command("mkdir yield-farm-dapp")
2. execute_command("cd yield-farm-dapp && npm init -y")
3. write_file("package.json", {...dependencies...})
4. write_file("contracts/StakingRewards.sol", {...staking contract...})
5. write_file("hardhat.config.js", {...polygon config...})
6. execute_command("npm install")
7. execute_command("npx hardhat compile")
8. execute_command("npx hardhat deploy --network mumbai")
9. execute_command("npx create-react-app frontend")
10. write_file("frontend/src/components/Staking.jsx", {...staking UI...})
11. launch_application("code", ["."])
```

### 🐛 Automated Debugging

```
AI Prompt: "My contract deployment failed. Debug and fix it."

Execution Flow:
1. read_file("scripts/deploy.js")
2. execute_command("npx hardhat compile 2>&1")
3. get_system_info() // Check if enough memory
4. check_port(8545) // Check if Hardhat node is running
5. read_file("hardhat.config.js")
6. execute_command("npx hardhat test --verbose")
7. write_file("contracts/Fixed.sol", {...fixed contract...})
8. execute_command("npx hardhat deploy --network mumbai")
```

### 🔄 Continuous Development

```
AI Prompt: "Add a pause functionality to the contract, update tests, and redeploy"

Execution Flow:
1. read_file("contracts/MyContract.sol")
2. write_file("contracts/MyContract.sol", {...updated with pause...})
3. read_file("test/MyContract.test.js")
4. write_file("test/MyContract.test.js", {...updated tests...})
5. execute_command("npx hardhat test")
6. execute_command("npx hardhat deploy --network mumbai")
7. execute_command("git add .")
8. execute_command("git commit -m 'feat: add pause functionality'")
```

### 📊 Project Analysis

```
AI Prompt: "Analyze my project structure and suggest improvements"

Execution Flow:
1. list_directory(".", true)
2. read_file("package.json")
3. read_file("hardhat.config.js")
4. execute_command("npm audit")
5. execute_command("npx hardhat size-contracts")
6. get_system_info()
7. // AI provides comprehensive analysis and suggestions
```

---

## 🔧 AI Assistant Setup

### Claude (Anthropic)

1. **Download Claude Desktop**
2. **Open Settings → Developer**
3. **Add MCP Server:**

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

4. **Restart Claude**
5. **Test:** "List files in current directory"

### ChatGPT (Custom GPT)

1. **Create Custom GPT**
2. **Add Actions Schema:**

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Raze CLI MCP Integration",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "http://localhost:3000"
    }
  ],
  "paths": {
    "/tools": {
      "post": {
        "summary": "Execute MCP tool",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "tool": {"type": "string"},
                  "args": {"type": "object"}
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Local AI Models

For Ollama, LM Studio, or other local models:

1. **Install MCP Client Library**
2. **Configure Connection:**

```javascript
const client = new MCPClient({
  serverCommand: 'node',
  serverArgs: ['path/to/raze-cli/mcp-server.js']
});
```

---

## 🔐 Security & Permissions

### 🛡️ Built-in Safety Features

- **Sandboxed Execution**: Commands run in controlled environment
- **Path Validation**: File operations restricted to project directories
- **Process Isolation**: Limited process management capabilities
- **Timeout Protection**: Commands have execution time limits
- **Audit Trail**: All operations logged with timestamps

### ⚙️ Configuration Options

#### Enable/Disable Tools

```json
{
  "enabledTools": [
    "execute_command",
    "read_file",
    "write_file",
    "list_directory",
    "get_system_info"
  ],
  "allowFileWrite": true,
  "allowSystemCommands": true
}
```

#### File Access Restrictions

```json
{
  "allowedPaths": [
    "./contracts/",
    "./scripts/",
    "./test/",
    "./frontend/"
  ],
  "blockedPaths": [
    "/system/",
    "/usr/",
    "/windows/"
  ]
}
```

### 🔒 Best Practices

1. **Dedicated Development Environment**: Use MCP on development machines only
2. **Limited Permissions**: Only enable tools you need
3. **Regular Audits**: Review MCP logs regularly
4. **Network Isolation**: Don't expose MCP server to internet
5. **Backup Important Files**: Always backup before AI modifications

---

## 🐛 Troubleshooting

### Common Issues

#### MCP Server Won't Start

```bash
# Check if server is running
raze mcp status

# Clean up stale processes
raze mcp cleanup

# Start with debug info
raze mcp start --debug
```

#### AI Can't Connect

1. **Verify server is running**: `raze mcp status`
2. **Check configuration**: Ensure AI has correct server path
3. **Test connectivity**: Try simple command like "get system info"
4. **Restart both**: Stop MCP server and restart AI assistant

#### Permission Errors

```bash
# Check file permissions
ls -la contracts/

# Run with elevated permissions (if needed)
sudo raze mcp start

# Update MCP configuration to allow specific paths
raze mcp config --allow-paths "./my-project/"
```

#### Windows-Specific Issues

```powershell
# Ensure PowerShell execution policy allows scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Check Windows Defender isn't blocking
Add-MpPreference -ExclusionPath "C:\path\to\raze-cli"

# Use Windows paths in configuration
"command": "C:\\Users\\YourName\\AppData\\Roaming\\npm\\node.exe"
```

### Debug Commands

```bash
# Verbose logging
raze mcp start --verbose

# Test specific tool
raze mcp test --tool "execute_command" --args '{"command": "pwd"}'

# Check MCP logs
raze mcp logs --tail 50

# Validate configuration
raze mcp validate-config
```

---

## 💡 Advanced Usage

### 🔧 Custom Tool Development

Extend MCP server with custom tools:

```javascript
// Add to mcp-server.js
class CustomTool {
  async deployToMultipleChains(args) {
    const { contract, chains } = args;
    
    for (const chain of chains) {
      await this.executeCommand({
        command: `npx hardhat deploy --network ${chain} ${contract}`
      });
    }
    
    return {
      content: [{
        type: "text",
        text: `Deployed ${contract} to ${chains.join(', ')}`
      }]
    };
  }
}
```

### 🌐 Remote MCP Access

Setup MCP server for remote access:

```bash
# Start server with external access
raze mcp start --host 0.0.0.0 --port 3000

# Use with authentication
raze mcp start --auth-token "your-secure-token"

# Setup SSL/TLS
raze mcp start --ssl --cert ./ssl/cert.pem --key ./ssl/key.pem
```

### 🔄 Integration with CI/CD

```yaml
# .github/workflows/ai-deploy.yml
name: AI-Assisted Deployment
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Raze CLI
        run: |
          npm install -g raze-cli
          raze mcp start --background
      - name: AI Deploy
        run: |
          raze ai "Deploy contracts to testnet and verify"
```

### 📊 Monitoring & Analytics

```bash
# Monitor MCP operations
raze mcp monitor --dashboard

# Generate usage reports
raze mcp analytics --period "last-week"

# Export operation logs
raze mcp export --format json --output ./mcp-logs.json
```

---

## 🎯 Use Cases by Role

### 👨‍💻 Solo Developer
- **AI Pair Programming**: "Add staking rewards to my DeFi contract"
- **Quick Prototyping**: "Create a simple NFT marketplace"
- **Debug Assistance**: "Fix this deployment error"

### 👥 Team Lead
- **Onboarding**: "Setup development environment for new team member"
- **Code Reviews**: "Analyze this contract for security issues"
- **Documentation**: "Generate README for this project"

### 🎓 Student/Learner
- **Interactive Learning**: "Explain and implement a flash loan contract"
- **Project Generation**: "Create a complete DeFi tutorial project"
- **Best Practices**: "Show me proper testing patterns for smart contracts"

### 🏢 Enterprise
- **Audit Preparation**: "Generate comprehensive security analysis"
- **Multi-Chain Deployment**: "Deploy to all supported networks"
- **Compliance**: "Ensure contracts meet regulatory requirements"

---

## 🚀 Future Roadmap

### Planned Features
- **Multi-Server Support**: Connect multiple development environments
- **Visual Interface**: Web-based MCP management dashboard
- **Team Collaboration**: Shared MCP configurations and sessions
- **Cloud Integration**: AWS, GCP, Azure deployment automation
- **Advanced Security**: Role-based access control, audit trails

### Community Features
- **Plugin System**: Community-developed MCP tools
- **Template Library**: Pre-built AI workflows for common tasks
- **Marketplace**: Share and discover AI development patterns

---

## 📞 Support & Community

- **Documentation**: [Full MCP Guide](./MCP-GUIDE.md)
- **Issues**: [GitHub Issues](https://github.com/razeprotocol/raze-cli/issues)
- **Discord**: [Raze Community](https://discord.gg/raze)
- **Examples**: [MCP Examples Repository](https://github.com/razeprotocol/mcp-examples)

---

**Ready to revolutionize your Web3 development with AI? Start with `raze mcp start` and let AI take control!** 🚀