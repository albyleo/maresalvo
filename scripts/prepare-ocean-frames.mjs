import { spawnSync } from 'node:child_process';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import ffmpeg from 'ffmpeg-static';

const folder = new URL('../public/videos/turtle-frames-v1/', import.meta.url);
await mkdir(folder, { recursive: true });
const { fileURLToPath } = await import('node:url');
const result = spawnSync(ffmpeg, ['-hide_banner','-loglevel','error','-y','-i',
  fileURLToPath(new URL('../public/videos/tartaruga.mp4', import.meta.url)),
  '-an','-vf','fps=24,scale=960:-2','-c:v','libwebp','-quality','70','-compression_level','4',
  '-start_number','0',fileURLToPath(folder) + 'frame-%04d.webp'], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('Frame extraction failed');
const frames = (await readdir(folder)).filter(name => /^frame-\d{4}\.webp$/.test(name)).sort();
const manifest = { count: frames.length, fps: 24, base: '/videos/turtle-frames-v1/' };
await writeFile(new URL('../src/components/home/ocean-frames.json', import.meta.url), JSON.stringify(manifest) + '\n');
const bytes = (await Promise.all(frames.map(name => stat(new URL(name, folder))))).reduce((sum, item) => sum + item.size, 0);
console.log(`${frames.length} frames, ${(bytes / 1048576).toFixed(2)} MiB total; loaded on demand.`);
