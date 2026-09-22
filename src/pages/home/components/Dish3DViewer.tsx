import { useCallback, useEffect, useRef, useState } from 'react';

type ImageViewerProps = {
  image: string;
  title: string;
};

export default function Dish3DViewer({ image, title }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const DEFAULT_ZOOM = 0.75;
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 4)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.5)), []);
  const resetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    setPan({ x: 0, y: 0 });
  }, [DEFAULT_ZOOM]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    startRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    setPan({ x: startRef.current.px + dx, y: startRef.current.py + dy });
  }, []);

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(z + delta, 0.5), 4));
  }, []);

  useEffect(() => {
    resetZoom();
  }, [image, resetZoom]);

  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden bg-background-100 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        <img
          ref={imgRef}
          src={image}
          alt={title}
          className="w-full h-full object-contain transition-transform duration-200 ease-out select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
          draggable={false}
        />
      </div>

      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-background-50/85 backdrop-blur-sm text-foreground-700 text-xs font-semibold px-3 py-1.5 pointer-events-none whitespace-nowrap">
        <i className="ri-drag-move-line"></i>
        Arrastra para mover · rueda para zoom
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-background-50/85 backdrop-blur-sm text-foreground-700 text-xs font-semibold px-3 py-1.5 pointer-events-none whitespace-nowrap">
        <span className="text-accent-600 font-bold">{title}</span>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={zoomOut}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-background-50/90 text-foreground-800 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
          aria-label="Alejar"
        >
          <i className="ri-subtract-line"></i>
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="h-9 px-3 flex items-center justify-center rounded-full bg-background-50/90 text-xs font-bold text-foreground-800 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
          aria-label="Restablecer zoom"
        >
          {zoomPct}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-background-50/90 text-foreground-800 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
          aria-label="Acercar"
        >
          <i className="ri-add-line"></i>
        </button>
      </div>
    </div>
  );
}