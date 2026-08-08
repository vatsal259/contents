import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.join(__dirname, '..', 'blog');
const outFile = path.join(blogDir, 'index.json');

const slugs = fs
  .readdirSync(blogDir)
  .filter(
    (name) =>
      name.endsWith('.md') && name.toLowerCase() !== 'readme.md'
  )
  .map((name) => name.replace(/\.md$/i, ''))
  .sort((a, b) => a.localeCompare(b));

fs.writeFileSync(outFile, `${JSON.stringify(slugs, null, 2)}\n`);
console.log(`Wrote ${slugs.length} slugs to blog/index.json`);
