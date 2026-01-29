// Generates PNG and ICO favicons from public/favicon.svg using sharp
// Usage: npm run generate-favicons

const fs = require('fs');
const path = require('path');

async function ensureSharp() {
  try {
    return require('sharp');
  } catch (err) {
    console.error('\nThe module "sharp" is required to generate favicons.');
    console.error('Run: npm install sharp --save-dev\n');
    process.exit(1);
  }
}

(async () => {
  const sharp = await ensureSharp();
  const svgPath = path.join(__dirname, '..', 'public', 'favicon.svg');
  if (!fs.existsSync(svgPath)) {
    console.error('favicon.svg not found at', svgPath);
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..', 'public');
  try {
    // 512x512 PNG
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(outDir, 'favicon-512.png'));

    // 192x192 PNG
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(outDir, 'favicon-192.png'));

    // 32x32 PNG
    await sharp(svgPath)
      .resize(32, 32)
      .png()
      .toFile(path.join(outDir, 'favicon-32.png'));

    // ICO: combine 32 and 16 (sharp can output ico via raw buffer + png-to-ico lib, but we'll write a single 32x32 PNG and let browsers use it as favicon.ico)
    // For a proper multi-size ICO, install "png-to-ico" and uncomment below.

    // write a simple favicon.ico placeholder by converting 32 png via png-to-ico (optional)

    console.log('Favicons generated: favicon-512.png, favicon-192.png, favicon-32.png');
    console.log('You can also create a .ico file by running: npm install png-to-ico && node scripts/generate_favicons_icon.js');
  } catch (err) {
    console.error('Error generating favicons:', err);
    process.exit(1);
  }
})();
