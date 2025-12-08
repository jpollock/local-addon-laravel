#!/usr/bin/env node
/**
 * Release Validation Script
 *
 * Validates that the addon is ready for release by checking:
 * - Required package.json fields
 * - Build output exists
 * - Documentation files present
 * - CI/CD workflows configured
 * - Code quality passes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function check(condition, message, isWarning = false) {
  if (!condition) {
    if (isWarning) {
      warnings.push(message);
    } else {
      errors.push(message);
    }
  }
}

function fileExists(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

function runCommand(cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

console.log('Local Laravel - Release Validation');
console.log('===================================\n');

// Package.json checks
console.log('Checking package.json...');
const pkg = require(path.join(ROOT, 'package.json'));
check(pkg.name, 'package.json: missing "name" field');
check(pkg.version, 'package.json: missing "version" field');
check(pkg.productName, 'package.json: missing "productName" field');
check(pkg.license, 'package.json: missing "license" field');
check(pkg.repository, 'package.json: missing "repository" field', true);
check(pkg.main, 'package.json: missing "main" field');
check(pkg.renderer, 'package.json: missing "renderer" field');
check(pkg.localAddon, 'package.json: missing "localAddon" field');
check(
  pkg.localAddon?.minimumLocalVersion,
  'package.json: missing "localAddon.minimumLocalVersion" field'
);
console.log('  - name:', pkg.name);
console.log('  - version:', pkg.version);
console.log('  - productName:', pkg.productName);

// Documentation
console.log('\nChecking documentation...');
check(fileExists('README.md'), 'README.md is missing');
check(fileExists('CHANGELOG.md'), 'CHANGELOG.md is missing');
check(fileExists('CONTRIBUTING.md'), 'CONTRIBUTING.md is missing', true);
check(fileExists('LICENSE'), 'LICENSE is missing');
console.log('  - README.md:', fileExists('README.md') ? 'OK' : 'MISSING');
console.log('  - CHANGELOG.md:', fileExists('CHANGELOG.md') ? 'OK' : 'MISSING');
console.log('  - CONTRIBUTING.md:', fileExists('CONTRIBUTING.md') ? 'OK' : 'MISSING');
console.log('  - LICENSE:', fileExists('LICENSE') ? 'OK' : 'MISSING');

// Build output
console.log('\nChecking build output...');
check(fileExists('lib/main.js'), 'Build output missing: lib/main.js');
check(fileExists('lib/renderer.js'), 'Build output missing: lib/renderer.js');
console.log('  - lib/main.js:', fileExists('lib/main.js') ? 'OK' : 'MISSING');
console.log('  - lib/renderer.js:', fileExists('lib/renderer.js') ? 'OK' : 'MISSING');

// CI/CD
console.log('\nChecking CI/CD configuration...');
check(fileExists('.github/workflows/ci.yml'), 'CI workflow missing');
check(fileExists('.github/workflows/release.yml'), 'Release workflow missing', true);
console.log(
  '  - ci.yml:',
  fileExists('.github/workflows/ci.yml') ? 'OK' : 'MISSING'
);
console.log(
  '  - release.yml:',
  fileExists('.github/workflows/release.yml') ? 'OK' : 'MISSING'
);

// Code quality configs
console.log('\nChecking code quality configs...');
check(fileExists('.eslintrc.json'), 'ESLint config missing');
check(fileExists('.prettierrc'), 'Prettier config missing');
check(fileExists('jest.config.js'), 'Jest config missing', true);
check(fileExists('tsconfig.json'), 'TypeScript config missing');
console.log('  - .eslintrc.json:', fileExists('.eslintrc.json') ? 'OK' : 'MISSING');
console.log('  - .prettierrc:', fileExists('.prettierrc') ? 'OK' : 'MISSING');
console.log('  - jest.config.js:', fileExists('jest.config.js') ? 'OK' : 'MISSING');
console.log('  - tsconfig.json:', fileExists('tsconfig.json') ? 'OK' : 'MISSING');

// Run quality checks
console.log('\nRunning quality checks...');

process.stdout.write('  - Lint: ');
if (runCommand('npm run lint')) {
  console.log('PASSED');
} else {
  console.log('FAILED');
  errors.push('Lint check failed');
}

process.stdout.write('  - TypeScript: ');
if (runCommand('npm run type-check')) {
  console.log('PASSED');
} else {
  console.log('FAILED');
  errors.push('TypeScript check failed');
}

process.stdout.write('  - Build: ');
if (runCommand('npm run build')) {
  console.log('PASSED');
} else {
  console.log('FAILED');
  errors.push('Build failed');
}

// Report
console.log('\n--- Validation Report ---\n');

if (warnings.length > 0) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log(`  - ${w}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('Errors:');
  errors.forEach((e) => console.log(`  - ${e}`));
  console.log('\n Release validation FAILED');
  process.exit(1);
} else {
  console.log('All checks passed!');
  console.log('\n Release validation PASSED');
  process.exit(0);
}
