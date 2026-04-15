#!/usr/bin/env node

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { captureScreenshot } from '../lib/screenshot.js';
import { computeDiff } from '../lib/diff.js';
import { summarize } from '../lib/summarize.js';

const args = process.argv.slice(2);

if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
  console.log(`
diffgoblin-core — visual diff engine for websites

Usage:
  diffgoblin <url-before> <url-after> [options]

Options:
  --output, -o <dir>   Output directory (default: ./output)
  --threshold <n>      Pixel match threshold 0-1 (default: 0.1)
  --width <n>          Viewport width (default: 1280)
  --json               Output JSON report to stdout
  --help, -h           Show this help

Examples:
  diffgoblin https://example.com https://example.com/staging
  diffgoblin https://competitor.com/pricing https://competitor.com/pricing -o ./diffs
  diffgoblin https://mysite.com https://mysite.com --json
`);
  process.exit(0);
}

const urlA = args[0];
const urlB = args[1];

function getFlag(flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    const alt = flag.replace('--', '-');
    const altIdx = args.indexOf(alt);
    return altIdx === -1 ? defaultVal : args[altIdx + 1];
  }
  return args[idx + 1];
}

const outputDir = resolve(getFlag('--output', getFlag('-o', './output')));
const threshold = parseFloat(getFlag('--threshold', '0.1'));
const width = parseInt(getFlag('--width', '1280'), 10);
const jsonMode = args.includes('--json');

async function run() {
  if (!jsonMode) console.log('diffgoblin-core v0.1.0\n');

  mkdirSync(outputDir, { recursive: true });

  if (!jsonMode) console.log(`[1/3] Capturing: ${urlA}`);
  const snapA = await captureScreenshot(urlA, { width });
  if (!jsonMode) console.log(`      Done — "${snapA.metadata.title}"`);

  if (!jsonMode) console.log(`[2/3] Capturing: ${urlB}`);
  const snapB = await captureScreenshot(urlB, { width });
  if (!jsonMode) console.log(`      Done — "${snapB.metadata.title}"`);

  if (!jsonMode) console.log('[3/3] Computing diff...');
  const diffResult = computeDiff(snapA.buffer, snapB.buffer, { threshold });

  const report = summarize(snapA.metadata, snapB.metadata, diffResult);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  writeFileSync(join(outputDir, `before-${ts}.png`), snapA.buffer);
  writeFileSync(join(outputDir, `after-${ts}.png`), snapB.buffer);
  writeFileSync(join(outputDir, `diff-${ts}.png`), diffResult.diffBuffer);
  writeFileSync(join(outputDir, `report-${ts}.json`), JSON.stringify(report, null, 2));

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('DIFF REPORT');
    console.log('='.repeat(60));
    console.log(`Before:  ${report.before.url}`);
    console.log(`After:   ${report.after.url}`);
    console.log(`Change:  ${report.summary.changePercent}% pixels differ`);
    console.log(`Regions: ${report.summary.regionCount} distinct change areas`);
    console.log(`Grade:   ${report.summary.magnitude.toUpperCase()}`);
    console.log(`Verdict: ${report.summary.verdict}`);

    if (report.changes.length > 0) {
      console.log('\nChange Regions:');
      for (const change of report.changes) {
        console.log(`  - ${change.zone} (${change.size}, ${change.areaPercent}% of page)`);
      }
    }

    console.log(`\nOutput: ${outputDir}/`);
  }

  // Exit with code 1 if changes detected (useful for CI)
  if (report.summary.changePercent > 0 && report.summary.magnitude !== 'negligible') {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(2);
});
