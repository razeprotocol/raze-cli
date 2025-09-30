import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import chalk from "chalk";

class RazeMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  async connect() {
    try {
      console.log(chalk.cyan("🔌 Connecting to Raze MCP Server..."));

      // Spawn the MCP server process
      const serverProcess = spawn("node", ["mcp-server.js"], {
        stdio: ["pipe", "pipe", "inherit"],
      });

      // Create transport using the server's stdio
      this.transport = new StdioClientTransport({
        readable: serverProcess.stdout,
        writable: serverProcess.stdin,
      });

      // Create and connect client
      this.client = new Client(
        {
          name: "raze-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      await this.client.connect(this.transport);
      console.log(chalk.green("✅ Connected to MCP server successfully!"));

      return true;
    } catch (error) {
      console.error(
        chalk.red("❌ Failed to connect to MCP server:"),
        error.message
      );
      return false;
    }
  }

  async listTools() {
    try {
      const response = await this.client.request(
        { method: "tools/list" },
        { method: "tools/list" }
      );

      console.log(chalk.yellow("🛠️  Available Tools:"));
      response.tools.forEach((tool) => {
        console.log(chalk.cyan(`📦 ${tool.name}`));
        console.log(chalk.gray(`   ${tool.description}`));
      });

      return response.tools;
    } catch (error) {
      console.error(chalk.red("❌ Failed to list tools:"), error.message);
      return [];
    }
  }

  async callTool(name, args) {
    try {
      console.log(chalk.cyan(`🔧 Calling tool: ${name}`));
      console.log(chalk.gray(`📋 Arguments:`, JSON.stringify(args, null, 2)));

      const response = await this.client.request(
        {
          method: "tools/call",
          params: {
            name,
            arguments: args,
          },
        },
        { method: "tools/call" }
      );

      if (response.isError) {
        console.error(chalk.red("❌ Tool execution failed:"));
        console.log(response.content[0].text);
      } else {
        console.log(chalk.green("✅ Tool executed successfully:"));
        console.log(response.content[0].text);
      }

      return response;
    } catch (error) {
      console.error(
        chalk.red(`❌ Failed to call tool ${name}:`),
        error.message
      );
      return null;
    }
  }

  async runDemo() {
    console.log(chalk.yellow("🎪 Running MCP Client Demo"));

    const connected = await this.connect();
    if (!connected) return;

    // List available tools
    await this.listTools();

    console.log(chalk.yellow("\n🧪 Testing Tools:"));

    // Test 1: Get system info
    await this.callTool("get_system_info", {});

    // Test 2: List current directory
    await this.callTool("list_directory", {
      dirpath: process.cwd(),
      recursive: false,
    });

    // Test 3: Create a test file
    await this.callTool("write_file", {
      filepath: "./mcp-test.txt",
      content: "Hello from MCP server! This file was created via MCP protocol.",
    });

    // Test 4: Read the test file
    await this.callTool("read_file", {
      filepath: "./mcp-test.txt",
    });

    // Test 5: Execute a simple command
    await this.callTool("execute_command", {
      command:
        process.platform === "win32"
          ? "echo Hello from MCP!"
          : "echo 'Hello from MCP!'",
    });

    // Test 6: Check a port
    await this.callTool("check_port", {
      port: 3000,
    });

    console.log(chalk.green("\n🎉 MCP Demo completed successfully!"));
    console.log(
      chalk.gray(
        "Your AI assistant can now use these tools to interact with your system."
      )
    );

    this.disconnect();
  }

  disconnect() {
    if (this.client && this.transport) {
      this.client.close();
      console.log(chalk.gray("🔌 Disconnected from MCP server"));
    }
  }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new RazeMCPClient();
  client.runDemo().catch(console.error);
}

export default RazeMCPClient;
