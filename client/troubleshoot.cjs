#!/usr/bin/env node

/**
 * Troubleshooting script for VideoSDK OpenAI Realtime Translator
 * Helps identify and fix common development issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 VideoSDK Translator Troubleshooting Script');
console.log('============================================\n');

// Check Node.js version
function checkNodeVersion() {
  console.log('1. Checking Node.js version...');
  try {
    const version = process.version;
    console.log(`   Node.js version: ${version}`);
    
    const major = parseInt(version.slice(1).split('.')[0]);
    if (major < 16) {
      console.log('   ⚠️  Warning: Node.js 16+ recommended');
    } else {
      console.log('   ✅ Node.js version is compatible');
    }
  } catch (error) {
    console.log('   ❌ Error checking Node.js version:', error.message);
  }
}

// Check npm version
function checkNpmVersion() {
  console.log('\n2. Checking npm version...');
  try {
    const version = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`   npm version: ${version}`);
    console.log('   ✅ npm version is compatible');
  } catch (error) {
    console.log('   ❌ Error checking npm version:', error.message);
  }
}

// Check dependencies
function checkDependencies() {
  console.log('\n3. Checking dependencies...');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`   Dependencies: ${Object.keys(packageJson.dependencies).length}`);
    console.log(`   Dev dependencies: ${Object.keys(packageJson.devDependencies).length}`);
    
    // Check for critical dependencies
    const criticalDeps = ['react', 'vite', '@vitejs/plugin-react'];
    const missing = criticalDeps.filter(dep => !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]);
    
    if (missing.length > 0) {
      console.log(`   ⚠️  Missing critical dependencies: ${missing.join(', ')}`);
    } else {
      console.log('   ✅ All critical dependencies present');
    }
  } catch (error) {
    console.log('   ❌ Error checking dependencies:', error.message);
  }
}

// Check for node_modules
function checkNodeModules() {
  console.log('\n4. Checking node_modules...');
  try {
    if (fs.existsSync('node_modules')) {
      const stats = fs.statSync('node_modules');
      console.log(`   node_modules exists (${stats.size} bytes)`);
      console.log('   ✅ node_modules directory found');
    } else {
      console.log('   ❌ node_modules directory not found');
      console.log('   💡 Run: npm install');
    }
  } catch (error) {
    console.log('   ❌ Error checking node_modules:', error.message);
  }
}

// Check Vite cache
function checkViteCache() {
  console.log('\n5. Checking Vite cache...');
  try {
    const cacheDir = path.join('node_modules', '.vite');
    if (fs.existsSync(cacheDir)) {
      console.log('   Vite cache directory found');
      console.log('   💡 Consider clearing cache if issues persist');
    } else {
      console.log('   No Vite cache directory found');
    }
  } catch (error) {
    console.log('   ❌ Error checking Vite cache:', error.message);
  }
}

// Check environment files
function checkEnvironmentFiles() {
  console.log('\n6. Checking environment files...');
  try {
    const envFiles = ['.env', '.env.example'];
    envFiles.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} exists`);
      } else {
        console.log(`   ⚠️  ${file} not found`);
      }
    });
  } catch (error) {
    console.log('   ❌ Error checking environment files:', error.message);
  }
}

// Check TypeScript configuration
function checkTypeScriptConfig() {
  console.log('\n7. Checking TypeScript configuration...');
  try {
    const tsConfigFiles = ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json'];
    tsConfigFiles.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} exists`);
      } else {
        console.log(`   ⚠️  ${file} not found`);
      }
    });
  } catch (error) {
    console.log('   ❌ Error checking TypeScript config:', error.message);
  }
}

// Check for common issues
function checkCommonIssues() {
  console.log('\n8. Checking for common issues...');
  
  // Check for source map issues
  try {
    const distDir = 'dist';
    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir);
      const sourceMaps = files.filter(file => file.endsWith('.map'));
      if (sourceMaps.length > 0) {
        console.log(`   Found ${sourceMaps.length} source map files`);
      } else {
        console.log('   No source map files found in dist/');
      }
    }
  } catch (error) {
    console.log('   ❌ Error checking source maps:', error.message);
  }
  
  // Check for large bundle size
  try {
    const distDir = 'dist';
    if (fs.existsSync(distDir)) {
      const assetsDir = path.join(distDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        files.forEach(file => {
          if (file.endsWith('.js')) {
            const filePath = path.join(assetsDir, file);
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`   ${file}: ${sizeMB} MB`);
            if (stats.size > 500 * 1024) {
              console.log('   ⚠️  Large bundle size detected');
            }
          }
        });
      }
    }
  } catch (error) {
    console.log('   ❌ Error checking bundle size:', error.message);
  }
}

// Provide solutions
function provideSolutions() {
  console.log('\n9. Recommended solutions:');
  console.log('   💡 If you see source map errors:');
  console.log('      1. Clear browser cache');
  console.log('      2. Run: rm -rf node_modules/.vite');
  console.log('      3. Run: npm run build');
  console.log('      4. Restart development server');
  console.log('');
  console.log('   💡 If you see build errors:');
  console.log('      1. Run: npm install');
  console.log('      2. Run: npm run build');
  console.log('      3. Check for TypeScript errors');
  console.log('');
  console.log('   💡 If you see runtime errors:');
  console.log('      1. Check browser console');
  console.log('      2. Verify environment variables');
  console.log('      3. Check network connectivity');
  console.log('');
  console.log('   💡 For performance issues:');
  console.log('      1. Check bundle size');
  console.log('      2. Enable code splitting');
  console.log('      3. Optimize dependencies');
}

// Run all checks
function runAllChecks() {
  checkNodeVersion();
  checkNpmVersion();
  checkDependencies();
  checkNodeModules();
  checkViteCache();
  checkEnvironmentFiles();
  checkTypeScriptConfig();
  checkCommonIssues();
  provideSolutions();
}

// Main execution
if (require.main === module) {
  runAllChecks();
  console.log('\n✅ Troubleshooting complete!');
  console.log('   Check the output above for any issues and follow the recommended solutions.');
}

module.exports = {
  checkNodeVersion,
  checkNpmVersion,
  checkDependencies,
  checkNodeModules,
  checkViteCache,
  checkEnvironmentFiles,
  checkTypeScriptConfig,
  checkCommonIssues,
  provideSolutions,
  runAllChecks
}; 