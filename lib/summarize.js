/**
 * Generate a structured change summary from diff results.
 * Pure heuristic — no AI, no API calls. Fast, free, deterministic.
 */
export function summarize(metaA, metaB, diffResult) {
  const { stats, regions } = diffResult;
  const changes = [];

  let magnitude;
  if (stats.changePercent < 0.5) magnitude = 'negligible';
  else if (stats.changePercent < 3) magnitude = 'minor';
  else if (stats.changePercent < 15) magnitude = 'moderate';
  else if (stats.changePercent < 40) magnitude = 'major';
  else magnitude = 'overhaul';

  for (const region of regions) {
    const verticalPos = region.y / stats.height;
    let zone;
    if (verticalPos < 0.15) zone = 'header/navigation';
    else if (verticalPos < 0.85) zone = 'main content';
    else zone = 'footer';

    const areaPercent = ((region.w * region.h) / (stats.width * stats.height)) * 100;
    let size;
    if (areaPercent < 1) size = 'small';
    else if (areaPercent < 5) size = 'medium';
    else size = 'large';

    changes.push({
      zone,
      size,
      position: { x: region.x, y: region.y, w: region.w, h: region.h },
      areaPercent: parseFloat(areaPercent.toFixed(2)),
    });
  }

  let confidence;
  if (stats.changePercent < 0.1) confidence = 0.95;
  else if (regions.length <= 5) confidence = 0.85;
  else if (regions.length <= 15) confidence = 0.7;
  else confidence = 0.5;

  return {
    summary: {
      magnitude,
      changePercent: stats.changePercent,
      regionCount: regions.length,
      confidence,
      verdict: buildVerdict(magnitude, changes),
    },
    before: {
      url: metaA.url,
      title: metaA.title,
      capturedAt: metaA.capturedAt,
    },
    after: {
      url: metaB.url,
      title: metaB.title,
      capturedAt: metaB.capturedAt,
    },
    changes,
  };
}

function buildVerdict(magnitude, changes) {
  if (magnitude === 'negligible') {
    return 'No meaningful visual changes detected.';
  }

  const zones = [...new Set(changes.map(c => c.zone))];
  const largeChanges = changes.filter(c => c.size === 'large');

  const parts = [`${magnitude.charAt(0).toUpperCase() + magnitude.slice(1)} visual changes detected`];

  if (zones.length === 1) {
    parts.push(`concentrated in the ${zones[0]} area`);
  } else {
    parts.push(`across ${zones.join(', ')}`);
  }

  if (largeChanges.length > 0) {
    parts.push(`with ${largeChanges.length} large change region${largeChanges.length > 1 ? 's' : ''}`);
  }

  return parts.join(' ') + '.';
}
