import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'public', 'index.html');

function readBody(fileName) {
  const source = fs.readFileSync(path.join(root, 'public', '二面', fileName), 'utf8');
  const match = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) throw new Error(`Cannot find <body> in ${fileName}`);
  return match[1].trim();
}

function replaceBlock(html, name, content) {
  const start = `<!-- ${name}_START -->`;
  const end = `<!-- ${name}_END -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(html)) throw new Error(`Cannot find ${name} markers`);
  return html.replace(pattern, `${start}\n${content}\n${end}`);
}

let html = fs.readFileSync(indexPath, 'utf8');
html = replaceBlock(html, 'PROJECT_SOURCE', readBody('业务信息查询Agent-项目追问导图.html'));
html = replaceBlock(html, 'SUPERVISOR_SOURCE', readBody('联想主管面思维导图.html'));
fs.writeFileSync(indexPath, html);
console.log('Merged both source pages into public/index.html');
