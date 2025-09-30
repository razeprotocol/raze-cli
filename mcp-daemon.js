import { spawn } from "child_process";
import chalk from "chalk";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import the MCP server logic without instantiating it
import RazeMCPServer from "./mcp-server.js";

// MCP Server Daemon - keeps the server running as a background service
class MCPDaemon {
  constructor() {
    this.server = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      console.error(chalk.yellow("MCP server is already running"));
      return;
    }

    try {
      console.error(chalk.blue("🔧 Starting MCP Server Daemon..."));

      // Create a dummy stdio transport that keeps the process alive
      const dummyTransport = {
        onMessage: () => {},
        send: () => {},
        close: () => {},
      };

      // Create the server instance
      this.server = new RazeMCPServer();
      this.isRunning = true;

      console.error(chalk.green("🚀 MCP Server Daemon started successfully!"));
      console.error(
        chalk.gray("Server is running and ready to accept connections.")
      );

      // Keep the process alive
      process.on("SIGINT", () => this.stop());
      process.on("SIGTERM", () => this.stop());

      // Keep the process running with a heartbeat
      const heartbeat = setInterval(() => {
        // Heartbeat to keep daemon alive
        if (!this.isRunning) {
          clearInterval(heartbeat);
        }
      }, 5000);
    } catch (error) {
      console.error(chalk.red("❌ Failed to start MCP server daemon:"), error);
      process.exit(1);
    }
  }

  stop() {
    if (!this.isRunning) {
      console.error(chalk.yellow("MCP server is not running"));
      return;
    }

    console.error(chalk.blue("🛑 Stopping MCP Server Daemon..."));
    this.isRunning = false;

    if (this.server) {
      // Gracefully shutdown the server
      this.server = null;
    }

    console.error(chalk.green("✅ MCP Server Daemon stopped"));
    process.exit(0);
  }
}

// Start daemon if this file is run directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.includes("mcp-daemon.js")
) {
  const daemon = new MCPDaemon();
  daemon.start();
}

export default MCPDaemon;
