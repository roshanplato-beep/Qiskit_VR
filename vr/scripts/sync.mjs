import fs from 'node:fs';
const src = new URL('../../web/qure_bundle.json', import.meta.url);
const dst = new URL('../public/qure_bundle.json', import.meta.url);
if (!fs.existsSync(src)) { console.error('web/qure_bundle.json not found; keeping current vr/public/qure_bundle.json'); process.exit(1); }
fs.copyFileSync(src, dst);
console.log('synced web/qure_bundle.json -> vr/public/qure_bundle.json');
