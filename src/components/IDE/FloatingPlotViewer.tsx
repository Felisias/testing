import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Download,
  ZoomIn,
  ZoomOut,
  Move,
  Layers,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { CodePlot } from '../../types/extra';

interface FloatingPlotViewerProps {
  plots: CodePlot[];
  activePlotId: string;
  onSelectPlot: (plotId: string) => void;
  onClose: () => void;
  onDeletePlot?: (plotId: string) => void;
  onSendToBoard?: (plot: { name: string; dataUrl: string }) => void;
}

export const FloatingPlotViewer: React.FC<FloatingPlotViewerProps> = ({
  plots,
  activePlotId,
  onSelectPlot,
  onClose,
  onDeletePlot,
  onSendToBoard,
}) => {
  const currentPlotIndex = plots.findIndex((p) => p.id === activePlotId);
  const currentPlot = plots[currentPlotIndex] || plots[0];

  // Window position & drag state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    // Initial center-right positioning
    const defaultX = Math.max(20, window.innerWidth - 680);
    const defaultY = 70;
    return { x: defaultX, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  });

  // Zoom & presentation mode
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [boardSent, setBoardSent] = useState<boolean>(false);

  // Drag handlers
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      
      const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 150, dragStartRef.current.posY + dy));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!currentPlot) return null;

  // Copy image to clipboard
  const handleCopyImage = async () => {
    try {
      // Convert Data URL to Blob
      const res = await fetch(currentPlot.dataUrl);
      const blob = await res.blob();
      
      if (navigator.clipboard && window.ClipboardItem) {
        // Most modern browsers support copying image blob directly
        const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
        await navigator.clipboard.write([item]);
      } else {
        // Fallback: copy dataUrl string
        await navigator.clipboard.writeText(currentPlot.dataUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard write failed, attempting text fallback:', err);
      try {
        await navigator.clipboard.writeText(currentPlot.dataUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {}
    }
  };

  // Download image file
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentPlot.dataUrl;
    a.download = currentPlot.name || 'matplotlib_plot.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Send to whiteboard
  const handleSendToWhiteboard = () => {
    if (onSendToBoard) {
      onSendToBoard({
        name: currentPlot.name,
        dataUrl: currentPlot.dataUrl,
      });
      setBoardSent(true);
      setTimeout(() => setBoardSent(false), 2500);
    }
  };

  return (
    <div
      id="floating-plot-viewer"
      className={`fixed z-50 transition-shadow select-none ${
        isFullscreen
          ? 'inset-4 w-[calc(100%-32px)] h-[calc(100%-32px)] flex flex-col'
          : 'w-[620px] max-w-[calc(100vw-30px)] shadow-2xl rounded-2xl flex flex-col border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl'
      }`}
      style={
        isFullscreen
          ? { transform: 'none' }
          : {
              left: `${position.x}px`,
              top: `${position.y}px`,
            }
      }
    >
      {/* Header bar (Drag Handle) */}
      <div
        onMouseDown={handleMouseDownHeader}
        className={`px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800 rounded-t-2xl flex items-center justify-between gap-2 text-slate-200 ${
          isFullscreen ? '' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 bg-amber-500/10 rounded-lg border border-amber-500/30 text-amber-400 shrink-0">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="truncate">
            <span className="font-semibold text-xs text-white block truncate">
              {currentPlot.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              График {currentPlotIndex + 1} из {plots.length}
              {currentPlot.size ? ` • ${Math.round(currentPlot.size / 1024)} КБ` : ''}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Whiteboard Quick Insert */}
          {onSendToBoard && (
            <button
              onClick={handleSendToWhiteboard}
              title="Вставить график на интерактивную доску занятия"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                boardSent
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-indigo-600/90 hover:bg-indigo-500 text-white border-indigo-400/40 shadow-xs'
              }`}
            >
              {boardSent ? <Check className="w-3.5 h-3.5 text-white" /> : <Layers className="w-3.5 h-3.5" />}
              <span>{boardSent ? 'На доске ✓' : 'На доску'}</span>
            </button>
          )}

          {/* Copy to clipboard */}
          <button
            onClick={handleCopyImage}
            title="Скопировать изображение в буфер обмена"
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
              copied
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            title="Скачать изображение графика (PNG)"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Свернуть окно' : 'Раскрыть на весь экран'}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            title="Закрыть просмотрщик"
            className="p-1.5 bg-slate-800 hover:bg-rose-900/80 text-slate-400 hover:text-rose-200 rounded-lg border border-slate-700 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Image Canvas Body */}
      <div className="relative flex-1 bg-slate-950 flex items-center justify-center p-4 overflow-hidden min-h-[320px] max-h-[70vh]">
        {/* Transparent check pattern behind image */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#94a3b8 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
          }}
        />

        <div className="relative max-w-full max-h-full flex items-center justify-center overflow-auto">
          <img
            src={currentPlot.dataUrl}
            alt={currentPlot.name}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
            className="rounded-lg shadow-xl transition-transform duration-100 max-h-[500px] object-contain border border-slate-800 bg-white"
          />
        </div>

        {/* Multi-plot navigation arrows */}
        {plots.length > 1 && (
          <>
            <button
              onClick={() => {
                const prev = (currentPlotIndex - 1 + plots.length) % plots.length;
                onSelectPlot(plots[prev].id);
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 shadow-lg transition"
              title="Предыдущий график"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const next = (currentPlotIndex + 1) % plots.length;
                onSelectPlot(plots[next].id);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 shadow-lg transition"
              title="Следующий график"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Floating Zoom & Controls Bar */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-2.5 py-1 shadow-xl backdrop-blur-md">
          <button
            onClick={() => setZoomLevel((z) => Math.max(40, z - 20))}
            title="Уменьшить"
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(100)}
            title="Сбросить масштаб 100%"
            className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-amber-400 hover:bg-slate-800 rounded transition"
          >
            {zoomLevel}%
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.min(250, z + 20))}
            title="Увеличить"
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {onDeletePlot && (
            <>
              <div className="w-[1px] h-3.5 bg-slate-700 mx-0.5" />
              <button
                onClick={() => onDeletePlot(currentPlot.id)}
                title="Удалить этот график"
                className="p-1 hover:bg-rose-900/60 rounded text-slate-400 hover:text-rose-300 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Plot Thumbnails Strip (if multiple plots) */}
      {plots.length > 1 && (
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto rounded-b-2xl">
          {plots.map((plot, idx) => (
            <button
              key={plot.id}
              onClick={() => onSelectPlot(plot.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition shrink-0 ${
                plot.id === currentPlot.id
                  ? 'bg-amber-950/60 border-amber-500/80 text-amber-300 shadow-xs'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <img
                src={plot.dataUrl}
                alt={plot.name}
                className="w-5 h-5 rounded object-cover border border-slate-700 bg-white"
              />
              <span className="font-mono text-[11px] truncate max-w-[90px]">{plot.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
