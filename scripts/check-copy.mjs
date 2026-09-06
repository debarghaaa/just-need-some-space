// Copy lint: fails the build if visible copy contains em dashes, emoji, or forbidden marketing phrases.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;
const FORBIDDEN = [
  /\u2014/g, // em dash
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, // emoji + misc symbols
  /explore the unknown/i,
  /seamless/i,
  /revolutionary/i,
  /next[- ]generation/i,
  /unleash/i,
  /elevate your/i,
  /embark on/i,
  /journey/i,
  /made with ai/i,
  /powered by ai/i,
  /cutting[- ]edge/i,
  /game[- ]changing/i,
  /immersive/i,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|md)$/.test(name)) out.push(p);
  }
  return out;
}

let bad = 0;
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const re of FORBIDDEN) {
      re.lastIndex = 0;
      if (re.test(line)) {
        bad++;
        console.log(`${file.replace(ROOT, 'src')}:${i + 1}: ${re} -> ${line.trim().slice(0, 100)}`);
      }
    }
  });
}
if (bad) {
  console.error(`\ncopy lint: ${bad} problem(s)`);
  process.exit(1);
}
console.log('copy lint: clean (no em dashes, emoji, or forbidden phrases in src/)');
