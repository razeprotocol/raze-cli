import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";

// CLI command registration
export default function registerAi(program) {
  program
    .command("ai")
    .description("Query an AI model (Gemini). Reads GEMINI_API_KEY from env.")
    .argument("[prompt...]", "Prompt to send to the model")
    .option("--model <model>", "Model to use", "gemini-1.5-flash-latest")
    .option(
      "--auto",
      "Automatically perform interpreted file actions without confirmation"
    )
    .option("--force", "Force destructive actions where applicable")
    .action(async (promptParts, opts) => {
      const apiKey = "AIzaSyCadIp6D7oWiF9k8-rrgZ8DiPcohA0F-pA";
      if (!apiKey) {
        console.error(
          chalk.red(
            "GEMINI_API_KEY is not set. Set GEMINI_API_KEY environment variable."
          )
        );
        return;
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${apiKey}`;
      let prompt =
        promptParts && promptParts.length ? promptParts.join(" ") : undefined;
      if (!prompt) {
        const answers = await inquirer.prompt([
          { name: "q", message: "Enter prompt:" },
        ]);
        prompt = answers.q;
      }
      if (!prompt) {
        console.error(chalk.red("No prompt provided."));
        return;
      }
      if (typeof fetch !== "function") {
        console.error(
          chalk.red(
            "Global fetch() is not available in your Node runtime. Use Node 18+ or add a fetch polyfill."
          )
        );
        return;
      }

      // Enhance the prompt to make AI understand it should provide actionable commands
      const enhancedPrompt = `${prompt}

You are an expert developer assistant with access to current web knowledge. If the user asks about creating projects, installing tools, or working with ANY technology (Next.js, Vite, Vue, Rust, Python, Go, Flutter, etc.), please:

1. Use your knowledge to determine the correct commands and setup steps
2. For ANY technology setup request, respond with a JSON object containing actions to perform

JSON Format for development tasks:
{
  "actions": [
    {"action": "mkdir", "target": "folder_name", "recursive": true},
    {"action": "touch", "target": "file_name"},
    {"action": "rm", "target": "target_name", "recursive": false},
    {"action": "run_command", "command": "npx create-vite@latest my-app", "cwd": "."},
    {"action": "run_command", "command": "cd my-app && npm install", "cwd": "."},
    {"action": "open_vscode", "path": "./my-app"},
    {"action": "run_command", "command": "npm run dev", "cwd": "./my-app", "background": true}
  ]
}

Available actions:
- mkdir: Create folders (use "target" property)
- touch: Create files (use "target" property)  
- rm: Remove files/folders (use "target" property)
- run_command: Execute ANY shell command (npm, cargo, pip, go, flutter, etc.)
  - Properties: command (required), cwd (optional), background (optional)
- open_vscode: Open VS Code in directory (use "path" property)

IMPORTANT: Use "target" for mkdir/touch/rm actions, use "path" for open_vscode action.

For ANY technology request:
- Rust project: Use "cargo new", "cargo run", etc.
- Python: Use "pip install", "python -m venv", etc.  
- Go: Use "go mod init", "go run", etc.
- Flutter: Use "flutter create", "flutter run", etc.
- ANY other tech: Provide the specific commands for that technology

Examples:
- "create a rust project" → cargo new commands
- "setup python virtual environment" → python -m venv commands  
- "create flutter app" → flutter create commands
- "setup go project with modules" → go mod commands

Always provide the complete workflow from project creation to running, including opening VS Code if requested.
Only respond with JSON for development/tech requests, otherwise respond normally.`;

      const spinner = ora("AI is thinking...").start();
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: enhancedPrompt }] }],
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          spinner.fail();
          console.error(
            chalk.red(`AI request failed (${res.status}): ${errText}`)
          );
          return;
        }

        const data = await res.json();
        spinner.succeed(chalk.green("AI responded!"));
        const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (out) console.log(out);
        else {
          console.log(
            chalk.yellow("Could not parse response, showing raw JSON:")
          );
          console.log(JSON.stringify(data, null, 2));
        }

        // Prefer structured JSON from the AI when available
        const parsedJSON = tryExtractJSON(out || "");
        let intents = [];
        if (parsedJSON) {
          if (Array.isArray(parsedJSON.actions)) intents = parsedJSON.actions;
          else if (parsedJSON.action) intents = [parsedJSON];
        }

        // Fall back to heuristics if no JSON
        if (intents.length === 0) {
          const maybe = interpretFileIntent(
            (prompt || "") + "\n" + (out || "")
          );
          if (maybe) {
            if (Array.isArray(maybe)) intents = maybe;
            else intents = [maybe];
          }
        }

        if (intents.length > 0) {
          for (const intent of intents) {
            console.log(
              chalk.cyan("Interpreted action:"),
              intent.action,
              intent.target,
              intent.recursive ? "(recursive)" : ""
            );
          }

          let proceed = !!opts.auto;
          if (!proceed) {
            const answers = await inquirer.prompt([
              {
                type: "confirm",
                name: "ok",
                message: `Execute ${intents.length} action(s)?`,
                default: false,
              },
            ]);
            proceed = answers.ok;
          }
          if (proceed) {
            for (const intent of intents) {
              try {
                await executeIntent(intent, { force: !!opts.force });
                console.log(
                  chalk.green(`Action '${intent.action}' completed.`)
                );
              } catch (err) {
                console.error(
                  chalk.red(`Action '${intent.action}' failed:`),
                  err?.message || err
                );
              }
            }
          } else {
            console.log(chalk.yellow("Action(s) cancelled."));
          }
        }
      } catch (err) {
        spinner.fail();
        console.error(chalk.red("AI request failed:"), err?.message || err);
        return;
      }
    });
}

// Enhanced heuristic parser for natural language and technology requests
function interpretFileIntent(text) {
  if (!text) return null;

  // Handle technology project creation requests
  const techProjectMatch = text.match(
    /(?:create|setup|make|build|start)\s+(?:a\s+)?(?:new\s+)?(rust|python|go|flutter|vue|react|nextjs|next\.js|vite|svelte|angular|django|fastapi|express|node\.?js|deno|bun)\s+(?:project|app|application)/i
  );
  if (techProjectMatch) {
    const tech = techProjectMatch[1].toLowerCase();
    const projectName = "my-project";

    switch (tech) {
      case "rust":
        return [
          { action: "run_command", command: `cargo new ${projectName}` },
          { action: "open_vscode", path: `./${projectName}` },
          {
            action: "run_command",
            command: "cargo run",
            cwd: `./${projectName}`,
          },
        ];
      case "python":
        return [
          { action: "mkdir", target: projectName, recursive: true },
          {
            action: "run_command",
            command: "python -m venv venv",
            cwd: `./${projectName}`,
          },
          { action: "touch", target: `${projectName}/main.py` },
          { action: "open_vscode", path: `./${projectName}` },
        ];
      case "go":
        return [
          { action: "mkdir", target: projectName, recursive: true },
          {
            action: "run_command",
            command: `go mod init ${projectName}`,
            cwd: `./${projectName}`,
          },
          { action: "touch", target: `${projectName}/main.go` },
          { action: "open_vscode", path: `./${projectName}` },
        ];
      case "flutter":
        return [
          { action: "run_command", command: `flutter create ${projectName}` },
          { action: "open_vscode", path: `./${projectName}` },
          {
            action: "run_command",
            command: "flutter run",
            cwd: `./${projectName}`,
            background: true,
          },
        ];
      case "nextjs":
      case "next.js":
        return [
          {
            action: "run_command",
            command: `npx create-next-app@latest ${projectName} --typescript`,
          },
          { action: "open_vscode", path: `./${projectName}` },
          {
            action: "run_command",
            command: "npm run dev",
            cwd: `./${projectName}`,
            background: true,
          },
        ];
      case "vite":
        return [
          {
            action: "run_command",
            command: `npm create vite@latest ${projectName}`,
          },
          {
            action: "run_command",
            command: "npm install",
            cwd: `./${projectName}`,
          },
          { action: "open_vscode", path: `./${projectName}` },
          {
            action: "run_command",
            command: "npm run dev",
            cwd: `./${projectName}`,
            background: true,
          },
        ];
      case "vue":
        return [
          {
            action: "run_command",
            command: `npm create vue@latest ${projectName}`,
          },
          {
            action: "run_command",
            command: "npm install",
            cwd: `./${projectName}`,
          },
          { action: "open_vscode", path: `./${projectName}` },
        ];
      default:
        return [
          {
            action: "run_command",
            command: `echo "Creating ${tech} project..."`,
          },
        ];
    }
  }

  // Handle package installation requests
  const installMatch = text.match(
    /install\s+(node_modules|dependencies|packages|npm\s+packages)/i
  );
  if (installMatch) {
    return [{ action: "run_command", command: "npm install" }];
  }

  // Handle numbered creation: "create 4 folders", "make 3 files"
  const numberedMatch = text.match(
    /(?:create|make)\s+(\d+)\s+(folders?|files?)/i
  );
  if (numberedMatch) {
    const count = parseInt(numberedMatch[1]);
    const type = numberedMatch[2].toLowerCase().includes("file")
      ? "touch"
      : "mkdir";
    const actions = [];
    for (let i = 1; i <= count; i++) {
      actions.push({
        action: type,
        target: type === "mkdir" ? `folder${i}` : `file${i}.txt`,
        recursive: true,
      });
    }
    return actions;
  }

  // Handle specific names: "create folders test1, test2, test3"
  const namedMultiMatch = text.match(
    /(?:create|make)\s+(?:folders?|files?)\s+(.+)/i
  );
  if (namedMultiMatch) {
    const namesText = namedMultiMatch[1];
    const names = namesText
      .split(/\s*,\s*|\s+and\s+/)
      .map((n) => normalizeTarget(n));
    const type = text.toLowerCase().includes("file") ? "touch" : "mkdir";

    const actions = [];
    for (const name of names) {
      if (name && name.trim()) {
        actions.push({
          action: type,
          target: name.trim(),
          recursive: true,
        });
      }
    }
    return actions.length > 0 ? actions : null;
  }

  // Handle folder structure requests: "create folder structure", "make project structure"
  if (text.match(/(?:create|make).+(?:folder|project)\s+structure/i)) {
    return [
      { action: "mkdir", target: "src", recursive: true },
      { action: "mkdir", target: "docs", recursive: true },
      { action: "mkdir", target: "tests", recursive: true },
      { action: "touch", target: "README.md" },
      { action: "touch", target: "src/index.js" },
    ];
  }

  // Fallback patterns for single items
  const patterns = [
    {
      re: /create (?:a )?(?:folder|directory)\s+(?:called |named )?['"]?(.+?)['"]?(?=\s|$)/i,
      action: "mkdir",
      recursive: true,
    },
    {
      re: /make (?:a )?(?:folder|directory)\s+(?:called |named )?['"]?(.+?)['"]?(?=\s|$)/i,
      action: "mkdir",
      recursive: true,
    },
    {
      re: /create (?:a )?file\s+(?:called |named )?['"]?(.+?)['"]?(?=\s|$)/i,
      action: "touch",
    },
    { re: /touch\s+['"]?(.+?)['"]?(?=\s|$)/i, action: "touch" },
    {
      re: /delete (?:the )?(?:file|folder|directory|dir)\s+(?:called |named )?['"]?(.+?)['"]?(?=\s|$)/i,
      action: "rm",
      recursive: false,
    },
    {
      re: /remove (?:the )?(?:file|folder|directory)\s+(?:called |named )?['"]?(.+?)['"]?(?=\s|$)/i,
      action: "rm",
      recursive: false,
    },
    {
      re: /delete (?:recursively|recursively delete)\s+['"]?(.+?)['"]?(?=\s|$)/i,
      action: "rm",
      recursive: true,
    },
    {
      re: /(?:delete|remove)\s+['"]?(.+?)['"]?(?=\s|$)/i,
      action: "rm",
      recursive: false,
    },
  ];

  for (const p of patterns) {
    const m = text.match(p.re);
    if (m) {
      const raw = m[1].trim();
      const target = normalizeTarget(raw);
      return { action: p.action, target, recursive: !!p.recursive };
    }
  }
  return null;
}

function normalizeTarget(raw) {
  if (!raw) return raw;
  return raw.replace(/["'`.,;:!]+$/g, "").trim();
}

function tryExtractJSON(text) {
  if (!text) return null;
  const codeBlockMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
  let candidate = null;
  if (codeBlockMatch) candidate = codeBlockMatch[1];
  else {
    const start = text.indexOf("{");
    if (start >= 0) {
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") depth--;
        if (depth === 0) {
          candidate = text.slice(start, i + 1);
          break;
        }
      }
    }
  }
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch (e) {
    return null;
  }
}

async function executeIntent(intent, opts = { force: false }) {
  if (!intent || !intent.action) throw new Error("Invalid intent");

  // Normalize property names - handle both old format (target) and new format (path)
  const target = intent.target || intent.path;

  if (intent.action === "mkdir") {
    const t = path.resolve(target || ".");
    fs.mkdirSync(t, { recursive: true });
    return;
  }

  if (intent.action === "touch") {
    const t = path.resolve(target || ".");
    try {
      const time = new Date();
      fs.utimesSync(t, time, time);
    } catch (e) {
      fs.closeSync(fs.openSync(t, "w"));
    }
    return;
  }

  if (intent.action === "rm") {
    const t = path.resolve(target || ".");
    if (!fs.existsSync(t)) {
      if (opts.force) return;
      throw new Error("Target does not exist: " + t);
    }
    const s = fs.statSync(t);
    if (s.isDirectory()) {
      if (!intent.recursive)
        throw new Error("Refusing to remove directory without recursive flag");
      fs.rmSync(t, { recursive: true, force: !!opts.force });
      return;
    }
    fs.unlinkSync(t);
    return;
  }
  if (intent.action === "run_command") {
    const { spawn } = await import("child_process");
    const cwd = intent.cwd ? path.resolve(intent.cwd) : process.cwd();

    console.log(chalk.cyan(`Running: ${intent.command} in ${cwd}`));

    return new Promise((resolve, reject) => {
      const parts = intent.command.split(" ");
      const cmd = parts[0];
      const args = parts.slice(1);

      const child = spawn(cmd, args, {
        cwd,
        stdio: intent.background ? "pipe" : "inherit",
        shell: true,
      });

      if (intent.background) {
        console.log(
          chalk.yellow(`Started background process with PID: ${child.pid}`)
        );
        resolve();
        return;
      }

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on("error", reject);
    });
  }

  if (intent.action === "create_project") {
    const { spawn } = await import("child_process");
    let command = "";
    const projectName = intent.name || "my-project";

    // Map common project types to their creation commands
    switch (intent.type?.toLowerCase()) {
      case "nextjs":
      case "next":
        command = `npx create-next-app@latest ${projectName}${
          intent.typescript ? " --typescript" : ""
        }`;
        break;
      case "vite":
        command = `npm create vite@latest ${projectName}${
          intent.template ? " -- --template " + intent.template : ""
        }`;
        break;
      case "vue":
        command = `npm create vue@latest ${projectName}`;
        break;
      case "react":
        command = `npx create-react-app ${projectName}${
          intent.typescript ? " --template typescript" : ""
        }`;
        break;
      case "node":
      case "nodejs":
        command = `mkdir ${projectName} && cd ${projectName} && npm init -y`;
        break;
      default:
        // For unknown types, let the AI figure out the command
        throw new Error(
          `Unknown project type: ${intent.type}. The AI should provide the specific command.`
        );
    }

    console.log(chalk.cyan(`Creating ${intent.type} project: ${command}`));

    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        stdio: "inherit",
        shell: true,
        cwd: process.cwd(),
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Project creation failed with exit code ${code}`));
        }
      });

      child.on("error", reject);
    });
  }

  if (intent.action === "open_vscode") {
    const { spawn } = await import("child_process");
    const targetPath = intent.path ? path.resolve(intent.path) : process.cwd();

    console.log(chalk.cyan(`Opening VS Code at: ${targetPath}`));

    return new Promise((resolve, reject) => {
      const child = spawn("code", [targetPath], {
        stdio: "pipe",
        shell: true,
      });

      child.on("close", () => resolve());
      child.on("error", (err) => {
        if (err.code === "ENOENT") {
          console.log(
            chalk.yellow(
              'VS Code not found in PATH. Make sure VS Code is installed and "code" command is available.'
            )
          );
        }
        reject(err);
      });
    });
  }

  if (intent.action === "install_deps") {
    const { spawn } = await import("child_process");
    const cwd = intent.cwd ? path.resolve(intent.cwd) : process.cwd();
    const manager = intent.manager || "npm";
    const packages = intent.packages || [];

    let command = "";
    if (packages.length > 0) {
      command = `${manager} install ${packages.join(" ")}`;
    } else {
      command = `${manager} install`;
    }

    console.log(chalk.cyan(`Installing dependencies: ${command} in ${cwd}`));

    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        cwd,
        stdio: "inherit",
        shell: true,
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`Dependency installation failed with exit code ${code}`)
          );
        }
      });

      child.on("error", reject);
    });
  }

  throw new Error("Unknown intent action: " + intent.action);
}
