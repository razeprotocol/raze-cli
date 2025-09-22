#!/usr/bin/env node

import { Command } from "commander";

// Initialize the main command program
const program = new Command();

program.name("my-cli").description("A small example CLI").version("0.1.0");

// greet command
program
  .command("greet")
  .description("Greet someone")
  .argument("[name]", "Name to greet", "world")
  .option("-t, --times <n>", "Number of times to greet", "1")
  .action((name, options) => {
    const times = Math.max(1, parseInt(options.times, 10) || 1);
    for (let i = 0; i < times; i++) {
      console.log(`Hello, ${name}!`);
    }
  });

// sum command -- adds numbers
program
  .command("sum")
  .description("Sum a list of numbers")
  .argument("<numbers...>", "Numbers to sum")
  .action((numbers: string[]) => {
    const nums = numbers.map((n) => parseFloat(n));
    if (nums.some((n) => Number.isNaN(n))) {
      console.error("Please provide only numbers.");
      process.exitCode = 2;
      return;
    }
    const total = nums.reduce((a, b) => a + b, 0);
    console.log(`Sum: ${total}`);
  });

program.parse(process.argv);
