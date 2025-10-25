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
    const systemPrompt = `You are ROT, an ultra-intelligent system agent assistant. You can control ANY application and perform ANY system operation. Analyze the user request and respond with a JSON array of actions.

Available actions:
- OPEN_CHROME: Open Chrome browser
- SEARCH_GOOGLE: Search Google for something  
- SEARCH_YOUTUBE: Search YouTube for videos
- SEARCH_GITHUB: Search GitHub for repositories
- GET_SYSTEM_INFO: Show system information
- RUN_COMMAND: Execute shell commands
- OPEN_VSCODE: Open VS Code
- CREATE_FILE: Create files
- CREATE_FOLDER: Create folders
- OPEN_LINKEDIN: Open LinkedIn profile
- OPEN_CHATGPT: Open ChatGPT with optional pre-filled text
- OPEN_YOUTUBE: Open YouTube homepage
- TAKE_PHOTO: Take a photo using camera
- OPEN_CAMERA: Open camera application
- OPEN_WHATSAPP: Open WhatsApp application
- OPEN_WHATSAPP_CHAT: Open specific WhatsApp chat
- OPEN_APPLICATION: Open any installed application
- SEND_WHATSAPP_MESSAGE: Send message in WhatsApp
- CONTROL_APPLICATION: Control specific application features
- TAKE_SCREENSHOT: Take screenshot
- OPEN_CALCULATOR: Open calculator
- OPEN_NOTEPAD: Open notepad
- OPEN_SETTINGS: Open system settings

IMPORTANT: 
1. Respond ONLY with valid JSON. No explanations, no markdown, just JSON.
2. For ChatGPT, use "text" parameter to pre-fill the input field
3. For WhatsApp, use "contact" parameter for specific person/chat
4. For camera/photo, understand various photo-taking requests
5. Be creative and understand natural language requests

Examples:

User: "open camera and take a picture"
[{"action":"TAKE_PHOTO","parameters":{},"description":"Taking a photo with camera","needsConfirmation":false}]

User: "open whatsapp and message john"
[{"action":"OPEN_WHATSAPP_CHAT","parameters":{"contact":"john"},"description":"Opening WhatsApp chat with John","needsConfirmation":false}]

User: "open chatgpt and ask about machine learning"
[{"action":"OPEN_CHATGPT","parameters":{"text":"explain machine learning concepts and applications"},"description":"Opening ChatGPT with machine learning query","needsConfirmation":false}]

User: "take a screenshot of my desktop"
[{"action":"TAKE_SCREENSHOT","parameters":{},"description":"Taking screenshot of desktop","needsConfirmation":false}]

User: "open whatsapp first chat"
[{"action":"OPEN_WHATSAPP","parameters":{"action":"first_chat"},"description":"Opening WhatsApp and navigating to first chat","needsConfirmation":false}]

User: "open calculator and compute 25*47"
[{"action":"OPEN_CALCULATOR","parameters":{"calculation":"25*47"},"description":"Opening calculator and computing 25*47","needsConfirmation":false}]

Request: "${prompt}"
Response:`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1500,
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
        throw new Error("No response from AI - falling back to text parsing");
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
        // Fallback to enhanced text parsing
        return this.parseTextResponse(prompt);
      }
    } catch (error) {
      console.error(chalk.red("AI analysis failed:"), error.message);
      // Always fallback to enhanced text parsing
      return this.parseTextResponse(prompt);
    }
  }

  parseTextResponse(text) {
    const actions = [];
    const lowerText = text.toLowerCase();

    // Camera and photo operations
    if (
      lowerText.includes("camera") ||
      lowerText.includes("photo") ||
      lowerText.includes("picture") ||
      lowerText.includes("take a pic")
    ) {
      if (
        lowerText.includes("take") ||
        lowerText.includes("capture") ||
        lowerText.includes("snap")
      ) {
        actions.push({
          action: "TAKE_PHOTO",
          parameters: {},
          description: "Taking a photo with camera",
          needsConfirmation: false,
        });
      } else {
        actions.push({
          action: "OPEN_CAMERA",
          parameters: {},
          description: "Opening camera application",
          needsConfirmation: false,
        });
      }
    }

    // Screenshot
    if (
      lowerText.includes("screenshot") ||
      lowerText.includes("screen capture") ||
      lowerText.includes("capture screen")
    ) {
      actions.push({
        action: "TAKE_SCREENSHOT",
        parameters: {},
        description: "Taking screenshot",
        needsConfirmation: false,
      });
    }

    // WhatsApp operations
    if (lowerText.includes("whatsapp") || lowerText.includes("whats app")) {
      // Specific contact/chat
      const contactMatch =
        text.match(
          /whatsapp.+?(?:chat|message|talk|text).+?(?:with\s+)?(\w+)/i
        ) ||
        text.match(/(?:message|text|chat).+?(\w+).+?whatsapp/i) ||
        text.match(/whatsapp.+?(\w+)/i);

      if (contactMatch && contactMatch[1]) {
        const contact = contactMatch[1];
        if (contact.toLowerCase() !== "app") {
          actions.push({
            action: "OPEN_WHATSAPP_CHAT",
            parameters: { contact: contact },
            description: `Opening WhatsApp chat with ${contact}`,
            needsConfirmation: false,
          });
        }
      }
      // First chat
      else if (
        lowerText.includes("first chat") ||
        lowerText.includes("recent chat")
      ) {
        actions.push({
          action: "OPEN_WHATSAPP",
          parameters: { action: "first_chat" },
          description: "Opening WhatsApp and navigating to first chat",
          needsConfirmation: false,
        });
      }
      // Just open WhatsApp
      else {
        actions.push({
          action: "OPEN_WHATSAPP",
          parameters: {},
          description: "Opening WhatsApp application",
          needsConfirmation: false,
        });
      }
    }

    // Calculator operations
    if (
      lowerText.includes("calculator") ||
      lowerText.includes("calc") ||
      lowerText.includes("calculate")
    ) {
      const calcMatch = text.match(
        /(?:calculate|compute|calc).+?([0-9+\-*/\s().]+)/i
      );
      if (calcMatch) {
        actions.push({
          action: "OPEN_CALCULATOR",
          parameters: { calculation: calcMatch[1].trim() },
          description: `Opening calculator and computing: ${calcMatch[1].trim()}`,
          needsConfirmation: false,
        });
      } else {
        actions.push({
          action: "OPEN_CALCULATOR",
          parameters: {},
          description: "Opening calculator",
          needsConfirmation: false,
        });
      }
    }

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

    // Enhanced ChatGPT with context injection
    if (
      lowerText.includes("chatgpt") ||
      lowerText.includes("chat gpt") ||
      lowerText.includes("open gpt")
    ) {
      let query = "";
      const patterns = [
        /(?:chatgpt|chat gpt).+?(?:ask|about|help|explain|tell|how to|what is|learn|help with)\s+(.+)/i,
        /(?:ask|tell|explain).+?chatgpt.+?(?:about\s+)?(.+)/i,
        /chatgpt.+?["\']([^"\']+)["\']?/i,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          query = match[1].trim();
          break;
        }
      }

      actions.push({
        action: "OPEN_CHATGPT",
        parameters: { text: query },
        description: query
          ? `Opening ChatGPT with pre-filled text: "${query}"`
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

    // Generic application opening
    if (lowerText.includes("open ") && !actions.length) {
      const appMatch = text.match(/open\s+(\w+)/i);
      if (appMatch) {
        const appName = appMatch[1];
        actions.push({
          action: "OPEN_APPLICATION",
          parameters: { name: appName },
          description: `Opening ${appName} application`,
          needsConfirmation: false,
        });
      }
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
            description: `Could not understand: "${text}". Try being more specific about what application or action you want.`,
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
          await this.openChatGPT(
            action.parameters.text || action.parameters.query
          );
          break;

        case "OPEN_YOUTUBE":
          await this.openYouTube();
          break;

        case "TAKE_PHOTO":
          await this.takePhoto();
          break;

        case "OPEN_CAMERA":
          await this.openCamera();
          break;

        case "TAKE_SCREENSHOT":
          await this.takeScreenshot();
          break;

        case "OPEN_WHATSAPP":
          await this.openWhatsApp(action.parameters);
          break;

        case "OPEN_WHATSAPP_CHAT":
          await this.openWhatsAppChat(action.parameters.contact);
          break;

        case "OPEN_CALCULATOR":
          await this.openCalculator(action.parameters.calculation);
          break;

        case "OPEN_APPLICATION":
          await this.openApplication(action.parameters.name);
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

  // New advanced methods
  async takePhoto() {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      // Windows: Open camera app and trigger photo
      command = "start microsoft.windows.camera:";
      await execAsync(command);
      // Wait a moment then simulate spacebar to take photo
      setTimeout(async () => {
        await execAsync(
          "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(' ')\""
        );
      }, 2000);
    } else if (platform === "darwin") {
      // macOS: Use imagesnap or built-in camera
      command = 'open -a "Photo Booth"';
      await execAsync(command);
    } else {
      // Linux: Try cheese or other camera apps
      command = "cheese";
      await execAsync(command);
    }
  }

  async openCamera() {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      command = "start microsoft.windows.camera:";
    } else if (platform === "darwin") {
      command = 'open -a "Photo Booth"';
    } else {
      command = "cheese";
    }

    await execAsync(command);
  }

  async takeScreenshot() {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      // Windows: Use Snipping Tool or built-in screenshot
      command = "start ms-screenclip:";
    } else if (platform === "darwin") {
      // macOS: Use built-in screenshot
      command = "screencapture -i ~/Desktop/screenshot.png";
    } else {
      // Linux: Use gnome-screenshot
      command = "gnome-screenshot -i";
    }

    await execAsync(command);
  }

  async openWhatsApp(params = {}) {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      // Try WhatsApp desktop app first, then web
      try {
        command = "start whatsapp:";
        await execAsync(command);

        // If we need to open first chat
        if (params.action === "first_chat") {
          setTimeout(async () => {
            // Simulate Ctrl+1 to select first chat
            await execAsync(
              "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^1')\""
            );
          }, 2000);
        }
      } catch (error) {
        // Fallback to web WhatsApp
        command = 'start chrome "https://web.whatsapp.com/"';
        await execAsync(command);
      }
    } else if (platform === "darwin") {
      command = 'open -a "WhatsApp"';
      await execAsync(command);
    } else {
      // Linux: Open web WhatsApp
      command = 'xdg-open "https://web.whatsapp.com/"';
      await execAsync(command);
    }
  }

  async openWhatsAppChat(contact) {
    const platform = os.platform();

    // First open WhatsApp
    await this.openWhatsApp();

    // Wait for app to load, then search for contact
    setTimeout(async () => {
      if (platform === "win32") {
        // Search for contact
        await execAsync(
          "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^f')\""
        );
        setTimeout(async () => {
          await execAsync(
            `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${contact}')" && [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`
          );
        }, 500);
      }
    }, 3000);

    console.log(chalk.cyan(`📱 Searching for contact: ${contact}`));
  }

  async openCalculator(calculation) {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      command = "start calc";
    } else if (platform === "darwin") {
      command = "open -a Calculator";
    } else {
      command = "gnome-calculator";
    }

    await execAsync(command);

    if (calculation) {
      // Wait for calculator to open, then input calculation
      setTimeout(async () => {
        if (platform === "win32") {
          const calcCommands = calculation
            .replace(/\*/g, "{MULTIPLY}")
            .replace(/\//g, "{DIVIDE}");
          await execAsync(
            `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${calcCommands}{ENTER}')"`
          );
        }
      }, 1500);
      console.log(chalk.cyan(`🧮 Computing: ${calculation}`));
    }
  }

  async openApplication(appName) {
    const platform = os.platform();
    let command;

    if (platform === "win32") {
      // Try common Windows applications
      const windowsApps = {
        notepad: "notepad",
        paint: "mspaint",
        calculator: "calc",
        explorer: "explorer",
        edge: "msedge",
        firefox: "firefox",
        chrome: "chrome",
        spotify: "spotify",
        discord: "discord",
        steam: "steam",
        teams: "ms-teams:",
        outlook: "outlook",
      };

      command = `start ${windowsApps[appName.toLowerCase()] || appName}`;
    } else if (platform === "darwin") {
      command = `open -a "${appName}"`;
    } else {
      command = appName.toLowerCase();
    }

    await execAsync(command);
  }

  async openChatGPT(text = "") {
    const url = text
      ? `https://chat.openai.com/?q=${encodeURIComponent(text)}`
      : "https://chat.openai.com/";

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

    if (text) {
      console.log(chalk.cyan(`💬 ChatGPT will open with: "${text}"`));
      // Wait for page to load, then inject text into input field
      setTimeout(async () => {
        if (platform === "win32") {
          // Click on input area and paste text
          await execAsync(
            "powershell -Command \"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{TAB}{TAB}{TAB}')\""
          );
          setTimeout(async () => {
            await execAsync(
              `powershell -Command "Set-Clipboard '${text.replace(
                /'/g,
                "''"
              )}'; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`
            );
          }, 1000);
        }
      }, 4000);
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
      const apiKey = "AIzaSyAqAr-Tkg7Ft7iSmUyEFSLbn-smk1sPCnQ";

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
