import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

// Register the `ai` command for natural-language coding over the local MCP stub
export default function registerAi(program) {
  program
    .command("ai")
    .description("Natural-language coding assistant over local MCP stub")
    .argument("[prompt...]", "One-shot prompt (if omitted, enters chat mode)")
    .option(
      "--provider <p>",
      "LLM provider: openai|gemini",
      process.env.OPENAI_API_KEY ? "openai" : "gemini"
    )
    .option(
      "--model <m>",
      "Model id",
      process.env.OPENAI_API_KEY ? "gpt-4o-mini" : "gemini-2.5-flash"
    )
    .option("--port <port>", "MCP HTTP port", "5005")
    .option("--auto", "Apply changes without confirmation")
    .option("--dry-run", "Plan only; do not write files")
    .action(async (promptParts, opts) => {
      const state = { lastFile: null };
      const cfg = {
        provider: opts.provider,
        model: opts.model,
        port: parseInt(opts.port, 10) || 5005,
        auto: !!opts.auto,
        dryRun: !!opts["dry-run"],
      };

      // Optional: fast preflight to help users when MCP isn't running
      await ensureMcpHealthy(cfg.port);

      const oneShot = promptParts && promptParts.length ? promptParts.join(" ") : null;
      if (oneShot) {
        await handleTurn(oneShot, cfg, state);
        return;
      }

      console.log(chalk.cyan("💬 AI coding chat. Type 'exit' to quit."));
      while (true) {
        const { q } = await inquirer.prompt([{ name: "q", message: ">" }]);
        if (!q || q.trim().toLowerCase() === "exit") break;
        await handleTurn(q, cfg, state);
      }
    });
}

async function handleTurn(userPrompt, cfg, state) {
  const spinner = ora("Thinking...").start();
  try {
    // Optionally include last file content to enable follow-up edits
    let context = "";
    if (state.lastFile) {
      const f = await mcpRead(state.lastFile, cfg.port);
      if (f?.content) {
        const snippet = f.content.substring(0, 6000);
        context = `\nCurrent file (${state.lastFile}) content (truncated):\n${snippet}`;
      }
    }

    const system = `You are a coding assistant. Always reply ONLY with JSON using this schema:
{
  "actions": [
    {"action":"write_file","path":"./index.html","content":"<html>...</html>"},
    {"action":"edit_file","path":"./index.html","find":"<button>","replace":"<button style=\\"background: blue;\\">"},
    {"action":"read_file","path":"./index.html"},
    {"action":"list_directory","path":"."}
  ],
  "primaryFile":"./index.html"
}
Rules: 1) Use relative paths. 2) Prefer edit_file for small changes. 3) For generic HTML requests, target ./index.html. 4) Do NOT include explanations.`;

    const fullPrompt = `${system}\n\nUser: ${userPrompt}${context}`;
    const llm = await callLLM(cfg.provider, cfg.model, fullPrompt);
    spinner.succeed("AI responded");

    const plan = tryExtractJSON(llm || "");
    if (!plan || !plan.actions) {
      console.log(chalk.yellow("AI didn't return a valid plan. Raw output:"));
      console.log(llm);
      return;
    }

    // Preview
    console.log(chalk.gray("Plan:"));
    plan.actions.forEach((a, i) =>
      console.log(chalk.gray(`${i + 1}. ${a.action} ${a.path ?? ""}`))
    );

    let proceed = cfg.auto || cfg.dryRun;
    if (!proceed) {
      const { ok } = await inquirer.prompt([
        { type: "confirm", name: "ok", message: `Apply ${plan.actions.length} change(s)?`, default: true },
      ]);
      proceed = ok;
    }
    if (!proceed) return;

    // Ensure MCP is available before applying file changes
    const healthy = await ensureMcpHealthy(cfg.port);
    if (!healthy) {
      console.log(
        chalk.red(
          `MCP server is not responding on http://localhost:${cfg.port}. Start it with: \n  raze mcp run-stub --port ${cfg.port}`
        )
      );
      return;
    }

    for (const a of plan.actions) {
      if (cfg.dryRun) continue;
      if (a.action === "write_file") {
        await mcpWrite(a.path, a.content ?? "", cfg.port);
        state.lastFile = a.path;
      } else if (a.action === "edit_file") {
        const cur = await mcpRead(a.path, cfg.port);
        const before = cur?.content ?? "";
        const after = applyEdit(before, a.find, a.replace);
        await mcpWrite(a.path, after, cfg.port);
        state.lastFile = a.path;
      } else if (a.action === "read_file") {
        const r = await mcpRead(a.path, cfg.port);
        if (r?.content) console.log(chalk.gray(r.content.substring(0, 2000)));
        state.lastFile = a.path;
      } else if (a.action === "list_directory") {
        const r = await mcpList(a.path || ".", cfg.port);
        console.log(r);
      }
    }
    if (plan.primaryFile) state.lastFile = plan.primaryFile;
    if (state.lastFile) console.log(chalk.cyan(`Active file: ${state.lastFile}`));
  } catch (e) {
    spinner.fail("Failed");
    console.error(chalk.red(e?.message || String(e)));
    // Helpful hint if MCP is likely down
    try {
      const ok = await isMcpHealthy(cfg.port);
      if (!ok) {
        console.log(
          chalk.yellow(
            `Hint: MCP may not be running on port ${cfg.port}. Start it via:\n  raze mcp run-stub --port ${cfg.port}\nOr run directly:\n  node mcp-server.js --port ${cfg.port}`
          )
        );
      }
    } catch {}
  }
}

function applyEdit(text, find, replace) {
  if (!find) return text;
  try {
    const m = String(find).match(/^\/(.*)\/(\w*)$/);
    if (m) {
      const re = new RegExp(m[1], m[2]);
      return text.replace(re, replace ?? "");
    }
  } catch {}
  return text.replace(find, replace ?? "");
}

async function callLLM(provider, model, prompt) {
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY not set");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You only reply with JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return j.choices?.[0]?.message?.content;
  } else {
    const key = "AIzaSyAqAr-Tkg7Ft7iSmUyEFSLbn-smk1sPCnQ";
    if (!key) throw new Error("GEMINI_API_KEY not set");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!r.ok) throw new Error(`Gemini error ${r.status}: ${await r.text()}`);
    const j = await r.json();
    return j?.candidates?.[0]?.content?.parts?.[0]?.text;
  }
}

async function mcpRead(p, port) {
  const res = await fetch(`http://localhost:${port}/read_file?path=${encodeURIComponent(p)}`);
  return res.ok ? res.json() : null;
}
async function mcpWrite(p, content, port) {
  const res = await fetch(`http://localhost:${port}/write_file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: p, content }),
  });
  if (!res.ok) throw new Error(`write_file failed: ${await res.text()}`);
  return res.json();
}
async function mcpList(p, port) {
  const res = await fetch(`http://localhost:${port}/list_directory?path=${encodeURIComponent(p)}`);
  return res.ok ? res.json() : null;
}

function tryExtractJSON(text) {
  if (!text) return null;
  const codeBlock = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
  let candidate = codeBlock ? codeBlock[1] : null;
  if (!candidate) {
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
  } catch {
    return null;
  }
}

// --- MCP health helpers ---
async function isMcpHealthy(port) {
  try {
    const r = await fetch(`http://localhost:${port}/health`);
    if (!r.ok) return false;
    const j = await r.json();
    return j?.status === "ok";
  } catch {
    return false;
  }
}

async function ensureMcpHealthy(port) {
  if (await isMcpHealthy(port)) return true;
  // Try to start the local stub in the background if available
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const serverPath = path.resolve(__dirname, "../mcp-server.js");
    if (fs.existsSync(serverPath)) {
      const child = spawn(process.execPath, [serverPath, "--port", String(port)], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      // Wait briefly for the server to come up
      const start = Date.now();
      while (Date.now() - start < 5000) {
        if (await isMcpHealthy(port)) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  } catch {
    // ignore and fall through
  }
  return await isMcpHealthy(port);
}
