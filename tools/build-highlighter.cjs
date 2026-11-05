// Node 18+. Reconstruye la dependencia local; no se necesita al ejecutar el plugin.
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const version = '11.12.0';
const languages = ['javascript', 'typescript', 'php', 'perl', 'bash', 'powershell', 'java', 'csharp', 'python', 'ruby', 'go', 'rust', 'kotlin', 'swift', 'dart', 'lua', 'r', 'c', 'cpp', 'json', 'xml', 'css', 'scss', 'sql', 'yaml', 'ini', 'markdown', 'plaintext'];
async function download(file) {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@${version}/${file}`);
  if (!response.ok) throw Error(`${file}: HTTP ${response.status}`);
  return response.text();
}
(async () => {
  let bundle = await download('highlight.min.js');
  const context = vm.createContext({}); vm.runInContext(bundle, context);
  for (const language of languages) {
    if (!context.hljs.getLanguage(language)) {
      const module = await download(`languages/${language}.min.js`);
      vm.runInContext(module, context); bundle += '\n' + module;
    }
    if (!context.hljs.getLanguage(language)) throw Error(`Falta la gramática ${language}`);
  }
  const license = await download('LICENSE');
  const destination = path.join(__dirname, '..', 'js', 'vendor');
  await fs.writeFile(path.join(destination, 'highlight.min.js'), bundle);
  await fs.writeFile(path.join(destination, 'highlight.LICENSE'), license);
  console.log(`Highlight.js ${version}: ${Buffer.byteLength(bundle)} bytes; ${languages.length} gramáticas verificadas.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
