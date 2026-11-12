import fs from 'node:fs';
import { geoArea, geoEquirectangular, geoPath } from 'd3-geo';

const source = JSON.parse(fs.readFileSync('public/geo/world.geo.json', 'utf8'));
const features = source.features.map((feature) => ({ type: 'Feature', ...feature })).filter((feature) => {
  const name = feature.properties?.name ?? '';
  if (name === 'Antarctica') return false;
  return geoArea(feature) > 0.0015;
});
const collection = { type: 'FeatureCollection', features };
const projection = geoEquirectangular().fitSize([900, 420], collection);
const path = geoPath(projection);
let d = features.map((feature) => path(feature)).filter(Boolean).join(' ');
d = d.replace(/(-?\d+\.\d)\d+/g, '$1');
const ascii = d.replace(/[^\x00-\x7F]/g, '');
if (ascii !== d) throw new Error('path contains non-ASCII characters');
const projectionMeta = { scale: projection.scale(), translate: projection.translate() };
const out = `// 由 scripts/gen-world-outline.mjs 自动生成，请勿手工编辑\nexport const WORLD_OUTLINE = ${JSON.stringify(d)};\nexport const WORLD_VIEWBOX = { width: 900, height: 420 } as const;\nexport const WORLD_PROJECTION = ${JSON.stringify(projectionMeta)} as const;\n`;
fs.writeFileSync('src/map/worldOutline.ts', out);
console.log(`features=${features.length} bytes=${out.length}`);
