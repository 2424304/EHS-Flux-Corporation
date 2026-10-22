/**
 * Test runner — runs all test files in sequence.
 * Usage: node tests/run-tests.js
 */

const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
  'validation.test.js',
  'api.test.js'
];

let allPassed = true;
let totalPassed = 0, totalFailed = 0;

for (const t of tests) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('▶ Running ' + t);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const result = spawnSync('node', [path.join(__dirname, t)], { stdio: 'inherit' });
  if (result.status !== 0) {
    allPassed = false;
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(allPassed ? '✓ All tests passed.' : '✗ Some tests failed.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(allPassed ? 0 : 1);
