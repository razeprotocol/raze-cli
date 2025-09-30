import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Helper function to get CLI directory and PID file path
function getCliPaths() {
  const currentFileUrl = import.meta.url;
  const currentFilePath = new URL(currentFileUrl).pathname;
  // Fix Windows path handling - remove leading slash on Windows
  const cleanPath =
    process.platform === "win32"
      ? currentFilePath.substring(1)
      : currentFilePath;
  const cliDir = path.dirname(path.dirname(cleanPath));
  const pidFile = path.join(cliDir, ".mcp-server.pid");
  return { cliDir, pidFile };
}

export default function registerMcp(program) {
  program
    .command("mcp")
    .description("Model Context Protocol server for system integration")
    .option("--start", "Start the MCP server")
    .option("--stop", "Stop the MCP server")
    .option("--status", "Check MCP server status")
    .option("--config", "Configure MCP server settings")
    .option("--cleanup", "Clean up stale PID files and processes")
    .option("--port <port>", "Port for MCP server", "3000")
    .option("--host <host>", "Host for MCP server", "localhost")
    .argument("[action]", "MCP action to perform")
    .action(async (action, opts) => {
      console.log(chalk.cyan("🔌 Raze MCP Server Control"));

      if (opts.start || action === "start") {
        await startMCPServer(opts);
      } else if (opts.stop || action === "stop") {
        await stopMCPServer();
      } else if (opts.status || action === "status") {
        await checkMCPStatus();
      } else if (opts.config || action === "config") {
        await configureMCP();
      } else if (opts.cleanup || action === "cleanup") {
        await cleanupMCP();
      } else {
        await showMCPMenu();
      }
    });
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
