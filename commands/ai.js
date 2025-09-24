import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

export default function registerAi(program) {
  program
    .command("ai")
    .description("Query an AI model (Gemini). Reads GEMINI_API_KEY from env.")
    .argument("[prompt...]", "Prompt to send to the model")
    .option("--model <model>", "Model to use", "gemini-1.5-flash-latest")
    .action(async (promptParts, opts) => {
      const apiKey = process.env.GEMINI_API_KEY || "";
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
      const spinner = ora("AI is thinking...").start();
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
        console.log("\n" + chalk.cyan.bold("--- AI Response ---"));
        if (out) console.log(out);
        else {
          console.log(
            chalk.yellow("Could not parse response, showing raw JSON:")
          );
          console.log(JSON.stringify(data, null, 2));
        }
        console.log(chalk.cyan.bold("--- End Response ---"));
      } catch (err) {
        spinner.fail();
        console.error(chalk.red("AI request failed:"), err?.message || err);
        return;
      }
    });
}
