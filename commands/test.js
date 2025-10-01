import chalk from "chalk";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import ora from "ora";

const execAsync = promisify(exec);

export default function registerTest(program) {
  program
    .command("test")
    .description("Run tests for the current Web3 project")
    .option("--network <network>", "Network to run tests on", "hardhat")
    .option("--verbose", "Show verbose output")
    .option("--coverage", "Generate coverage report")
    .action(async (options) => {
      const { network, verbose, coverage } = options;

      console.log(chalk.cyan("🧪 Running tests..."));

      try {
        const projectType = detectProjectType();
        await runTests(projectType, { network, verbose, coverage });
        console.log(chalk.green("✅ All tests passed!"));
        process.exit(0);
      } catch (error) {
        console.error(chalk.red(`❌ Tests failed: ${error.message}`));
        process.exit(1);
      }
    });
}

function detectProjectType() {
  const cwd = process.cwd();

  if (
    fs.existsSync(path.join(cwd, "hardhat.config.js")) ||
    fs.existsSync(path.join(cwd, "hardhat.config.ts"))
  ) {
    return "hardhat";
  }

  if (fs.existsSync(path.join(cwd, "foundry.toml"))) {
    return "foundry";
  }

  if (fs.existsSync(path.join(cwd, "brownie-config.yaml"))) {
    return "brownie";
  }

  throw new Error(
    "No supported Web3 project detected. Please run this command in a Hardhat, Foundry, or Brownie project."
  );
}

async function runTests(projectType, options) {
  const { network, verbose, coverage } = options;
  let command;
  let spinner;

  switch (projectType) {
    case "hardhat":
      command = "npx hardhat test";
      if (network && network !== "hardhat") {
        command += ` --network ${network}`;
      }
      if (coverage) {
        command = "npx hardhat coverage";
      }
      break;

    case "foundry":
      command = "forge test";
      if (verbose) {
        command += " -vvv";
      }
      if (coverage) {
        command += " --coverage";
      }
      break;

    case "brownie":
      command = "brownie test";
      if (network && network !== "development") {
        command += ` --network ${network}`;
      }
      if (coverage) {
        command += " --coverage";
      }
      break;

    default:
      throw new Error(`Unsupported project type: ${projectType}`);
  }

  spinner = ora(`Running ${projectType} tests...`).start();

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    spinner.succeed(`${projectType} tests completed successfully!`);

    if (verbose || stderr) {
      console.log(chalk.gray("\n--- Test Output ---"));
      if (stdout) console.log(stdout);
      if (stderr) console.log(chalk.yellow(stderr));
    } else {
      // Show summary for non-verbose mode
      const lines = stdout.split("\n");
      const summaryLines = lines.filter(
        (line) =>
          line.includes("passing") ||
          line.includes("failing") ||
          line.includes("✓") ||
          line.includes("✗") ||
          line.includes("Test result:") ||
          line.includes("Ran ") ||
          line.includes("tests passed")
      );

      if (summaryLines.length > 0) {
        console.log(chalk.gray("\n--- Test Summary ---"));
        summaryLines.forEach((line) => console.log(line));
      }
    }
  } catch (error) {
    spinner.fail(`${projectType} tests failed!`);

    console.log(chalk.red("\n--- Error Output ---"));
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.log(chalk.red(error.stderr));

    throw new Error(
      `Test execution failed with exit code ${error.code || "unknown"}`
    );
  }
}
