#!/usr/bin/env node

/**
 * Fix import paths for Vercel deployment
 * This script converts absolute imports to relative imports for better compatibility
 */

const fs = require('fs');
const path = require('path');

// Files to fix
const filesToFix = [
  'app/page.tsx'
];

// Import mapping (from absolute to relative)
const importMapping = {
  '@/components/RealTimePriceChart': '../components/RealTimePriceChart',
  '@/components/ComprehensiveMinIOCharts': '../components/ComprehensiveMinIOCharts',
  '@/components/PriceForecastChart': '../components/PriceForecastChart',
  '@/components/MarketCapHeatmap': '../components/MarketCapHeatmap',
  '@/components/MetricCard': '../components/MetricCard',
  '@/components/NewsAnalysis': '../components/NewsAnalysis'
};

console.log('🔧 Fixing import paths for Vercel deployment...');

filesToFix.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  Object.entries(importMapping).forEach(([absolutePath, relativePath]) => {
    const oldImport = `import (.+) from '${absolutePath}'`;
    const newImport = `import $1 from '${relativePath}'`;
    
    const regex = new RegExp(oldImport, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, newImport);
      modified = true;
      console.log(`✅ Fixed import: ${absolutePath} → ${relativePath}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`📝 Updated: ${file}`);
  } else {
    console.log(`✓ No changes needed: ${file}`);
  }
});

console.log('🎉 Import path fixes completed!');