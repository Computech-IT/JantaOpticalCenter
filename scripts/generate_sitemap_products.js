const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'public', 'data', 'products.json');
const outPath = path.join(__dirname, '..', 'public', 'sitemap-products.xml');
const site = process.env.SITE_URL || 'https://www.jantaoptical.com';

if (!fs.existsSync(dataPath)) {
  console.error('products.json not found at', dataPath);
  process.exit(1);
}

const products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let urls = products.map(p => {
  const slug = (p.slug || (`product-${p.id}`)).replace(/\s+/g,'-').toLowerCase();
  return `  <url>\n    <loc>${site}/products/${slug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

fs.writeFileSync(outPath, xml, 'utf8');
console.log('Wrote', outPath, 'with', products.length, 'product URLs.');
console.log('Replace SITE_URL env or edit the file to use your real domain.');
