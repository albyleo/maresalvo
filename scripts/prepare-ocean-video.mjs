import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';

const root = fileURLToPath(new URL('../', import.meta.url));
function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Video preparation failed');
}
// Keep all 30 seconds and the original aspect ratio. Frequent keyframes improve seeking.
run(['-i', 'public/videos/tartaruga.mp4', '-an', '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'fast', '-crf', '25', '-g', '10', '-keyint_min', '10', '-sc_threshold', '0', '-bf', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'public/videos/tartaruga-scroll.mp4']);
run(['-ss', '0.1', '-i', 'public/videos/tartaruga.mp4', '-frames:v', '1', '-vf', 'scale=1920:-2', '-q:v', '3', 'public/images/tartaruga-poster.jpg']);
console.log('Prepared scroll video and poster; original unchanged.');
