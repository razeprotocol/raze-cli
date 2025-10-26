import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

export default function registerFrontend(program) {
  program
    .command("frontend")
    .description("Build and deploy frontend to IPFS (html, react, vite, next)")
    .option("--type <t>", "Frontend type: html|react|vite|next", "html")
    .option("--dir <d>", "Project directory", ".")
    .option("--port <p>", "Dev server port (for optional build), not used by all types", "3000")
  .option("--yes", "Skip prompts and proceed")
  .option("--pinata", "Force using Pinata for upload (requires PINATA_API_KEY and PINATA_API_SECRET)")
    .action(async (opts) => {
      const type = (opts.type || "html").toLowerCase();
      const projectDir = path.resolve(opts.dir || ".");

      console.log(chalk.cyan(`📦 Frontend build & IPFS deploy — type: ${type}`));

      if (!fs.existsSync(projectDir)) {
        console.error(chalk.red(`Project directory not found: ${projectDir}`));
        return;
      }

      // Determine build steps and output directory
      let buildCmd = null;
      let outputDir = null;

      switch (type) {
        case "html":
          // For plain HTML/CSS, we assume files are in the projectDir root
          outputDir = path.join(projectDir, "dist");
          break;
        case "react":
          buildCmd = "npm run build"; // CRA build -> build/
          outputDir = path.join(projectDir, "build");
          break;
        case "vite":
          buildCmd = "npm run build"; // vite build -> dist/
          outputDir = path.join(projectDir, "dist");
          break;
        case "next":
          // We'll run next build then export
          buildCmd = "npx next build && npx next export -o out";
          outputDir = path.join(projectDir, "out");
          break;
        default:
          console.error(chalk.red(`Unknown frontend type: ${type}`));
          return;
      }

      try {
        // For html type, prepare dist by copying index.html and css
        if (type === "html") {
          const spinner = ora("Preparing dist for plain HTML").start();
          try {
            if (fs.existsSync(outputDir)) {
              fs.rmSync(outputDir, { recursive: true, force: true });
            }
            fs.mkdirSync(outputDir, { recursive: true });

            // Copy common files
            const filesToCopy = ["index.html", "index.htm", "style.css", "css", "assets"];
            let copied = 0;
            for (const name of filesToCopy) {
              const src = path.join(projectDir, name);
              if (fs.existsSync(src)) {
                const dest = path.join(outputDir, name);
                const stat = fs.statSync(src);
                if (stat.isDirectory()) {
                  copyRecursiveSync(src, dest);
                } else {
                  fs.copyFileSync(src, dest);
                }
                copied++;
              }
            }
            spinner.succeed(`Prepared dist (${copied} items copied)`);
          } catch (e) {
            spinner.fail("Failed to prepare dist");
            throw e;
          }
        } else {
          // For other types, run build command
          console.log(chalk.gray(`Running build command: ${buildCmd}`));
          const spinner = ora("Building project...").start();
          try {
            await execAsync(buildCmd, { cwd: projectDir, env: process.env, timeout: 10 * 60 * 1000 });
            spinner.succeed("Build finished");
          } catch (e) {
            spinner.fail("Build failed");
            console.error(chalk.red(e.stderr || e.message));
            return;
          }
        }

        if (!fs.existsSync(outputDir)) {
          console.error(chalk.red(`Build output not found: ${outputDir}`));
          return;
        }

        // Upload using official web3.storage client (uploads directory so CID maps to site root)
        const WEB3_STORAGE_EMAIL = process.env.WEB3_STORAGE_EMAIL || "tuhin.thakur1233@gmail.com";
        const web3Key = "z6MkoRdZVkp6iakewSAq1rL26iCiStVxDfm39DAv7tGdB1qy";
  let cid = null;
        if (web3Key) {
          if (!process.env.WEB3_STORAGE_API_KEY && process.env.WEB3_STORAGE_TOKEN == null) {
            console.log(chalk.yellow(`Using bundled Web3.Storage credentials for ${WEB3_STORAGE_EMAIL}`));
          }
          const upSpinner = ora("Uploading directory to web3.storage (this may take a moment)...").start();
          try {
            // dynamic import so module is only required when used
            const { Web3Storage, getFilesFromPath } = await import('web3.storage');
            const client = new Web3Storage({ token: web3Key });
            const files = await getFilesFromPath(outputDir);
            cid = await client.put(files, { wrapWithDirectory: true });
            upSpinner.succeed(`Uploaded to web3.storage (cid: ${cid})`);
          } catch (e) {
            upSpinner.fail("web3.storage client upload failed");
            console.error(chalk.red(e.stderr || e.message || e));
          }
        }

        // If web3.storage upload didn't produce a CID, fall back to local ipfs CLI
        let tarPath = null;
        if (!cid) {
          // Package output dir into a tar.gz as fallback
          const ts = Date.now();
          tarPath = path.join(projectDir, `.raze_dist_${ts}.tar.gz`);
          const tarCmd = `tar -czf ${escapeShellArg(tarPath)} -C ${escapeShellArg(outputDir)} .`;
          const packSpinner = ora("Packaging build output for fallback...").start();
          try {
            await execAsync(tarCmd);
            packSpinner.succeed("Packaged to tar.gz");
          } catch (e) {
            packSpinner.fail("Failed to package build output");
            throw e;
          }

          // Try local ipfs CLI
          try {
            const ipfsCheck = await execAsync("ipfs --version");
            const ipfsSpinner = ora("Uploading via local ipfs daemon...").start();
            try {
              // Add recursively and print only the last hash
              const { stdout } = await execAsync(`ipfs add -r -Q ${escapeShellArg(outputDir)}`, { cwd: projectDir, timeout: 120000 });
              // ipfs add -r -Q may print multiple lines; take last non-empty
              const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
              cid = lines[lines.length - 1];
              ipfsSpinner.succeed(`Uploaded to local IPFS daemon (cid: ${cid})`);
            } catch (e) {
              ipfsSpinner.fail("Local ipfs upload failed");
              console.error(chalk.red(e.stderr || e.message || e));
            }
          } catch {
            // ipfs CLI not available
          }
  }

        // If still no CID, attempt Pinata (forced or available). Upload the DIRECTORY so gateways render index.html.
        if (!cid) {
          const pinataKey = process.env.PINATA_API_KEY || "5b5c7a0d3664e0406d09";
          const pinataSecret = process.env.PINATA_API_SECRET || "eabc04a9bab6d459d654e7eb829cd4a8860db10d3584f4690d98c0d71946291f";
          if (opts.pinata || (pinataKey && pinataSecret)) {
            if (!process.env.PINATA_API_KEY || !process.env.PINATA_API_SECRET) {
              console.log(chalk.yellow("Using bundled Pinata credentials"));
            }
            const pinSpinner = ora("Uploading build directory to Pinata...").start();
            try {
              // Prefer official SDK which supports recursive folder upload
              const pinataSDK = (await import('@pinata/sdk')).default;
              const pinata = new pinataSDK({ pinataApiKey: pinataKey, pinataSecretApiKey: pinataSecret });
              const name = `raze-frontend-${path.basename(projectDir)}-${Date.now()}`;
              const res = await pinata.pinFromFS(outputDir, {
                pinataMetadata: { name },
                pinataOptions: { cidVersion: 1 }
              });
              if (res && (res.IpfsHash || res.Hash || res.cid)) {
                cid = res.IpfsHash || res.Hash || res.cid;
                pinSpinner.succeed(`Uploaded folder to Pinata (cid: ${cid})`);
              } else {
                // As a last resort, attempt cURL multipart for the directory (wrapWithDirectory)
                pinSpinner.text = 'SDK response missing CID; falling back to multipart upload...';
                const formFlags = buildPinataCurlFormFlags(outputDir);
                const curlCmd = `curl -s -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" -H "pinata_api_key: ${pinataKey}" -H "pinata_secret_api_key: ${pinataSecret}" ${formFlags} -F 'pinataOptions={"wrapWithDirectory":true,"cidVersion":1}'`;
                const { stdout } = await execAsync(curlCmd, { cwd: projectDir, timeout: 300000 });
                const j = JSON.parse(stdout);
                if (j && j.IpfsHash) {
                  cid = j.IpfsHash;
                  pinSpinner.succeed(`Uploaded folder to Pinata (cid: ${cid})`);
                } else {
                  pinSpinner.fail('Pinata directory upload failed');
                  console.error(chalk.gray(JSON.stringify(j)));
                }
              }
            } catch (e) {
              // If SDK not installed or fails, try curl-based directory upload
              try {
                const fallbackSpinner = ora("Pinata SDK not available; using cURL multipart upload...").start();
                const formFlags = buildPinataCurlFormFlags(outputDir);
                const curlCmd = `curl -s -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" -H "pinata_api_key: ${pinataKey}" -H "pinata_secret_api_key: ${pinataSecret}" ${formFlags} -F 'pinataOptions={"wrapWithDirectory":true,"cidVersion":1}'`;
                const { stdout } = await execAsync(curlCmd, { cwd: projectDir, timeout: 300000 });
                const j = JSON.parse(stdout);
                if (j && j.IpfsHash) {
                  cid = j.IpfsHash;
                  fallbackSpinner.succeed(`Uploaded folder to Pinata (cid: ${cid})`);
                } else {
                  fallbackSpinner.fail('Pinata directory upload failed');
                  console.error(chalk.gray(JSON.stringify(j)));
                }
              } catch (e2) {
                pinSpinner.fail("Pinata upload failed");
                console.error(chalk.red(e2.stderr || e2.message || e2));
              }
            }
          }
        }

          if (!cid) {
            console.error(
              chalk.red(
                "Failed to upload to IPFS. Set WEB3_STORAGE_API_KEY or install and run an IPFS daemon (ipfs), or provide PINATA_API_KEY and PINATA_API_SECRET."
              )
            );
            return;
          }

        // Print gateway links
        console.log(chalk.green("✅ Frontend published to IPFS"));
        console.log(chalk.gray("Gateway URLs:"));
        console.log(`  https://ipfs.io/ipfs/${cid}/`);
        console.log(`  https://${cid}.ipfs.dweb.link/`);
        console.log(`  https://${cid}.ipfs.w3s.link/`);

        // Clean up tar (if created)
        try {
          if (tarPath) fs.rmSync(tarPath);
        } catch {}
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    });
}

// Utility: copy directory recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  if (exists && stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

// Utility: escape shell arg (simple)
function escapeShellArg(s) {
  if (!s) return "''";
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

// Utility: recursively build -F flags for curl directory upload to Pinata
function buildPinataCurlFormFlags(rootDir) {
  const parts = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir)) {
      const abs = path.join(dir, entry);
      const rel = path.relative(rootDir, abs);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
      } else {
        // filename should carry the relative path to preserve folder structure on IPFS
        const flag = `-F "file=@${abs.replace(/"/g, '\\"')};filename=${rel.replace(/"/g, '\\"')}"`;
        parts.push(flag);
      }
    }
  };
  walk(rootDir);
  return parts.join(' ');
}
