import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

// System actions that the ROT agent can perform
const SYSTEM_ACTIONS = {
  // Application launching
  OPEN_CHROME: "open_chrome",
  OPEN_BROWSER: "open_browser",
  OPEN_VSCODE: "open_vscode",
  OPEN_FILE_EXPLORER: "open_file_explorer",
  OPEN_APPLICATION: "open_application",

  // Web searches
  SEARCH_WEB: "search_web",
  SEARCH_GOOGLE: "search_google",
  SEARCH_GITHUB: "search_github",
  SEARCH_YOUTUBE: "search_youtube",

  // File operations
  CREATE_FILE: "create_file",
  CREATE_FOLDER: "create_folder",
  OPEN_FILE: "open_file",
  SHOW_DIRECTORY: "show_directory",

  // System information
  GET_SYSTEM_INFO: "get_system_info",
  CHECK_PROCESSES: "check_processes",
  KILL_PROCESS: "kill_process",

  // Development tasks
  RUN_COMMAND: "run_command",
  GIT_OPERATIONS: "git_operations",
  NPM_OPERATIONS: "npm_operations",

  // Productivity
  SET_REMINDER: "set_reminder",
  OPEN_CALENDAR: "open_calendar",
  SEND_NOTIFICATION: "send_notification",
};

// ROT agent class
class RotAgent {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.model = "gemini-pro";
    this.conversationHistory = [];
  }

  async analyzeRequest(prompt) {
    const systemPrompt = `You are ROT, an intelligent system agent assistant. Analyze the user request and respond with a JSON array of actions.

Available actions:
- OPEN_CHROME: Open Chrome browser
- SEARCH_GOOGLE: Search Google for something  
- GET_SYSTEM_INFO: Show system information
- RUN_COMMAND: Execute shell commands
- OPEN_VSCODE: Open VS Code
- CREATE_FILE: Create files
- CREATE_FOLDER: Create folders

IMPORTANT: Respond ONLY with valid JSON. No explanations, no markdown, just JSON.

Examples:

User: "open chrome and search web3 grants"
[{"action":"OPEN_CHROME","parameters":{},"description":"Opening Chrome browser","needsConfirmation":false},{"action":"SEARCH_GOOGLE","parameters":{"query":"web3 grants funding opportunities"},"description":"Searching for web3 grants","needsConfirmation":false}]

User: "show system info"  
[{"action":"GET_SYSTEM_INFO","parameters":{},"description":"Getting system information","needsConfirmation":false}]

User: "create a file called test.txt"
[{"action":"CREATE_FILE","parameters":{"path":"test.txt","content":""},"description":"Creating file test.txt","needsConfirmation":true}]

Request: "${prompt}"
Response:`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1000,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error("API Response:", JSON.stringify(data, null, 2));
        throw new Error("No response from AI - check API key and quota");
      }

      let aiResponse = data.candidates[0].content.parts[0].text.trim();

      // Clean up response - remove markdown formatting if present
      aiResponse = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "");

      // Try to parse JSON response
      try {
        const parsedActions = JSON.parse(aiResponse);
        return Array.isArray(parsedActions) ? parsedActions : [parsedActions];
      } catch (parseError) {
        console.error("Failed to parse AI response:", aiResponse);
        // Fallback to text parsing
        return this.parseTextResponse(prompt);
      }
    } catch (error) {
      console.error(chalk.red("Error analyzing request:"), error.message);
      // Fallback parsing
      return this.parseTextResponse(prompt);
    }
  }

  parseTextResponse(text) {
    // Fallback parser for non-JSON responses
    const actions = [];
    const lowerText = text.toLowerCase();

    // System info request
    if (
      lowerText.includes("system info") ||
      lowerText.includes("system information") ||
      lowerText.includes("show me system")
    ) {
      actions.push({
        action: "GET_SYSTEM_INFO",
        parameters: {},
        description: "Getting system information",
        needsConfirmation: false,
      });
    }

    // Chrome opening
    if (
      lowerText.includes("open chrome") ||
      lowerText.includes("launch chrome") ||
      lowerText.includes("start chrome")
    ) {
      actions.push({
        action: "OPEN_CHROME",
        parameters: {},
        description: "Opening Chrome browser",
        needsConfirmation: false,
      });
    }

    // Google search
    if (lowerText.includes("search") && !lowerText.includes("github")) {
      const searchPatterns = [
        /search(?:\s+(?:for|google))?\s+["\']?([^"\']+)["\']?/i,
        /google\s+["\']?([^"\']+)["\']?/i,
        /find\s+["\']?([^"\']+)["\']?/i,
      ];

      for (const pattern of searchPatterns) {
        const match = text.match(pattern);
        if (match) {
          actions.push({
            action: "SEARCH_GOOGLE",
            parameters: { query: match[1].trim() },
            description: `Searching Google for: ${match[1].trim()}`,
            needsConfirmation: false,
          });
          break;
        }
      }
    }

    // VS Code
    if (
      lowerText.includes("open vscode") ||
      lowerText.includes("open vs code") ||
      lowerText.includes("code")
    ) {
      actions.push({
        action: "OPEN_VSCODE",
        parameters: { path: "." },
        description: "Opening VS Code",
        needsConfirmation: false,
      });
    }

    // File creation
    if (lowerText.includes("create file") || lowerText.includes("make file")) {
      const fileMatch = text.match(
        /(?:create|make)\s+(?:file|a file)\s+(?:called\s+)?["\']?([^"\']+)["\']?/i
      );
      if (fileMatch) {
        actions.push({
          action: "CREATE_FILE",
          parameters: { path: fileMatch[1].trim(), content: "" },
          description: `Creating file: ${fileMatch[1].trim()}`,
          needsConfirmation: true,
        });
      }
    }

    // Folder creation
    if (
      lowerText.includes("create folder") ||
      lowerText.includes("make folder") ||
      lowerText.includes("create directory")
    ) {
      const folderMatch = text.match(
        /(?:create|make)\s+(?:folder|directory)\s+(?:called\s+)?["\']?([^"\']+)["\']?/i
      );
      if (folderMatch) {
        actions.push({
          action: "CREATE_FOLDER",
          parameters: { path: folderMatch[1].trim() },
          description: `Creating folder: ${folderMatch[1].trim()}`,
          needsConfirmation: true,
        });
      }
    }

    return actions.length > 0
      ? actions
      : [
          {
            action: "UNKNOWN",
            description: `Could not understand: "${text}". Try being more specific.`,
            needsConfirmation: false,
          },
        ];
  }

  async executeAction(action) {
    const spinner = ora(chalk.cyan(action.description)).start();

    try {
      switch (action.action) {
        case "OPEN_CHROME":
          await this.openChrome();
          break;

        case "OPEN_BROWSER":
          await this.openBrowser();
          break;

        case "SEARCH_GOOGLE":
          await this.searchGoogle(action.parameters.query);
          break;

        case "SEARCH_WEB":
          await this.searchWeb(action.parameters.query, action.parameters.site);
          break;

        case "SEARCH_GITHUB":
          await this.searchGithub(action.parameters.query);
          break;

        case "SEARCH_YOUTUBE":
          await this.searchYoutube(action.parameters.query);
          break;

        case "OPEN_VSCODE":
          await this.openVSCode(action.parameters.path);
          break;

        case "OPEN_FILE_EXPLORER":
          await this.openFileExplorer(action.parameters.path);
          break;

        case "CREATE_FILE":
          await this.createFile(
            action.parameters.path,
            action.parameters.content
          );
          break;

        case "CREATE_FOLDER":
          await this.createFolder(action.parameters.path);
          break;

        case "RUN_COMMAND":
          await this.runCommand(
            action.parameters.command,
            action.parameters.cwd
          );
          break;

        case "GET_SYSTEM_INFO":
          await this.getSystemInfo();
          break;

        case "SEND_NOTIFICATION":
          await this.sendNotification(
            action.parameters.title,
            action.parameters.message
          );
          break;

        case "UNKNOWN":
          throw new Error("Request not understood - try being more specific");

        default:
          throw new Error(`Unknown action: ${action.action}`);
      }

      spinner.succeed(chalk.green(`✓ ${action.description}`));
      return true;
    } catch (error) {
      spinner.fail(chalk.red(`✗ Failed: ${error.message}`));
      return false;
    }
  }

  // Action implementations
  async openChrome() {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      command = "start chrome";
    } else if (platform === "darwin") {
      command = 'open -a "Google Chrome"';
    } else {
      command = "google-chrome";
    }

    await execAsync(command);
  }

  async openBrowser() {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      command = 'start ""';
    } else if (platform === "darwin") {
      command = "open";
    } else {
      command = "xdg-open";
    }

    await execAsync(`${command} https://google.com`);
  }

  async searchGoogle(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encodedQuery}`;

    const platform = os.platform();
    let command;

    if (platform === "win32") {
      command = `start chrome "${url}"`;
    } else if (platform === "darwin") {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    await execAsync(command);
  }

  async searchWeb(query, site = null) {
    let searchQuery = query;
    if (site) {
      searchQuery = `site:${site} ${query}`;
    }
    await this.searchGoogle(searchQuery);
  }

  async searchGithub(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://github.com/search?q=${encodedQuery}`;

    const platform = os.platform();
    let command;

    if (platform === "win32") {
      command = `start chrome "${url}"`;
    } else if (platform === "darwin") {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    await execAsync(command);
  }

  async searchYoutube(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.youtube.com/results?search_query=${encodedQuery}`;

    const platform = os.platform();
    let command;

    if (platform === "win32") {
      command = `start chrome "${url}"`;
    } else if (platform === "darwin") {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    await execAsync(command);
  }

  async openVSCode(targetPath = ".") {
    await execAsync(`code "${targetPath}"`);
  }

  async openFileExplorer(targetPath = ".") {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      command = `explorer "${path.resolve(targetPath)}"`;
    } else if (platform === "darwin") {
      command = `open "${targetPath}"`;
    } else {
      command = `xdg-open "${targetPath}"`;
    }

    await execAsync(command);
  }

  async createFile(filePath, content = "") {
    fs.writeFileSync(filePath, content);
  }

  async createFolder(folderPath) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  async runCommand(command, cwd = process.cwd()) {
    const { stdout, stderr } = await execAsync(command, { cwd });

    if (stdout) {
      console.log(chalk.gray("Output:"));
      console.log(stdout);
    }

    if (stderr) {
      console.log(chalk.yellow("Warnings:"));
      console.log(stderr);
    }
  }

  async getSystemInfo() {
    const info = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + " GB",
        free: Math.round(os.freemem() / 1024 / 1024 / 1024) + " GB",
      },
      cpu: os.cpus()[0].model,
      cores: os.cpus().length,
    };

    console.log(chalk.cyan("System Information:"));
    console.log(JSON.stringify(info, null, 2));
  }

  async sendNotification(title, message) {
    const platform = os.platform();

    if (platform === "win32") {
      // Windows notification
      const command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message}', '${title}')"`;
      await execAsync(command);
    } else if (platform === "darwin") {
      // macOS notification
      await execAsync(
        `osascript -e 'display notification "${message}" with title "${title}"'`
      );
    } else {
      // Linux notification
      await execAsync(`notify-send "${title}" "${message}"`);
    }
  }
}

// CLI command registration
export default function registerRot(program) {
  program
    .command("rot")
    .description(
      "🤖 ROT Agent - Your intelligent system assistant powered by Gemini AI"
    )
    .argument(
      "[request...]",
      "What you want ROT to do (e.g., 'open chrome and search web3 grants')"
    )
    .option("--auto", "Automatically execute actions without confirmation")
    .option("--verbose", "Show detailed execution information")
    .action(async (requestParts, opts) => {
      const apiKey = "AIzaSyCadIp6D7oWiF9k8-rrgZ8DiPcohA0F-pA";
      if (!apiKey) {
        console.error(
          chalk.red(
            "GEMINI_API_KEY is not set. Please set GEMINI_API_KEY environment variable."
          )
        );
        return;
      }

      // Show ROT banner
      console.log(chalk.magentaBright("🤖 ROT Agent"));
      console.log(chalk.gray("Your intelligent system assistant\n"));

      let request =
        requestParts && requestParts.length
          ? requestParts.join(" ")
          : undefined;

      if (!request) {
        const answers = await inquirer.prompt([
          {
            name: "request",
            message: "What would you like ROT to do?",
            type: "input",
          },
        ]);
        request = answers.request;
      }

      if (!request) {
        console.error(chalk.red("No request provided."));
        return;
      }

      if (typeof fetch !== "function") {
        console.error(
          chalk.red(
            "Global fetch() is not available. Please use Node.js 18+ or add a fetch polyfill."
          )
        );
        return;
      }

      const agent = new RotAgent(apiKey);

      try {
        console.log(chalk.cyan("🔍 Analyzing your request..."));
        const actions = await agent.analyzeRequest(request);

        if (opts.verbose) {
          console.log(chalk.gray("Planned actions:"));
          console.log(JSON.stringify(actions, null, 2));
        }

        console.log(
          chalk.yellow(`\n📋 ROT will perform ${actions.length} action(s):`)
        );
        actions.forEach((action, i) => {
          console.log(chalk.white(`${i + 1}. ${action.description}`));
        });

        if (!opts.auto) {
          const { proceed } = await inquirer.prompt([
            {
              type: "confirm",
              name: "proceed",
              message: "Do you want ROT to proceed with these actions?",
              default: true,
            },
          ]);

          if (!proceed) {
            console.log(chalk.yellow("Operation cancelled."));
            return;
          }
        }

        console.log(chalk.green("\n🚀 Executing actions...\n"));

        let successCount = 0;
        for (const action of actions) {
          if (action.needsConfirmation && !opts.auto) {
            const { confirm } = await inquirer.prompt([
              {
                type: "confirm",
                name: "confirm",
                message: `Execute: ${action.description}?`,
                default: true,
              },
            ]);

            if (!confirm) {
              console.log(chalk.yellow("Skipped action."));
              continue;
            }
          }

          const success = await agent.executeAction(action);
          if (success) successCount++;
        }

        console.log(
          chalk.green(
            `\n✅ ROT completed ${successCount}/${actions.length} actions successfully!`
          )
        );

        if (successCount < actions.length) {
          console.log(
            chalk.yellow(
              "Some actions failed. Check the output above for details."
            )
          );
        }
      } catch (error) {
        console.error(chalk.red("Error:"), error.message);
        if (opts.verbose) {
          console.error(error.stack);
        }
      }
    });
}
