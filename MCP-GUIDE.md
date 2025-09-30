# Raze CLI - MCP (Model Context Protocol) Integration

## 🔌 What is MCP?

The Model Context Protocol (MCP) enables AI assistants to securely access external systems and data sources. Raze CLI includes a built-in MCP server that allows AI assistants to interact with your local development environment.

## 🌟 Features

### 🛠️ System Integration Tools

- **Command Execution**: Run shell commands, npm scripts, git operations
- **File Operations**: Read, write, and manage files in your project
- **Application Control**: Launch VS Code, browsers, and other development tools
- **Process Management**: Monitor and control running processes
- **Network Monitoring**: Check ports and network connections
- **System Information**: Access CPU, memory, OS details

### 🎯 Perfect For

- **AI-Assisted Development**: Let AI help with your entire development workflow
- **Automated Debugging**: AI can read logs, check processes, restart services
- **Smart Project Setup**: AI can create files, install dependencies, configure tools
- **Code Generation**: AI can write files directly to your project
- **System Monitoring**: AI can check system resources and running services

## 🚀 Quick Start

### Start the MCP Server

```bash
# Interactive menu
raze mcp

# Direct commands
raze mcp start
raze mcp status
raze mcp stop
raze mcp cleanup   # Clean up stale processes and files
```

### Configure Your AI Assistant

```bash
# Generate client configuration
raze mcp config
```

Add the generated configuration to your AI assistant's MCP settings.

## 📋 Available Tools

### 1. **execute_command**

Execute shell commands on your system

```json
{
  "command": "npm install ethers",
  "cwd": "./my-project",
  "timeout": 30000
}
```

### 2. **read_file**

Read contents of files

```json
{
  "filepath": "./package.json",
  "encoding": "utf8"
}
```

### 3. **write_file**

Create or update files

```json
{
  "filepath": "./contracts/MyToken.sol",
  "content": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract MyToken {\n    string public name = \"MyToken\";\n}"
}
```

### 4. **list_directory**

Browse directory contents

```json
{
  "dirpath": "./contracts",
  "recursive": true
}
```

### 5. **get_system_info**

Get system information

```json
{}
```

### 6. **find_applications**

Find installed applications

```json
{
  "search_term": "code"
}
```

### 7. **launch_application**

Launch applications

```json
{
  "app_name": "code",
  "args": ["./my-project"]
}
```

### 8. **check_port**

Check if ports are open

```json
{
  "port": 3000
}
```

### 9. **kill_process**

Stop processes

```json
{
  "identifier": "node",
  "force": false
}
```

## 🔧 Configuration

### Server Settings

```json
{
  "host": "localhost",
  "port": 3000,
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

### Client Configuration (for AI assistants)

```json
{
  "mcpServers": {
    "raze-system": {
      "command": "node",
      "args": ["path/to/raze-cli/mcp-server.js"],
      "env": {},
      "capabilities": {
        "tools": true,
        "resources": true
      }
    }
  }
}
```

## 🎪 Demo Scenarios

### 1. **Smart Contract Development**

AI can:

- Create Solidity contracts
- Run Hardhat commands
- Deploy to testnets
- Read and analyze contract code
- Set up project structure

### 2. **Full-Stack dApp Development**

AI can:

- Generate React components
- Install Web3 libraries
- Configure wallet connections
- Start development servers
- Open VS Code automatically

### 3. **Debugging & Monitoring**

AI can:

- Check running processes
- Read error logs
- Restart failed services
- Monitor system resources
- Kill hung processes

### 4. **Project Management**

AI can:

- Clone repositories
- Install dependencies
- Run tests
- Build projects
- Deploy applications

## 🛡️ Security Features

### 🔒 Built-in Safety

- **Sandboxed Execution**: Commands run in controlled environment
- **Path Validation**: File operations restricted to project directories
- **Process Isolation**: Limited process management capabilities
- **Timeout Protection**: Commands have execution time limits

### 🔧 Configurable Permissions

- Enable/disable specific tools
- Restrict file write access
- Control system command execution
- Set working directory limits

### 📝 Audit Trail

- All MCP operations are logged
- Process tracking with PIDs
- Command execution history
- File operation monitoring

## 🎯 Use Cases

### For Developers

- **AI Pair Programming**: AI can execute your ideas directly
- **Automated Setup**: AI sets up entire development environments
- **Smart Debugging**: AI reads logs and suggests fixes
- **Code Generation**: AI writes and saves code to files

### For Teams

- **Consistent Environments**: AI ensures everyone has same setup
- **Automated Workflows**: AI can run complex deployment scripts
- **Documentation**: AI can read and update project documentation
- **Testing**: AI can run tests and analyze results

### For Learning

- **Interactive Tutorials**: AI guides through Web3 development
- **Project Examples**: AI creates working examples instantly
- **Best Practices**: AI implements security patterns automatically
- **Exploration**: AI helps explore new technologies

## 🚀 Advanced Usage

### Custom Tool Development

Extend the MCP server with custom tools:

```javascript
// Add to mcp-server.js
async executeCustomTool(args) {
  // Your custom logic here
  return {
    content: [{ type: "text", text: "Custom tool result" }]
  };
}
```

### Integration with Other Tools

- **Git Operations**: AI can commit, push, pull
- **Docker Management**: AI can build and run containers
- **Database Operations**: AI can run queries and migrations
- **Cloud Deployment**: AI can deploy to AWS, Vercel, etc.

### Workflow Automation

Create complex workflows that AI can execute:

```bash
# AI can run this entire workflow:
# 1. Create smart contract
# 2. Write tests
# 3. Deploy to testnet
# 4. Verify on explorer
# 5. Generate frontend
# 6. Deploy frontend
# 7. Open in browser
```

## 📚 Examples

### Create a Complete DeFi Project

```
AI Prompt: "Create a yield farming project with staking contract, reward token, and React frontend. Deploy to Polygon testnet and open in VS Code."

MCP Actions:
1. execute_command: "mkdir yield-farm-project"
2. write_file: StakingContract.sol
3. write_file: RewardToken.sol
4. write_file: hardhat.config.js
5. execute_command: "npm install"
6. execute_command: "npx hardhat compile"
7. execute_command: "npx hardhat deploy --network mumbai"
8. write_file: React frontend files
9. execute_command: "npm create react-app frontend"
10. launch_application: "code ./yield-farm-project"
```

### Debug a Failed Deployment

```
AI Prompt: "My contract deployment failed. Help me debug it."

MCP Actions:
1. read_file: "deployment-log.txt"
2. execute_command: "npx hardhat node --verbose"
3. check_port: 8545
4. read_file: "hardhat.config.js"
5. execute_command: "npx hardhat test --verbose"
6. get_system_info: Check available memory
7. find_applications: Locate debugging tools
```

## 🔮 Future Enhancements

### Planned Features

- **Remote MCP Server**: Access MCP over network
- **Multi-Server Support**: Connect to multiple MCP servers
- **Custom Plugins**: Extensible tool system
- **Visual Interface**: Web-based MCP management
- **Team Collaboration**: Shared MCP configurations

### Integration Roadmap

- **VS Code Extension**: Native VS Code integration
- **Browser Extension**: Web-based MCP client
- **Mobile App**: Mobile development support
- **Cloud Services**: Integration with cloud platforms

## 📞 Support

### Getting Help

- **Documentation**: Comprehensive guides and examples
- **Community**: Discord server for questions and discussions
- **Issues**: GitHub issues for bugs and feature requests
- **Examples**: Sample configurations and use cases

### Troubleshooting

#### 🪟 Windows Process Management Issues

**Problem: "Unable to stop MCP server" or "Process not found" errors**

_Symptoms:_

- `raze mcp stop` reports errors like "The process 'XXXX' not found"
- Server appears to stop but leaves stale PID files
- Server status shows as running when it's actually stopped

_Solutions:_

1. **Use the cleanup command:**

   ```bash
   raze mcp cleanup
   ```

   This will:

   - Check if the process is actually running
   - Remove stale PID files
   - Kill any orphaned MCP server processes
   - Provide a clean slate for restarting

2. **Enhanced stop process (automatically included):**
   The latest version includes improved Windows process management:

   - Checks if process exists before attempting to kill
   - Uses graceful shutdown first, then force kill if needed
   - Automatically cleans up PID files on failed terminations
   - Provides helpful error messages and cleanup suggestions

3. **Manual cleanup (if needed):**

   ```bash
   # Check for running processes
   tasklist | findstr node

   # Kill specific process by PID
   taskkill /F /PID <process_id>

   # Remove stale PID file
   del .mcp-server.pid
   ```

**Problem: Server won't start after crash**

```bash
# Clean up any stale processes and files
raze mcp cleanup

# Try starting again
raze mcp start
```

**Problem: Multiple server instances**
If you accidentally started multiple servers:

```bash
# This will find and cleanup all MCP server processes
raze mcp cleanup

# Verify cleanup
raze mcp status
```

#### 🔧 General Issues

- **Connection Issues**: Check server status and configuration
- **Permission Errors**: Verify tool permissions in config
- **Command Failures**: Check system compatibility and dependencies
- **Performance**: Monitor system resources and optimize settings

#### 💡 Best Practices for Windows

1. **Always use cleanup**: Run `raze mcp cleanup` before troubleshooting
2. **Check status first**: Use `raze mcp status` to verify server state
3. **Use command line options**: Direct commands like `raze mcp --stop` for scripting
4. **Monitor processes**: Keep an eye on Node.js processes in Task Manager

---

**Ready to supercharge your development workflow with AI? Start with `raze mcp` and let AI take control of your entire development environment!** 🚀
