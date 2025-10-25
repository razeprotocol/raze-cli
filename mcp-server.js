#!/usr/bin/env node
// Lightweight Node MCP-compatible stub for local development and testing.
// This stub implements a small subset of the Celo MCP API surface as described
// in: https://docs.celo.org/build-on-celo/build-with-ai/mcp/celo-mcp
// It's intentionally conservative — it will not execute arbitrary shell commands.

import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv)).option("port", {
  type: "number",
  default: 5005,
}).argv;

const PORT = argv.port || 5005;
const CELO_RPC = process.env.CELO_RPC_URL || "https://forno.celo.org";

const app = express();
app.use(bodyParser.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", rpc: CELO_RPC });
});

app.get("/tools", (req, res) => {
  res.json({
    tools: [
      "get_network_status",
      "get_block",
      "get_latest_blocks",
      "get_account",
      "get_transaction",
      "get_token_info",
      "get_token_balance",
      "get_celo_balances",
      "get_nft_info",
      "get_nft_balance",
      "call_contract_function",
      "estimate_contract_gas",
      "estimate_transaction",
      "get_gas_fee_data",
      "get_governance_proposals",
      "get_proposal_details",
    ],
  });
});

// Proxy helper to call JSON-RPC on CELO_RPC
async function rpcCall(method, params = []) {
  const body = { jsonrpc: "2.0", id: 1, method, params };
  const r = await fetch(CELO_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

app.get("/get_network_status", async (req, res) => {
  try {
    const ch = await rpcCall("eth_chainId", []);
    res.json({ chainId: ch.result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/get_block", async (req, res) => {
  const number = req.query.number || "latest";
  try {
    const b = await rpcCall("eth_getBlockByNumber", [number, true]);
    res.json(b.result || b);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/get_account", async (req, res) => {
  const address = req.query.address;
  if (!address) return res.status(400).json({ error: "address required" });
  try {
    const bal = await rpcCall("eth_getBalance", [address, "latest"]);
    res.json({ address, balance: bal.result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Basic execute endpoint: for safety this is a no-op that echoes the requested tool and args.
app.post("/execute", async (req, res) => {
  const { tool, args } = req.body || {};
  // Do not execute arbitrary code in the stub. Return a structured acknowledgement.
  res.json({ status: "ok", tool: tool || null, args: args || null, note: "stub - no-op" });
});

app.listen(PORT, () => {
  console.log(`MCP stub listening on http://localhost:${PORT}`);
  console.log(`Using CELO_RPC=${CELO_RPC}`);
});
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";

const execAsync = promisify(exec);

class RazeMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "raze-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "execute_command",
            description: "Execute shell commands on the local system",
            inputSchema: {
              type: "object",
              properties: {
                command: {
                  type: "string",
                  description: "The command to execute",
                },
                cwd: {
                  type: "string",
                  description: "Working directory for the command",
                },
                timeout: {
                  type: "number",
                  description: "Timeout in milliseconds",
                  default: 30000,
                },
              },
              required: ["command"],
            },
          },
          {
            name: "read_file",
            description: "Read contents of a file on the local system",
            inputSchema: {
              type: "object",
              properties: {
                filepath: {
                  type: "string",
                  description: "Path to the file to read",
                },
                encoding: {
                  type: "string",
                  description: "File encoding",
                  default: "utf8",
                },
              },
              required: ["filepath"],
            },
          },
          {
            name: "write_file",
            description: "Write content to a file on the local system",
            inputSchema: {
              type: "object",
              properties: {
                filepath: {
                  type: "string",
                  description: "Path to the file to write",
                },
                content: {
                  type: "string",
                  description: "Content to write to the file",
                },
                encoding: {
                  type: "string",
                  description: "File encoding",
                  default: "utf8",
                },
              },
              required: ["filepath", "content"],
            },
          },
          {
            name: "list_directory",
            description: "List contents of a directory",
            inputSchema: {
              type: "object",
              properties: {
                dirpath: {
                  type: "string",
                  description: "Path to the directory to list",
                },
                recursive: {
                  type: "boolean",
                  description: "List recursively",
                  default: false,
                },
              },
              required: ["dirpath"],
            },
          },
          {
            name: "get_system_info",
            description: "Get system information (OS, CPU, memory, etc.)",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "find_applications",
            description: "Find installed applications on the system",
            inputSchema: {
              type: "object",
              properties: {
                search_term: {
                  type: "string",
                  description: "Application name or keyword to search for",
                },
              },
            },
          },
          {
            name: "launch_application",
            description: "Launch an application on the system",
            inputSchema: {
              type: "object",
              properties: {
                app_name: {
                  type: "string",
                  description: "Name or path of the application to launch",
                },
                args: {
                  type: "array",
                  items: { type: "string" },
                  description: "Arguments to pass to the application",
                },
              },
              required: ["app_name"],
            },
          },
          {
            name: "check_port",
            description: "Check if a port is open on localhost",
            inputSchema: {
              type: "object",
              properties: {
                port: {
                  type: "number",
                  description: "Port number to check",
                },
              },
              required: ["port"],
            },
          },
          {
            name: "kill_process",
            description: "Kill a process by name or PID",
            inputSchema: {
              type: "object",
              properties: {
                identifier: {
                  type: "string",
                  description: "Process name or PID to kill",
                },
                force: {
                  type: "boolean",
                  description: "Force kill the process",
                  default: false,
                },
              },
              required: ["identifier"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "execute_command":
            return await this.executeCommand(args);
          case "read_file":
            return await this.readFile(args);
          case "write_file":
            return await this.writeFile(args);
          case "list_directory":
            return await this.listDirectory(args);
          case "get_system_info":
            return await this.getSystemInfo();
          case "find_applications":
            return await this.findApplications(args);
          case "launch_application":
            return await this.launchApplication(args);
          case "check_port":
            return await this.checkPort(args);
          case "kill_process":
            return await this.killProcess(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "file://system/info",
            name: "System Information",
            description: "Current system information and status",
            mimeType: "application/json",
          },
          {
            uri: "file://processes/running",
            name: "Running Processes",
            description: "List of currently running processes",
            mimeType: "application/json",
          },
          {
            uri: "file://network/connections",
            name: "Network Connections",
            description: "Active network connections",
            mimeType: "application/json",
          },
        ],
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        switch (uri) {
          case "file://system/info":
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(await this.getSystemInfo(), null, 2),
                },
              ],
            };
          case "file://processes/running":
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    await this.getRunningProcesses(),
                    null,
                    2
                  ),
                },
              ],
            };
          case "file://network/connections":
            return {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(
                    await this.getNetworkConnections(),
                    null,
                    2
                  ),
                },
              ],
            };
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      }
    );
  }

  // Tool implementations
  async executeCommand(args) {
    const { command, cwd = process.cwd(), timeout = 30000 } = args;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      return {
        content: [
          {
            type: "text",
            text: `Command: ${command}\nOutput:\n${stdout}${
              stderr ? `\nError:\n${stderr}` : ""
            }`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Command failed: ${command}\nError: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async readFile(args) {
    const { filepath, encoding = "utf8" } = args;

    try {
      const content = fs.readFileSync(filepath, encoding);
      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to read file ${filepath}: ${error.message}`);
    }
  }

  async writeFile(args) {
    const { filepath, content, encoding = "utf8" } = args;

    try {
      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filepath, content, encoding);
      return {
        content: [
          {
            type: "text",
            text: `Successfully wrote to ${filepath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to write file ${filepath}: ${error.message}`);
    }
  }

  async listDirectory(args) {
    const { dirpath, recursive = false } = args;

    try {
      if (recursive) {
        const files = [];
        const walkDir = (dir) => {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            files.push({
              name: item,
              path: fullPath,
              type: stat.isDirectory() ? "directory" : "file",
              size: stat.size,
              modified: stat.mtime,
            });
            if (stat.isDirectory()) {
              walkDir(fullPath);
            }
          }
        };
        walkDir(dirpath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(files, null, 2),
            },
          ],
        };
      } else {
        const items = fs.readdirSync(dirpath);
        const files = items.map((item) => {
          const fullPath = path.join(dirpath, item);
          const stat = fs.statSync(fullPath);
          return {
            name: item,
            path: fullPath,
            type: stat.isDirectory() ? "directory" : "file",
            size: stat.size,
            modified: stat.mtime,
          };
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(files, null, 2),
            },
          ],
        };
      }
    } catch (error) {
      throw new Error(`Failed to list directory ${dirpath}: ${error.message}`);
    }
  }

  async getSystemInfo() {
    const os = await import("os");
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      currentWorkingDirectory: process.cwd(),
    };
  }

  async findApplications(args) {
    const { search_term } = args;
    const platform = process.platform;

    try {
      let command;
      if (platform === "win32") {
        // Windows - search in Program Files and common locations
        command = `Get-ChildItem "C:\\Program Files*" -Recurse -Name "*${search_term}*.exe" -ErrorAction SilentlyContinue | Select-Object -First 10`;
      } else if (platform === "darwin") {
        // macOS - search in Applications
        command = `find /Applications -name "*${search_term}*" -type d -maxdepth 2`;
      } else {
        // Linux - search in common paths
        command = `which ${search_term} || find /usr/bin /usr/local/bin -name "*${search_term}*" -type f`;
      }

      const { stdout } = await execAsync(command);
      return {
        content: [
          {
            type: "text",
            text: `Found applications:\n${stdout}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `No applications found matching "${search_term}"`,
          },
        ],
      };
    }
  }

  async launchApplication(args) {
    const { app_name, args: appArgs = [] } = args;

    try {
      const child = spawn(app_name, appArgs, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      return {
        content: [
          {
            type: "text",
            text: `Successfully launched ${app_name} with PID: ${child.pid}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to launch ${app_name}: ${error.message}`);
    }
  }

  async checkPort(args) {
    const { port } = args;
    const net = await import("net");

    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once("close", () => {
          resolve({
            content: [
              {
                type: "text",
                text: `Port ${port} is available`,
              },
            ],
          });
        });
        server.close();
      });
      server.on("error", () => {
        resolve({
          content: [
            {
              type: "text",
              text: `Port ${port} is in use`,
            },
          ],
        });
      });
    });
  }

  async killProcess(args) {
    const { identifier, force = false } = args;

    try {
      const platform = process.platform;
      let command;

      if (platform === "win32") {
        // Windows
        if (isNaN(identifier)) {
          // Process name
          command = `taskkill ${force ? "/F" : ""} /IM "${identifier}"`;
        } else {
          // PID
          command = `taskkill ${force ? "/F" : ""} /PID ${identifier}`;
        }
      } else {
        // Unix-like systems
        if (isNaN(identifier)) {
          // Process name
          command = `pkill ${force ? "-9" : ""} "${identifier}"`;
        } else {
          // PID
          command = `kill ${force ? "-9" : ""} ${identifier}`;
        }
      }

      await execAsync(command);
      return {
        content: [
          {
            type: "text",
            text: `Successfully killed process: ${identifier}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to kill process ${identifier}: ${error.message}`);
    }
  }

  async getRunningProcesses() {
    try {
      const platform = process.platform;
      let command;

      if (platform === "win32") {
        command =
          'tasklist /fo csv | ConvertFrom-Csv | Select-Object -First 20 "Image Name", PID, "Session Name", "Session#", "Mem Usage"';
      } else {
        command = "ps aux | head -20";
      }

      const { stdout } = await execAsync(command);
      return { processes: stdout };
    } catch (error) {
      return { error: error.message };
    }
  }

  async getNetworkConnections() {
    try {
      const platform = process.platform;
      let command;

      if (platform === "win32") {
        command = "netstat -an | findstr LISTEN";
      } else {
        command = "netstat -tuln";
      }

      const { stdout } = await execAsync(command);
      return { connections: stdout };
    } catch (error) {
      return { error: error.message };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(chalk.green("🚀 Raze MCP Server started successfully!"));
  }
}

// Start the server if this file is run directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith("mcp-server.js"))
) {
  console.error(chalk.blue("🔧 Starting Raze MCP Server..."));
  const server = new RazeMCPServer();
  server.start().catch((error) => {
    console.error(chalk.red("❌ Failed to start MCP server:"), error);
    process.exit(1);
  });
}

export default RazeMCPServer;
