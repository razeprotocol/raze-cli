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

If this request involves file/folder operations, please respond with a JSON object containing the actions to perform. Format:
{
  "actions": [
    {"action": "mkdir", "target": "folder_name", "recursive": true},
    {"action": "touch", "target": "file_name"},
    {"action": "rm", "target": "target_name", "recursive": false}
  ]
}

Available actions: mkdir (create folders), touch (create files), rm (remove files/folders)
If you need to create multiple items, include multiple action objects.
Only respond with JSON if the request is about file operations, otherwise respond normally.`;

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

// Enhanced heuristic parser for natural language
function interpretFileIntent(text) {
  if (!text) return null;

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
  const t = path.resolve(intent.target || ".");
  if (intent.action === "mkdir") {
    fs.mkdirSync(t, { recursive: true });
    return;
  }
  if (intent.action === "touch") {
    try {
      const time = new Date();
      fs.utimesSync(t, time, time);
    } catch (e) {
      fs.closeSync(fs.openSync(t, "w"));
    }
    return;
  }
  if (intent.action === "rm") {
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
  throw new Error("Unknown intent action: " + intent.action);
}
