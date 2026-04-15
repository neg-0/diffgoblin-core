import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * Compare two PNG buffers and produce a diff image + change stats.
 * Handles images of different sizes by padding the smaller one.
 */
export function computeDiff(bufferA, bufferB, opts = {}) {
  const { threshold = 0.1, diffColor = [255, 0, 0] } = opts;

  let imgA = PNG.sync.read(bufferA);
  let imgB = PNG.sync.read(bufferB);

  const width = Math.max(imgA.width, imgB.width);
  const height = Math.max(imgA.height, imgB.height);

  imgA = normalizeSize(imgA, width, height);
  imgB = normalizeSize(imgB, width, height);

  const diffImg = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(
    imgA.data,
    imgB.data,
    diffImg.data,
    width,
    height,
    { threshold, diffColor, alpha: 0.3 }
  );

  const totalPixels = width * height;
  const changePercent = ((mismatchedPixels / totalPixels) * 100).toFixed(2);

  const regions = detectChangeRegions(diffImg, width, height);

  return {
    diffBuffer: PNG.sync.write(diffImg),
    stats: {
      width,
      height,
      totalPixels,
      mismatchedPixels,
      changePercent: parseFloat(changePercent),
      regionCount: regions.length,
    },
    regions,
  };
}

function normalizeSize(img, targetW, targetH) {
  if (img.width === targetW && img.height === targetH) return img;

  const out = new PNG({ width: targetW, height: targetH, fill: true });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255;
    out.data[i + 1] = 255;
    out.data[i + 2] = 255;
    out.data[i + 3] = 255;
  }
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

function detectChangeRegions(diffImg, width, height) {
  const gridSize = 32;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);
  const grid = new Uint8Array(cols * rows);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = diffImg.data[idx];
      const g = diffImg.data[idx + 1];
      const b = diffImg.data[idx + 2];
      const a = diffImg.data[idx + 3];
      if (a > 0 && (r > 100 || g > 100 || b > 100)) {
        if (r > g + 50 || r > b + 50) {
          const gx = Math.floor(x / gridSize);
          const gy = Math.floor(y / gridSize);
          grid[gy * cols + gx] = 1;
        }
      }
    }
  }

  const visited = new Uint8Array(cols * rows);
  const regions = [];

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const gi = gy * cols + gx;
      if (grid[gi] && !visited[gi]) {
        const region = floodFill(grid, visited, cols, rows, gx, gy, gridSize);
        regions.push(region);
      }
    }
  }

  regions.sort((a, b) => (b.w * b.h) - (a.w * a.h));
  return regions.slice(0, 20);
}

function floodFill(grid, visited, cols, rows, startX, startY, gridSize) {
  const stack = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;

  while (stack.length > 0) {
    const [gx, gy] = stack.pop();
    const gi = gy * cols + gx;
    if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) continue;
    if (visited[gi] || !grid[gi]) continue;

    visited[gi] = 1;
    minX = Math.min(minX, gx);
    maxX = Math.max(maxX, gx);
    minY = Math.min(minY, gy);
    maxY = Math.max(maxY, gy);

    stack.push([gx + 1, gy], [gx - 1, gy], [gx, gy + 1], [gx, gy - 1]);
  }

  return {
    x: minX * gridSize,
    y: minY * gridSize,
    w: (maxX - minX + 1) * gridSize,
    h: (maxY - minY + 1) * gridSize,
    label: `region_${minX}_${minY}`,
  };
}
