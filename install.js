#!/usr/bin/env node

import chalk from "chalk";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log(chalk.cyan("🚀 Raze CLI - Quick Install & MCP Setup"));
console.log(
  chalk.gray("Installing dependencies and setting up MCP integration...\n")
);

try {
  // Check Node.js version
  console.log(chalk.yellow("📋 Checking requirements..."));
  const nodeVersion = process.version;
  console.log(chalk.green(`✅ Node.js version: ${nodeVersion}`));

  // Install dependencies
  console.log(chalk.yellow("📦 Installing dependencies..."));
  execSync("npm install", { stdio: "inherit" });
  console.log(chalk.green("✅ Dependencies installed"));

  // Test basic functionality
  console.log(chalk.yellow("🧪 Testing basic functionality..."));
  execSync("node index.js --help", { stdio: "pipe" });
  console.log(chalk.green("✅ Basic CLI functionality working"));

  // Test MCP functionality
  console.log(chalk.yellow("🔌 Testing MCP functionality..."));
  execSync("node index.js mcp --help", { stdio: "pipe" });
  console.log(chalk.green("✅ MCP functionality available"));

  console.log(chalk.green("\n🎉 Installation Complete!"));
  console.log(chalk.yellow("\n📝 Next Steps:"));
  console.log(
    chalk.gray("1. Run setup wizard: ") + chalk.cyan("node index.js setup")
  );
  console.log(
    chalk.gray("2. Or start MCP server: ") +
      chalk.cyan("node index.js mcp start")
  );
  console.log(
    chalk.gray("3. Configure your AI assistant (see MCP-USER-GUIDE.md)")
  );

  console.log(chalk.yellow("\n🎯 Quick Start:"));
  console.log(chalk.cyan("node index.js setup --ai claude --auto"));
} catch (error) {
  console.error(chalk.red("❌ Installation failed:"), error.message);
  console.log(chalk.yellow("\n🔧 Manual Installation:"));
  console.log(chalk.gray("1. npm install"));
  console.log(chalk.gray("2. node index.js --help"));
  console.log(chalk.gray("3. node index.js setup"));
}
