// ===================================================
// find-duplicate-indexes.js - Find duplicate index definitions
// ===================================================
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'models');

console.log('Scanning for duplicate index definitions...\n');

const checkFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const filename = path.basename(filePath);
  
  // Find fields with index: true or unique: true
  const fieldIndexMatches = content.match(/(\w+):\s*\{[^}]*?(index|unique):\s*true[^}]*?\}/g);
  
  // Find schema.index() calls
  const schemaIndexMatches = content.match(/Schema\.index\(\{([^}]+)\}/g);
  
  if (fieldIndexMatches || schemaIndexMatches) {
    console.log(`\n📄 ${filename}`);
    console.log('━'.repeat(50));
    
    if (fieldIndexMatches) {
      console.log('\n🔍 Field-level indexes:');
      fieldIndexMatches.forEach(match => {
        const fieldName = match.match(/(\w+):/)[1];
        console.log(`   - ${fieldName} (has index/unique in field definition)`);
      });
    }
    
    if (schemaIndexMatches) {
      console.log('\n🔍 Schema.index() calls:');
      schemaIndexMatches.forEach(match => {
        const fields = match.match(/\{([^}]+)\}/)[1];
        console.log(`   - schema.index({ ${fields.trim()} })`);
      });
    }
    
    // Check for potential duplicates
    if (fieldIndexMatches && schemaIndexMatches) {
      console.log('\n⚠️  WARNING: This file has both field-level and schema-level indexes!');
      console.log('   Check for duplicates and remove one definition.');
    }
  }
};

// Scan all .js files in models directory
try {
  const files = fs.readdirSync(modelsDir)
    .filter(file => file.endsWith('.js'));
  
  files.forEach(file => {
    checkFile(path.join(modelsDir, file));
  });
  
  console.log('\n\n✅ Scan complete!');
  console.log('\n💡 Fix suggestions:');
  console.log('   1. Remove "index: true" or "unique: true" from field definitions');
  console.log('   2. Keep only schema.index() definitions');
  console.log('   3. Or keep field-level unique: true and remove schema.index()');
  
} catch (error) {
  console.error('Error:', error.message);
}