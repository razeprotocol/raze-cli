import chalk from "chalk";
import figlet from "figlet";

export const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

export function renderStaticBlock() {
  const swirl = `
              .,;::::,..
          .:'';lllllc'........
       .:'lkkkkkkkkkkkkkkkkkkkk:...
     .:kkkkkkkkkkkkkkkkkkkkkkkkkkkdc.
    .ckkkkkkkkkkkkkkkkkkkkkkkkkkkkkkx,
   .ckkkkkkkkkkkkkkko:'...':okkkkkkkko.
  .okkkkkkkkkkkkkk:.         'okkkkkkko.
 .:kkkkkkkkkkkkkkc             ckkkkkkkd.
.okkkkkkkkkkkkkkkc             ckkkkkkkko.
ckkkkkkkkkkkkkkkk:             ckkkkkkkkko
okkkkkkkkkkkkkkkk:             ckkkkkkkkko
ckkkkkkkkkkkkkkkkc             ckkkkkkkkko
'okkkkkkkkkkkkkkko.           .okkkkkkkkko
.dkkkkkkkkkkkkkkkd.          .okkkkkkkkkk,
 .:kkkkkkkkkkkkkkkkc.      .:okkkkkkkkkkd.
  .okkkkkkkkkkkkkkkkkc.  .:okkkkkkkkkkko.
   .lkkkkkkkkkkkkkkkkkkxookkkkkkkkkkkko.
    .ckkkkkkkkkkkkkkkkkkkkkkkkkkkkkkko.
     .':oxkkkkkkkkkkkkkkkkkkkkkkkkxo,
         ..';:cloxkOOkkxooc:;'..
               ..,;;;,,..
`;
  const block = figlet.textSync("RAZE", { font: "ANSI Shadow" }).split("\n");
  const palette = [
    chalk.magentaBright,
    chalk.hex("#d147ff"),
    chalk.hex("#a470ff"),
    chalk.cyanBright,
  ];
  console.log(swirl);
  console.log(block.map((l, i) => palette[i % palette.length](l)).join("\n"));
  console.log(
    chalk.gray("Raze CLI — a minimal, fast, developer-friendly tool\n")
  );
}

export function parseArgsStringToArgv(str) {
  const args = [];
  let current = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  while (i < str.length) {
    const ch = str[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      i++;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      i++;
      continue;
    }
    if (ch === " " && !inSingle && !inDouble) {
      if (current.length) {
        args.push(current);
        current = "";
      }
      i++;
      continue;
    }
    if (ch === "\\" && i + 1 < str.length) {
      current += str[i + 1];
      i += 2;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.length) args.push(current);
  return args;
}

// simple levenshtein
export function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0);
  const v1 = new Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j++) v0[j] = j;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

export function findClosest(token, list) {
  let best = null;
  let bestScore = Infinity;
  for (const item of list) {
    const d = levenshtein(token, item);
    if (d < bestScore) {
      bestScore = d;
      best = item;
    }
  }
  return bestScore <= Math.max(2, Math.floor(token.length / 2)) ? best : null;
}
