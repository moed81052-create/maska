const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'public', 'assets', 'flowers');
const destDir = path.join(srcDir, 'clean');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.svg'));
files.forEach(file => {
  let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  // Remove background rect and text tags
  content = content.replace(/<rect\s+width="300"\s+height="300"[^>]*\/>/gi, '');
  content = content.replace(/<text[\s\S]*?<\/text>/gi, '');
  fs.writeFileSync(path.join(destDir, file), content.trim(), 'utf8');
});

console.log(`Successfully generated ${files.length} clean transparent SVGs in ${destDir}`);

