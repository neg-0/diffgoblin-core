# diffgoblin-core

Visual diff engine for websites. Screenshot two URLs, compute pixel-level differences, get a structured change report with region detection.

## What it does

1. Screenshots two URLs using Puppeteer
2. Computes pixel-level diff using pixelmatch
3. Detects distinct change regions via flood-fill
4. Classifies changes by magnitude (negligible/minor/moderate/major/overhaul)
5. Outputs diff image + JSON report

## Install

```bash
# From GitHub (no npm publish needed)
npm install neg-0/diffgoblin-core

# Or clone and use directly
git clone https://github.com/neg-0/diffgoblin-core.git
cd diffgoblin-core
npm install
```

## CLI Usage

```bash
# Compare two URLs
npx diffgoblin https://example.com https://staging.example.com

# Custom output directory
npx diffgoblin https://competitor.com/pricing https://competitor.com/pricing -o ./diffs

# JSON output (for CI pipelines)
npx diffgoblin https://mysite.com https://mysite.com --json

# Custom viewport width
npx diffgoblin https://mysite.com https://mysite.com --width 1920
```

**Exit codes:** `0` = no meaningful changes, `1` = changes detected, `2` = error. Useful for CI gates.

## Programmatic Usage

```javascript
import { captureScreenshot, computeDiff, summarize } from 'diffgoblin-core';

// Screenshot two URLs
const snapA = await captureScreenshot('https://example.com');
const snapB = await captureScreenshot('https://staging.example.com');

// Compute diff
const diff = computeDiff(snapA.buffer, snapB.buffer, { threshold: 0.1 });

// Get structured report
const report = summarize(snapA.metadata, snapB.metadata, diff);

console.log(report.summary.magnitude);    // 'minor' | 'moderate' | 'major' | ...
console.log(report.summary.changePercent); // 3.45
console.log(report.summary.verdict);       // 'Minor visual changes detected...'
console.log(report.changes);               // [{ zone: 'header/navigation', size: 'medium', ... }]
```

## CI Example (GitHub Actions)

```yaml
name: Visual Regression
on: [pull_request]

jobs:
  visual-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install neg-0/diffgoblin-core
      - name: Compare staging vs production
        run: npx diffgoblin ${{ env.PROD_URL }} ${{ env.STAGING_URL }} --json > diff-report.json
        continue-on-error: true
      - uses: actions/upload-artifact@v4
        with:
          name: visual-diff
          path: output/
```

## Output

Each run produces:
- `before-{timestamp}.png` — screenshot of first URL
- `after-{timestamp}.png` — screenshot of second URL
- `diff-{timestamp}.png` — visual diff (changed pixels highlighted in red)
- `report-{timestamp}.json` — structured change report

### Report Structure

```json
{
  "summary": {
    "magnitude": "moderate",
    "changePercent": 8.42,
    "regionCount": 3,
    "confidence": 0.85,
    "verdict": "Moderate visual changes detected across header/navigation, main content."
  },
  "before": { "url": "...", "title": "...", "capturedAt": "..." },
  "after": { "url": "...", "title": "...", "capturedAt": "..." },
  "changes": [
    { "zone": "header/navigation", "size": "medium", "areaPercent": 2.31 },
    { "zone": "main content", "size": "large", "areaPercent": 5.67 }
  ]
}
```

## API

### `captureScreenshot(url, opts?)`
Screenshot a URL. Returns `{ buffer: Buffer, metadata: { url, title, capturedAt, viewport } }`.

Options: `width` (1280), `height` (800), `fullPage` (true), `waitUntil` ('networkidle2'), `timeout` (30000).

### `computeDiff(bufferA, bufferB, opts?)`
Compare two PNG buffers. Returns `{ diffBuffer, stats, regions }`. Handles different-sized images.

Options: `threshold` (0.1), `diffColor` ([255, 0, 0]).

### `summarize(metaA, metaB, diffResult)`
Generate a structured report from diff results. Pure heuristic, no API calls.

## Want automated daily monitoring?

This library powers [DiffGoblin](https://neg-0.github.io/diffgoblin/) — automated website change monitoring. Set URLs, get daily visual diffs + email alerts. No code required.

## License

MIT
