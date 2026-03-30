const fs = require('fs');
const path = require('path');

const dirs = [
  'uploads',
  'logs',
  'config',
  'middleware',
  'models',
  'routes',
  'controllers',
  'utils'
];

dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

console.log('Setup complete!');
