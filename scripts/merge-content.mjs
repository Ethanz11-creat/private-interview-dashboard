import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'public', 'index.html');

function readBody(fileName) {
  const source = fs.readFileSync(path.join(root, 'public', '二面', fileName), 'utf8');
  const match = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) throw new Error(`Cannot find <body> in ${fileName}`);
  return match[1];
}

function replaceBlock(html, name, content) {
  const start = `<!-- ${name}_START -->`;
  const end = `<!-- ${name}_END -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(html)) throw new Error(`Cannot find ${name} markers`);
  return html.replace(pattern, `${start}${content}${end}`);
}

let html = fs.readFileSync(indexPath, 'utf8');
// Keep the detailed projects. Only the school chapter is generated from its
// editable fragment; the archived project page must never overwrite the others.
if (!html.includes('<!-- PROJECT_SOURCE_START -->') || !html.includes('<!-- PROJECT_SOURCE_END -->')) {
  throw new Error('Cannot find canonical PROJECT_SOURCE in index.html');
}
const schoolSource = fs.readFileSync(path.join(root, 'content', 'school-project.html'), 'utf8').trim();
const architectureSource = fs.readFileSync(path.join(root, 'content', 'model-architecture.html'), 'utf8').trim();
const projectStart = html.indexOf('<!-- PROJECT_SOURCE_START -->');
const projectEnd = html.indexOf('<!-- PROJECT_SOURCE_END -->', projectStart);
const schoolStart = html.indexOf('<section id="school"', projectStart);
const schoolEnd = html.indexOf('    <footer>原文来源：', schoolStart);
if (schoolStart < projectStart || schoolEnd <= schoolStart || schoolEnd >= projectEnd) {
  throw new Error('Cannot locate the school chapter within PROJECT_SOURCE');
}
if (!schoolSource.startsWith('<section id="school"') || !schoolSource.endsWith('</section>')) {
  throw new Error('Invalid school project fragment');
}
html = html.slice(0, schoolStart) + schoolSource + '\n' + html.slice(schoolEnd);
html = replaceBlock(html, 'SUPERVISOR_SOURCE', readBody('联想主管面思维导图.html'));
if (!architectureSource.startsWith('<section id="architecture"') || !architectureSource.endsWith('</section>')) {
  throw new Error('Invalid model architecture fragment');
}
html = replaceBlock(html, 'ARCHITECTURE_SOURCE', architectureSource);
fs.writeFileSync(indexPath, html);
console.log('Preserved other projects; embedded the complete school, supervisor and architecture content.');
