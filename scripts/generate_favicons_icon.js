// Optional: generate a multi-size .ico using png-to-ico
// Usage: npm install png-to-ico && node scripts/generate_favicons_icon.js

const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const pngToIco = require('png-to-ico');
    const outDir = path.join(__dirname, '..', 'public');
    const png32 = path.join(outDir, 'favicon-32.png');
    const png16 = path.join(outDir, 'favicon-32.png');
    if (!fs.existsSync(png32)) throw new Error('favicon-32.png missing. Run generate_favicons first.');
    const buf = await pngToIco([png32]);
    fs.writeFileSync(path.join(outDir, 'favicon.ico'), buf);
    console.log('Generated favicon.ico');
  } catch (err) {
    console.error('png-to-ico is required. Run: npm install png-to-ico');
  }
}

run();
