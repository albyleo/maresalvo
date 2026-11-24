import manifest from './ocean-frames.json';

/** Download small compressed sheets once; decode only the current and adjacent sheet. */
export function createOceanSequence(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  const perSheet = manifest.columns * manifest.rows;
  const compressed = new Map<number, Blob>();
  const decoded = new Map<number, HTMLImageElement>();
  const fetching = new Set<number>();
  const failed = new Set<number>();
  const controller = new AbortController();
  let target = 0, drawn = -1, direction = 1, raf = 0;
  let decoding = false, disposed = false, active = true;
  let width = 0, height = 0;
  let decodingImage: HTMLImageElement | null = null;
  const sheetFor = () => Math.floor(target / perSheet);
  const wantedSheets = () => [sheetFor(), sheetFor() + direction].filter(index => index >= 0 && index < manifest.sheets);
  const draw = () => {
    raf = 0;
    if (disposed || !active || document.hidden || drawn === target || !width || !height) return;
    const sheet = decoded.get(sheetFor());
    if (!sheet) return; // Keep a complete frame while the next sheet decodes.
    const frame = target % perSheet;
    const sx = (frame % manifest.columns) * manifest.width;
    const sy = Math.floor(frame / manifest.columns) * manifest.height;
    const scale = Math.max(width / manifest.width, height / manifest.height);
    const w = manifest.width * scale, h = manifest.height * scale;
    context.drawImage(sheet, sx, sy, manifest.width, manifest.height, (width - w) * 0.4, (height - h) / 2, w, h);
    drawn = target; canvas.dataset.ready = 'true';
  };
  const schedule = () => { if (!raf && !disposed) raf = requestAnimationFrame(draw); };
  const decode = async () => {
    if (disposed || !active || document.hidden || decoding) return;
    const index = wantedSheets().find(id => compressed.has(id) && !decoded.has(id) && !failed.has(id));
    if (index === undefined) return;
    decoding = true;
    const image = new Image(); decodingImage = image;
    image.decoding = 'async';
    const url = URL.createObjectURL(compressed.get(index)!);
    try {
      image.src = url;
      await image.decode(); // Decode outside drawImage; never block a scroll paint on image decoding.
      if (disposed) return;
      decoded.set(index, image);
      // At most two retained sheets, ~29 MiB decoded; one transient decode can be in flight.
      while (decoded.size > 2) {
        const stale = [...decoded.keys()].sort((a, b) => Math.abs(b - sheetFor()) - Math.abs(a - sheetFor()))[0];
        decoded.delete(stale);
      }
      schedule();
    } catch { if (!disposed) failed.add(index); }
    finally { URL.revokeObjectURL(url); decoding = false; decodingImage = null; }
    if (!disposed) void decode();
  };
  const pump = () => {
    if (disposed || !active || document.hidden) return;
    void decode();
    // Fetch the current/next sheet first, then retain the rest compressed for fast reverse scrolling.
    const candidates = [...new Set([...wantedSheets(), ...Array.from({ length: manifest.sheets }, (_, i) => i)])];
    for (const index of candidates) {
      if (fetching.size >= 2) break;
      if (compressed.has(index) || fetching.has(index) || failed.has(index)) continue;
      fetching.add(index);
      void fetch(`${manifest.base}atlas-${String(index).padStart(2, '0')}.webp`, { signal: controller.signal })
        .then(response => { if (!response.ok) throw new Error('Atlas unavailable'); return response.blob(); })
        .then(blob => { if (!disposed) compressed.set(index, blob); })
        .catch(() => { if (!disposed) failed.add(index); })
        .finally(() => { fetching.delete(index); if (!disposed) pump(); });
    }
  };
  const measure = () => {
    // CSS pixels are sufficient for a photographic backdrop. Avoid devicePixelRatio overdraw.
    const nextWidth = Math.round(canvas.clientWidth), nextHeight = Math.round(canvas.clientHeight);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth; height = nextHeight;
    canvas.width = width; canvas.height = height; drawn = -1; schedule();
  };
  const resize = new ResizeObserver(measure); resize.observe(canvas); measure();
  const visibility = () => { if (!document.hidden) { schedule(); pump(); } };
  document.addEventListener('visibilitychange', visibility);
  pump();
  return {
    update(progress: number) {
      if (disposed) return;
      const next = Math.round(Math.max(0, Math.min(1, progress)) * (manifest.count - 1));
      if (next !== target) direction = next > target ? 1 : -1;
      target = next; schedule(); pump();
    },
    setActive(value: boolean) { active = value; if (active) { schedule(); pump(); } },
    destroy() {
      disposed = true; controller.abort(); cancelAnimationFrame(raf); resize.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      if (decodingImage) decodingImage.src = '';
      compressed.clear(); decoded.clear(); failed.clear(); delete canvas.dataset.ready;
    },
  };
}
