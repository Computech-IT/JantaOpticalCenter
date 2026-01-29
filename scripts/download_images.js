// downloads three placeholder images from Unsplash into public/images/products
// Usage: node scripts/download_images.js

const fs = require('fs');
const path = require('path');
const https = require('https');

const destDir = path.join(__dirname, '..', 'public', 'images', 'products');
const queries = [
  'luxury-sunglasses',
  'designer-eyeglasses',
  'portrait-glasses'
];

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) return reject(new Error('Failed to download ' + url));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

(async () => {
  console.log('Downloading placeholder images to', destDir);
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const url = `https://source.unsplash.com/1200x1200/?${encodeURIComponent(q)}`;
    const dest = path.join(destDir, `${i + 1}.jpg`);
    try {
      await download(url, dest);
      console.log('Saved', dest);
    } catch (err) {
      console.error('Error downloading', url, err.message);
    }
  }
  console.log('Done.');
})();
