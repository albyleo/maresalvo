import manifest from './ocean-frames.json';

/** Bounded, demand-driven image decoder. Never queues the entire film. */
export function createOceanSequence(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  const cache = new Map<number, HTMLImageElement>();
  const pending = new Map<number, HTMLImageElement>();
  const failed = new Set<number>();
  let target = 0;
  let drawn = -1;
  let direction = 1;
  let disposed = false;
  let raf = 0;
  let active = true;
  const draw = () => {
    raf = 0;
    if (disposed || !active || document.hidden) return;
    // Hold the last complete image while a distant target is loading.
    const frame = cache.get(target);
    if (!frame || drawn === target) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    const scale = Math.max(canvas.width / frame.naturalWidth, canvas.height / frame.naturalHeight);
    const w = frame.naturalWidth * scale, h = frame.naturalHeight * scale;
    const focal = window.matchMedia('(max-width: 767px)').matches ? 0.4 : 0.5;
    context.drawImage(frame, (canvas.width - w) * focal, (canvas.height - h) / 2, w, h);
    drawn = target;
    canvas.dataset.ready = 'true';
  };
  const schedule = () => { if (!raf && !disposed) raf = requestAnimationFrame(draw); };
  const pump = () => {
    if (disposed || !active || document.hidden) return;
    const wanted = [target, ...[1, 2, 3, 4, 5, 6, -1, -2].map(offset => target + direction * offset)];
    for (const index of wanted) {
      if (pending.size >= 4) break;
      if (index < 0 || index >= manifest.count || cache.has(index) || pending.has(index) || failed.has(index)) continue;
      const image = new Image();
      image.decoding = 'async';
      pending.set(index, image);
      image.onload = () => {
        pending.delete(index);
        if (disposed) return;
        cache.set(index, image);
        // Keep at most 16 decoded frames (about 33 MB at 960×540).
        if (cache.size > 16) {
          const farthest = [...cache.keys()].sort((a, b) => Math.abs(b - target) - Math.abs(a - target))[0];
          cache.delete(farthest);
        }
        schedule(); pump();
      };
      image.onerror = () => { pending.delete(index); failed.add(index); pump(); };
      image.src = `${manifest.base}frame-${String(index).padStart(4, '0')}.webp`;
    }
  };
  const resize = new ResizeObserver(() => { drawn = -1; schedule(); });
  resize.observe(canvas);
  const visibility = () => { if (!document.hidden) { schedule(); pump(); } };
  document.addEventListener('visibilitychange', visibility);
  pump();
  return {
    update(progress: number) {
      const next = Math.round(Math.max(0, Math.min(1, progress)) * (manifest.count - 1));
      if (next !== target) direction = next > target ? 1 : -1;
      target = next; schedule(); pump();
    },
    setActive(value: boolean) { active = value; if (active) { schedule(); pump(); } },
    destroy() {
      disposed = true; cancelAnimationFrame(raf); resize.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      for (const image of pending.values()) { image.onload = null; image.onerror = null; image.src = ''; }
      pending.clear(); cache.clear(); failed.clear();
      delete canvas.dataset.ready;
    },
  };
}
