const fs = require('node:fs/promises');
const path = require('node:path');
const { minify } = require('html-minifier-terser');

async function build() {
  const root = __dirname;
  const inputPath = path.join(root, 'src', 'index.html');
  const outputDir = path.join(root, 'public');
  const outputPath = path.join(outputDir, 'index.html');
  const html = await fs.readFile(inputPath, 'utf8');
  const output = await minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true
  });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, output, 'utf8');
  console.log(`Build selesai: ${Buffer.byteLength(html)} -> ${Buffer.byteLength(output)} bytes`);
}

build().catch(error => {
  console.error('Build MIR Digital Store gagal:', error);
  process.exitCode = 1;
});
