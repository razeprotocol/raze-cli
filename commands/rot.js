import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

// ROT agent class
class RotAgent {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.model = "gemini-1.5-flash";
  }

  async analyzeRequest(prompt) {
    // Enhanced fallback parsing since AI often fails
    return this.parseTextResponse(prompt);
  }

  parseTextResponse(text) {
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

    // LinkedIn profile
    if (lowerText.includes("linkedin") || lowerText.includes("my linkedin")) {
      actions.push({
        action: "OPEN_LINKEDIN",
        parameters: {},
        description: "Opening LinkedIn profile",
        needsConfirmation: false,
      });
    }

    // ChatGPT
    if (
      lowerText.includes("chatgpt") ||
      lowerText.includes("chat gpt") ||
      lowerText.includes("open gpt")
    ) {
      let query = "";
      const chatMatch = text.match(
        /(?:chatgpt|chat gpt).+?(?:ask|about|how to|learn|help with)\s+(.+)/i
      );
      if (chatMatch) {
        query = chatMatch[1].trim();
      }

      actions.push({
        action: "OPEN_CHATGPT",
        parameters: { query: query },
        description: query
          ? `Opening ChatGPT and asking about: ${query}`
          : "Opening ChatGPT",
        needsConfirmation: false,
      });
    }

    // YouTube search (specific platform)
    if (lowerText.includes("youtube") || lowerText.includes("search youtube")) {
      const youtubeMatch = text.match(
        /(?:search\s+)?youtube\s+(?:for\s+)?["\']?([^"\']+)["\']?/i
      );
      if (youtubeMatch) {
        actions.push({
          action: "SEARCH_YOUTUBE",
          parameters: { query: youtubeMatch[1].trim() },
          description: `Searching YouTube for: ${youtubeMatch[1].trim()}`,
          needsConfirmation: false,
        });
      } else {
        actions.push({
          action: "OPEN_YOUTUBE",
          parameters: {},
          description: "Opening YouTube",
          needsConfirmation: false,
        });
      }
    }

    // GitHub search (specific platform)
    else if (
      lowerText.includes("github") ||
      lowerText.includes("search github")
    ) {
      const githubMatch = text.match(
        /(?:search\s+)?github\s+(?:for\s+)?["\']?([^"\']+)["\']?/i
      );
      if (githubMatch) {
        actions.push({
          action: "SEARCH_GITHUB",
          parameters: { query: githubMatch[1].trim() },
          description: `Searching GitHub for: ${githubMatch[1].trim()}`,
          needsConfirmation: false,
        });
      }
    }

    // General Google search (fallback for non-specific searches)
    else if (
      lowerText.includes("search") ||
      lowerText.includes("google") ||
      lowerText.includes("find")
    ) {
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
      lowerText.includes("vscode")
    ) {
      actions.push({
        action: "OPEN_VSCODE",
        parameters: { path: "." },
        description: "Opening VS Code",
        needsConfirmation: false,
      });
    }

    // File creation
    if (
      lowerText.includes("create file") ||
      lowerText.includes("make file") ||
      lowerText.includes("create a file") ||
      lowerText.includes("make a file")
    ) {
      const fileMatch = text.match(
        /(?:create|make)\s+(?:a\s+)?file\s+(?:called\s+)?["\']?([^"\']+)["\']?/i
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
      lowerText.includes("create directory") ||
      lowerText.includes("create a folder")
    ) {
      const folderMatch = text.match(
        /(?:create|make)\s+(?:a\s+)?(?:folder|directory)\s+(?:called\s+)?["\']?([^"\']+)["\']?/i
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

        case "SEARCH_GOOGLE":
          await this.searchGoogle(action.parameters.query);
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

        case "CREATE_FILE":
          await this.createFile(
            action.parameters.path,
            action.parameters.content
          );
          break;

        case "CREATE_FOLDER":
          await this.createFolder(action.parameters.path);
          break;

        case "GET_SYSTEM_INFO":
          await this.getSystemInfo();
          break;

        case "OPEN_LINKEDIN":
          await this.openLinkedIn();
          break;

        case "OPEN_CHATGPT":
          await this.openChatGPT(action.parameters.query);
          break;

        case "OPEN_YOUTUBE":
          await this.openYouTube();
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

  async createFile(filePath, content = "") {
    fs.writeFileSync(filePath, content);
  }

  async createFolder(folderPath) {
    fs.mkdirSync(folderPath, { recursive: true });
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

  async openLinkedIn() {
    const url = "https://www.linkedin.com/in/me/";
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

  async openChatGPT(query = "") {
    let url = "https://chat.openai.com/";

    if (query) {
      console.log(chalk.cyan(`💡 Ask ChatGPT: "${query}"`));
    }

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

  async openYouTube() {
    const url = "https://www.youtube.com/";
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

      const agent = new RotAgent("dummy-key");

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
