const fs = require('fs');
const path = require('path');
const setsDir = path.resolve(process.cwd(), 'public/sets');
const manifestPath = path.join(setsDir, 'index.json');
const subDirs = ['Kanji', 'English'];
let allSets = [];

subDirs.forEach(type => {
  const dirPath = path.join(setsDir, type);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.csv'));
    const sets = files.map(file => {
      const name = file.replace(/\.csv$/i, '');
      const id = `static-set-${type.toLowerCase()}-${Buffer.from(`${type}/${file}`).toString('base64').replace(/=+$/,'')}`;
      return { id, name, filename: `${type}/${file}`, type };
    });
    allSets = allSets.concat(sets);
  }
});

fs.writeFileSync(manifestPath, JSON.stringify({ sets: allSets }, null, 2), 'utf8');
console.log('[generate-sets-manifest] Wrote', allSets.length, 'sets to', manifestPath);
