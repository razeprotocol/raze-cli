import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { spawn } from "child_process";
import { promisify } from "util";
import { exec as _exec } from "child_process";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import os from "os";
const exec = promisify(_exec);

// Single registerMcp that supports both scripted and interactive use.
export default function registerMcp(program) {
  program
    .command("mcp")
    .description("Model Context Protocol (MCP) helpers for Celo: install | config | status | start | run-stub | read | write |call|balance|estimate|exec")
    .argument("[action]", "Action: install|config|status|start|run-stub|read|write|call|balance|estimate|exec")
    .option("--port <port>", "Port to run MCP server on", "5005")
    .option("--path <path>", "File path for read/write/list operations")
    .option("--content <content>", "Content for write_file (string)")
    .option("--to <to>", "Contract address or tx recipient")
    .option("--data <data>", "Hex-encoded call data or tx data")
    .option("--address <address>", "Address for balance/account queries")
    .option("--token <token>", "Token contract address for token balance")
    .option("--cmd <cmd>", "Command string for execute_command (limited)")
    .action(async (action, opts) => {
      if (!action) {
        const ans = await inquirer.prompt([
          { type: "list", name: "action", message: "Select MCP action:", choices: ["install", "config", "status", "start", "run-stub"] },
        ]);
        action = ans.action;
      }

      switch (action) {
        case "install":
          return printInstall();
        case "config":
          return await writeCursorConfig();
        case "status":
          return await checkStatus(opts.port);
        case "start":
          return await startOfficialOrStub(opts.port);
        case "run-stub":
          return await startStub(opts.port);
        case "read":
          return await cliRead(opts.path, opts.port);
        case "write":
          return await cliWrite(opts.path, opts.content, opts.port);
        case "call":
          return await cliCall(opts.to, opts.data, opts.port);
        case "balance":
          return await cliBalance(opts.address, opts.token, opts.port);
        case "estimate":
          return await cliEstimate(opts.port, { to: opts.to, data: opts.data });
        case "exec":
          return await cliExec(opts.cmd, opts.port);
        default:
          console.log(chalk.yellow("Unknown mcp action; use install|config|status|start|run-stub"));
      }
    });
}

async function httpRequest(path, method = 'GET', body = null, port = 5005) {
  const url = `http://localhost:${port}${path}`;
  try {
    const res = await fetch(url, body ? { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : undefined);
    const json = await res.json();
    console.log(json);
    return json;
  } catch (e) {
    console.error(chalk.red('Request failed:'), e.message);
  }
}

async function cliRead(p, port = 5005) {
  if (!p) return console.log(chalk.yellow('Use --path to specify file to read'));
  return await httpRequest(`/read_file?path=${encodeURIComponent(p)}`, 'GET', null, port);
}

async function cliWrite(p, content, port = 5005) {
  if (!p || typeof content !== 'string') return console.log(chalk.yellow('Use --path and --content to write a file'));
  return await httpRequest('/write_file', 'POST', { path: p, content }, port);
}

async function cliCall(to, data, port = 5005) {
  if (!to || !data) return console.log(chalk.yellow('Use --to and --data to call a contract function'));
  return await httpRequest('/call_contract_function', 'POST', { to, data }, port);
}

async function cliBalance(address, token, port = 5005) {
  if (!address) return console.log(chalk.yellow('Use --address to query balance'));
  const path = token ? `/get_token_balance?address=${encodeURIComponent(address)}&token=${encodeURIComponent(token)}` : `/get_token_balance?address=${encodeURIComponent(address)}`;
  return await httpRequest(path, 'GET', null, port);
}

async function cliEstimate(port = 5005, tx = {}) {
  return await httpRequest('/estimate_transaction', 'POST', tx, port);
}

async function cliExec(cmd, port = 5005) {
  if (!cmd) return console.log(chalk.yellow('Use --cmd to execute a (whitelisted) command'));
  return await httpRequest('/execute', 'POST', { tool: 'execute_command', args: { command: cmd } }, port);
}

async function printInstall() {
  console.log(chalk.cyan("Celo MCP - installation help"));
  console.log("The official Celo MCP server is a Python package. Recommended install options:");
  console.log("\n1) pipx (recommended):");
  console.log(chalk.gray("  pip install pipx && pipx install celo-mcp"));
  console.log("\n2) From source:");
  console.log(chalk.gray("  git clone https://github.com/celo-org/celo-mcp && cd celo-mcp && pip install -e ."));
  console.log("\nOnce installed, you can run: python -m celo_mcp.server");
  console.log("See: https://docs.celo.org/build-on-celo/build-with-ai/mcp/celo-mcp\n");
}

async function writeCursorConfig() {
  const cfg = {
    mcpServers: {
      "celo-mcp": {
        command: "python",
        args: ["-m", "celo_mcp.server"]
      }
    }
  };
  const home = os.homedir();
  const cursorDir = path.join(home, ".cursor");
  const out = path.join(cursorDir, "mcp.json");
  try {
    await exec(`mkdir -p "${cursorDir}"`);
    await exec(`printf '%s' '${JSON.stringify(cfg, null, 2)}' > "${out}"`);
    console.log(chalk.green(`Wrote MCP client config to ${out}`));
    console.log(chalk.gray("Tip: update paths to match your environment (e.g., use pipx-installed command)") );
  } catch (e) {
    console.error(chalk.red("Failed to write config:"), e.message);
  }
}

async function checkStatus(port = 5005) {
  const spinner = ora(`Checking MCP server at http://localhost:${port}/health`).start();
  try {
    const res = await fetch(`http://localhost:${port}/health`, { timeout: 2000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    spinner.succeed("MCP server is responding");
    console.log(j);
  } catch (e) {
    spinner.fail("MCP server not reachable");
    console.log(chalk.gray("Hint: run `raze mcp start` to launch the official Celo MCP server (requires Python) or `raze mcp run-stub` to run a lightweight Node stub."));
  }
}

async function startOfficialOrStub(port = 5005) {
  const spinner = ora("Starting official Celo MCP server (python -m celo_mcp.server)").start();

  // Try to spawn the official python MCP server. If python is not available or
  // the module isn't installed, fallback to the Node stub.
  const child = spawn("python", ["-m", "celo_mcp.server"], { stdio: "inherit" });

  let handledFallback = false;

  child.on("error", async (err) => {
    if (handledFallback) return;
    handledFallback = true;
    spinner.fail("Failed to spawn python MCP server; falling back to node stub");
    console.log(chalk.yellow("Python not found or spawn error:"), err.message);
    await startStub(port);
  });

  child.on("exit", async (code, signal) => {
    if (handledFallback) return;
    if (code === 0) {
      spinner.succeed("Started python MCP server (attached output). Ctrl-C to stop.");
    } else {
      handledFallback = true;
      spinner.fail(`python MCP server exited with code ${code || signal}; falling back to node stub`);
      await startStub(port);
    }
    console.log(chalk.yellow(`celo_mcp.server exited with ${code || signal}`));
  });

  // If the process was spawned successfully, show a spinner message but wait
  // for exit/error handlers to decide whether to fallback.
  // We don't call spinner.succeed here because the process may exit immediately
  // when the module is missing.
}

async function startStub(port = 5005) {
  const spinner = ora("Starting local Node MCP stub").start();
  try {
    // Resolve mcp-server.js relative to the CLI installation directory
    const { cliDir } = getCliPaths();
    const nodePath = path.join(cliDir, "mcp-server.js");

    if (!fs.existsSync(nodePath)) {
      spinner.fail("MCP stub not found");
      console.log(chalk.red(`Expected stub at: ${nodePath}`));
      console.log(chalk.gray("Tip: run this command from the raze-cli repo root or create a 'mcp-server.js' stub in the CLI root."));
      return;
    }

    const proc = spawn("node", [nodePath, "--port", String(port)], { stdio: "inherit" });
    spinner.succeed(`MCP stub running on http://localhost:${port} (attached). Ctrl-C to stop.`);
    proc.on("exit", (code) => {
      console.log(chalk.yellow(`mcp-server.js exited with ${code}`));
    });
  } catch (e) {
    spinner.fail("Failed to start MCP stub: " + e.message);
  }
}

// Helper function to get CLI directory and PID file path
function getCliPaths() {
  const currentFileUrl = import.meta.url;
  // decodeURIComponent fixes percent-encoded characters (e.g., spaces -> %20)
  const currentFilePath = decodeURIComponent(new URL(currentFileUrl).pathname);
  // Fix Windows path handling - remove leading slash on Windows
  const cleanPath =
    process.platform === "win32"
      ? currentFilePath.substring(1)
      : currentFilePath;
  const cliDir = path.dirname(path.dirname(cleanPath));
  const pidFile = path.join(cliDir, ".mcp-server.pid");
  return { cliDir, pidFile };
}

async function showMCPMenu() {
  const choices = [
    "Start MCP Server",
    "Stop MCP Server",
    "Check Server Status",
    "Configure Settings",
    "Test System Integration",
    "View Available Tools",
    "Generate MCP Client Config",
    "Cleanup Stale Processes",
  ];

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do with the MCP server?",
      choices,
    },
  ]);

  switch (answers.action) {
    case "Start MCP Server":
      await startMCPServer({});
      break;
    case "Stop MCP Server":
      await stopMCPServer();
      break;
    case "Check Server Status":
      await checkMCPStatus();
      break;
    case "Configure Settings":
      await configureMCP();
      break;
    case "Test System Integration":
      await testSystemIntegration();
      break;
    case "View Available Tools":
      await viewAvailableTools();
      break;
    case "Generate MCP Client Config":
      await generateClientConfig();
      break;
    case "Cleanup Stale Processes":
      await cleanupMCP();
      break;
  }
}

async function startMCPServer(opts) {
  const spinner = ora("Starting MCP server...").start();

  try {
    // Check if server is already running
    const isRunning = await checkServerRunning();
    if (isRunning) {
      spinner.warn("MCP server is already running");
      return;
    }

    // Get the CLI installation directory and paths
    const { cliDir, pidFile } = getCliPaths();
    const serverPath = path.join(cliDir, "mcp-daemon.js");

    console.log(chalk.gray(`Starting server daemon from: ${serverPath}`));

    const serverProcess = spawn("node", [serverPath], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"], // Completely detached
    });

    // Save PID for later management
    fs.writeFileSync(pidFile, serverProcess.pid.toString());

    serverProcess.unref();

    // Wait a moment to check if it started successfully
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const stillRunning = await checkServerRunning();
    if (stillRunning) {
      spinner.succeed("MCP server started successfully!");
      console.log(chalk.green(`📡 Server PID: ${serverProcess.pid}`));
      console.log(
        chalk.gray(
          `🔧 Available tools: System commands, file operations, application control`
        )
      );
      console.log(chalk.gray(`📝 Configuration saved to: ${pidFile}`));
      console.log(
        chalk.cyan("🤖 Ready for AI assistant connections via MCP protocol")
      );

      // Show usage instructions
      showUsageInstructions();
    } else {
      spinner.fail("Failed to start MCP server");
      console.log(chalk.red("Server process may have exited immediately."));
      console.log(
        chalk.yellow(
          "💡 Tip: Check if all dependencies are installed correctly."
        )
      );
    }
  } catch (error) {
    spinner.fail(`Failed to start MCP server: ${error.message}`);
  }
}

async function stopMCPServer() {
  const spinner = ora("Stopping MCP server...").start();

  try {
    const { pidFile } = getCliPaths();

    if (!fs.existsSync(pidFile)) {
      spinner.warn("No MCP server PID file found");
      return;
    }

    const pid = fs.readFileSync(pidFile, "utf8").trim();

    // First check if process actually exists
    const isActuallyRunning = await checkProcessExists(pid);
    if (!isActuallyRunning) {
      // Process is already dead, just clean up the PID file
      fs.unlinkSync(pidFile);
      spinner.succeed("MCP server was already stopped (cleaned up PID file)");
      return;
    }

    // Kill the process
    if (process.platform === "win32") {
      const { execSync } = await import("child_process");
      try {
        // Try graceful shutdown first
        execSync(`taskkill /PID ${pid}`, { stdio: "ignore" });

        // Wait a moment for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check if still running, if so force kill
        const stillRunning = await checkProcessExists(pid);
        if (stillRunning) {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        }
      } catch (killError) {
        // If taskkill fails, the process might already be dead
        console.log(chalk.yellow("Process may have already terminated"));
      }
    } else {
      try {
        process.kill(parseInt(pid), "SIGTERM");

        // Wait for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Force kill if still running
        try {
          process.kill(parseInt(pid), 0); // Check if still exists
          process.kill(parseInt(pid), "SIGKILL"); // Force kill
        } catch {
          // Process already terminated
        }
      } catch (error) {
        if (error.code !== "ESRCH") {
          throw error;
        }
        // ESRCH means process doesn't exist, which is fine
      }
    }

    // Remove PID file
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }

    spinner.succeed("MCP server stopped successfully!");
  } catch (error) {
    spinner.fail(`Failed to stop MCP server: ${error.message}`);

    // Offer to clean up PID file anyway
    const { pidFile } = getCliPaths();
    if (fs.existsSync(pidFile)) {
      console.log(
        chalk.yellow("💡 Tip: Run 'raze mcp cleanup' to remove stale PID file")
      );
    }
  }
}

async function checkMCPStatus() {
  const spinner = ora("Checking MCP server status...").start();

  try {
    const isRunning = await checkServerRunning();
    const { pidFile } = getCliPaths();

    if (isRunning && fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, "utf8").trim();
      spinner.succeed("MCP server is running");
      console.log(chalk.green(`📡 Status: Active`));
      console.log(chalk.gray(`🆔 PID: ${pid}`));
      console.log(
        chalk.gray(`🕐 Started: ${fs.statSync(pidFile).mtime.toLocaleString()}`)
      );
    } else {
      spinner.warn("MCP server is not running");
      console.log(chalk.yellow(`📡 Status: Inactive`));
      console.log(chalk.gray(`💡 Use 'raze mcp start' to start the server`));
    }
  } catch (error) {
    spinner.fail(`Failed to check status: ${error.message}`);
  }
}

async function checkServerRunning() {
  try {
    const { pidFile } = getCliPaths();
    if (!fs.existsSync(pidFile)) return false;

    const pid = parseInt(fs.readFileSync(pidFile, "utf8").trim());
    return await checkProcessExists(pid);
  } catch {
    return false;
  }
}

async function checkProcessExists(pid) {
  try {
    if (process.platform === "win32") {
      const { execSync } = await import("child_process");
      try {
        const result = execSync(`tasklist /FI "PID eq ${pid}"`, {
          encoding: "utf8",
          stdio: "pipe",
        });
        // Check if the output contains the PID (means process exists)
        return result.includes(pid.toString());
      } catch {
        return false;
      }
    } else {
      try {
        process.kill(pid, 0); // Signal 0 just checks if process exists
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}

async function configureMCP() {
  console.log(chalk.yellow("🔧 MCP Server Configuration"));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "host",
      message: "Server host:",
      default: "localhost",
    },
    {
      type: "input",
      name: "port",
      message: "Server port:",
      default: "3000",
    },
    {
      type: "checkbox",
      name: "enabledTools",
      message: "Select tools to enable:",
      choices: [
        "execute_command",
        "read_file",
        "write_file",
        "list_directory",
        "get_system_info",
        "find_applications",
        "launch_application",
        "check_port",
        "kill_process",
      ],
      default: [
        "execute_command",
        "read_file",
        "write_file",
        "list_directory",
        "get_system_info",
      ],
    },
    {
      type: "confirm",
      name: "allowFileWrite",
      message: "Allow file write operations?",
      default: true,
    },
    {
      type: "confirm",
      name: "allowSystemCommands",
      message: "Allow system command execution?",
      default: true,
    },
  ]);

  // Save configuration
  const configPath = path.join(process.cwd(), ".mcp-config.json");
  fs.writeFileSync(configPath, JSON.stringify(answers, null, 2));

  console.log(
    chalk.green("✅ Configuration saved to:"),
    chalk.gray(configPath)
  );
}

async function testSystemIntegration() {
  console.log(chalk.yellow("🧪 Testing System Integration"));

  const spinner = ora("Running system integration tests...").start();

  try {
    // Test 1: System Info
    spinner.text = "Testing system information access...";
    const os = await import("os");
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + "GB",
    };
    await new Promise((resolve) => setTimeout(resolve, 500));
    spinner.succeed("✅ System information access: OK");

    // Test 2: File Operations
    const spinner2 = ora("Testing file operations...").start();
    const testFile = path.join(process.cwd(), ".mcp-test.tmp");
    fs.writeFileSync(testFile, "MCP Test File");
    const content = fs.readFileSync(testFile, "utf8");
    fs.unlinkSync(testFile);
    spinner2.succeed("✅ File operations: OK");

    // Test 3: Command Execution
    const spinner3 = ora("Testing command execution...").start();
    const { execSync } = await import("child_process");
    const result = execSync(
      process.platform === "win32" ? "echo test" : "echo test",
      { encoding: "utf8" }
    );
    spinner3.succeed("✅ Command execution: OK");

    console.log(chalk.green("\n🎉 All system integration tests passed!"));
    console.log(
      chalk.gray(`🖥️  Platform: ${systemInfo.platform} (${systemInfo.arch})`)
    );
    console.log(chalk.gray(`💾 Memory: ${systemInfo.memory}`));
    console.log(chalk.gray(`🔧 CPUs: ${systemInfo.cpus}`));
  } catch (error) {
    spinner.fail(`System integration test failed: ${error.message}`);
  }
}

async function viewAvailableTools() {
  console.log(chalk.yellow("🛠️  Available MCP Tools"));

  const tools = [
    {
      name: "execute_command",
      description: "Execute shell commands on the local system",
      example: "Run npm install, git commands, etc.",
    },
    {
      name: "read_file",
      description: "Read contents of files on the local system",
      example: "Read package.json, contracts, configuration files",
    },
    {
      name: "write_file",
      description: "Write content to files on the local system",
      example: "Create new contracts, update configs, generate files",
    },
    {
      name: "list_directory",
      description: "List contents of directories",
      example: "Browse project structure, find files",
    },
    {
      name: "get_system_info",
      description: "Get system information (OS, CPU, memory)",
      example: "Check system capabilities for development",
    },
    {
      name: "find_applications",
      description: "Find installed applications on the system",
      example: "Locate VS Code, Node.js, Git, browsers",
    },
    {
      name: "launch_application",
      description: "Launch applications on the system",
      example: "Open VS Code, start browsers, run tools",
    },
    {
      name: "check_port",
      description: "Check if a port is open on localhost",
      example: "Verify if services are running",
    },
    {
      name: "kill_process",
      description: "Kill processes by name or PID",
      example: "Stop hung processes, cleanup resources",
    },
  ];

  tools.forEach((tool) => {
    console.log(chalk.cyan(`\n📦 ${tool.name}`));
    console.log(chalk.gray(`   ${tool.description}`));
    console.log(chalk.yellow(`   💡 ${tool.example}`));
  });

  console.log(
    chalk.green(
      "\n🔌 These tools can be accessed by AI assistants via MCP protocol"
    )
  );
}

async function generateClientConfig() {
  console.log(chalk.yellow("📋 Generating MCP Client Configuration"));

  const config = {
    mcpServers: {
      "raze-system": {
        command: "node",
        args: [path.resolve("mcp-server.js")],
        env: {},
        capabilities: {
          tools: true,
          resources: true,
        },
      },
    },
  };

  const configPath = path.join(process.cwd(), "mcp-client-config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(
    chalk.green("✅ Client configuration generated:"),
    chalk.gray(configPath)
  );
  console.log(chalk.yellow("\n📝 Usage Instructions:"));
  console.log(
    chalk.gray("1. Add this config to your AI assistant's MCP settings")
  );
  console.log(
    chalk.gray("2. The AI can now access your system through these tools")
  );
  console.log(chalk.gray("3. Start the MCP server: raze mcp start"));
  console.log(
    chalk.gray(
      "4. Your AI assistant can now execute commands, read/write files, and more!"
    )
  );
}

function showUsageInstructions() {
  console.log(chalk.yellow("\n📝 MCP Server Usage Instructions:"));
  console.log(
    chalk.gray("┌─────────────────────────────────────────────────────────┐")
  );
  console.log(
    chalk.gray("│ The MCP server allows AI assistants to:                │")
  );
  console.log(
    chalk.gray("│ • Execute commands on your system                      │")
  );
  console.log(
    chalk.gray("│ • Read and write files                                 │")
  );
  console.log(
    chalk.gray("│ • Launch applications                                  │")
  );
  console.log(
    chalk.gray("│ • Monitor system resources                             │")
  );
  console.log(
    chalk.gray("│ • Manage processes                                     │")
  );
  console.log(
    chalk.gray("└─────────────────────────────────────────────────────────┘")
  );
  console.log(chalk.cyan("\n🔧 Next Steps:"));
  console.log(
    chalk.gray("1. Configure your AI assistant to use this MCP server")
  );
  console.log(
    chalk.gray("2. Run: raze mcp config - to generate client configuration")
  );
  console.log(
    chalk.gray(
      "3. Your AI can now control your entire development environment!"
    )
  );
}

async function cleanupMCP() {
  const spinner = ora("Cleaning up stale MCP server processes...").start();

  try {
    const { pidFile } = getCliPaths();

    // Check if PID file exists
    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, "utf8").trim();

      // Check if process is actually running
      const isRunning = await checkProcessExists(pid);

      if (isRunning) {
        spinner.text = "Found running MCP server, stopping...";
        await stopMCPServer();
      } else {
        spinner.text = "Removing stale PID file...";
        fs.unlinkSync(pidFile);
      }
    }

    // Check for any rogue mcp-server processes
    const isWindows = process.platform === "win32";
    let command;

    if (isWindows) {
      command = `tasklist /FI "IMAGENAME eq node.exe" /FO CSV | findstr "mcp-server"`;
    } else {
      command = `ps aux | grep "mcp-server" | grep -v grep`;
    }

    try {
      const { execSync } = await import("child_process");
      const result = execSync(command, { encoding: "utf8", stdio: "pipe" });

      if (result.trim()) {
        spinner.text = "Found stale processes, cleaning up...";

        if (isWindows) {
          // Parse CSV output and kill processes
          const lines = result
            .split("\n")
            .filter((line) => line.includes("mcp-server"));
          for (const line of lines) {
            const parts = line.split(",");
            if (parts.length > 1) {
              const pid = parts[1].replace(/"/g, "");
              try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
              } catch (e) {
                // Ignore if process already terminated
              }
            }
          }
        } else {
          execSync(`pkill -f "mcp-server"`, { stdio: "ignore" });
        }
      }
    } catch (e) {
      // No stale processes found, which is good
    }

    spinner.succeed(chalk.green("✅ MCP server cleanup completed"));
    console.log(
      chalk.cyan("All stale processes and files have been cleaned up.")
    );
  } catch (error) {
    spinner.fail(chalk.red("❌ Cleanup failed"));
    console.error(chalk.red("Error during cleanup:"), error.message);
  }
}
