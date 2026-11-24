import { spawnSync } from 'node:child_process';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import ffmpeg from 'ffmpeg-static';

const folder = new URL('../public/videos/turtle-atlases-v2/', import.meta.url);
await mkdir(folder, { recursive: true });
const { fileURLToPath } = await import('node:url');
const result = spawnSync(ffmpeg, ['-hide_banner','-loglevel','error','-y','-i',
  fileURLToPath(new URL('../public/videos/tartaruga.mp4', import.meta.url)),
  '-an','-vf','fps=10,crop=ih*2/3:ih:(iw-ih*2/3)*0.4:0,scale=320:480,tile=5x5','-c:v','libwebp','-quality','62','-compression_level','4',
  '-start_number','0',fileURLToPath(folder) + 'atlas-%02d.webp'], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('Frame extraction failed');
const frames = (await readdir(folder)).filter(name => /^atlas-\d{2}\.webp$/.test(name)).sort();
if (frames.length !== 12) throw new Error('Expected 12 sheets for the 30-second source; verify duration before publishing.');
const manifest = { count: 300, fps: 10, columns: 5, rows: 5, width: 320, height: 480, sheets: frames.length, base: '/videos/turtle-atlases-v2/' };
await writeFile(new URL('../src/components/home/ocean-frames.json', import.meta.url), JSON.stringify(manifest) + '\n');
const bytes = (await Promise.all(frames.map(name => stat(new URL(name, folder))))).reduce((sum, item) => sum + item.size, 0);
console.log(`${frames.length} atlas files, ${(bytes / 1048576).toFixed(2)} MiB total; loaded on demand.`);
