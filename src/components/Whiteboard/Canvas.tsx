import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ToolType,
  BackgroundType,
  WhiteboardElement,
  StrokeElement,
  ShapeElement,
  TextElement,
  ImageElement,
  Point,
  LaserPoint,
  CursorPosition,
  UserRole,
  ToolSpecificSettings,
  DEFAULT_TOOL_SETTINGS,
} from '../../types';
import { getSocket } from '../../services/socket';
import { Sparkles, Trash2, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CanvasProps {
  tool: ToolType;
  toolSettings?: ToolSpecificSettings;
  color?: string;
  strokeWidth?: number;
  background: BackgroundType;
  elements: WhiteboardElement[];
  setElements: React.Dispatch<React.SetStateAction<WhiteboardElement[]>>;
  pageIndex: number;
  isLocked: boolean;
  userRole: UserRole;
  userName: string;
  userColor: string;
  zoom: number;
  setZoom: (z: number | ((prev: number) => number)) => void;
  panOffset: Point;
  setPanOffset: React.Dispatch<React.SetStateAction<Point>>;
  cursors: Record<string, CursorPosition>;
  laserPoints: LaserPoint[];
  addLaserPoint: (p: LaserPoint) => void;
  activeMathInsert?: string;
  onMathInserted?: () => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  tool,
  toolSettings = DEFAULT_TOOL_SETTINGS,
  background,
  elements,
  setElements,
  pageIndex,
  isLocked,
  userRole,
  userName,
  userColor,
  zoom,
  setZoom,
  panOffset,
  setPanOffset,
  cursors,
  laserPoints,
  addLaserPoint,
  activeMathInsert,
  onMathInserted,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [shapeEnd, setShapeEnd] = useState<Point | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
  const [elementOriginalPos, setElementOriginalPos] = useState<Point | null>(null);
  const dragOriginalElementRef = useRef<WhiteboardElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const copiedElementRef = useRef<WhiteboardElement | null>(null);
  const mouseWorldPosRef = useRef<Point>({ x: 0, y: 0 });

  // Text inline input state
  const [textInputPos, setTextInputPos] = useState<Point | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const canEdit = !isLocked || userRole === 'tutor';

  // Compute active tool settings independently
  const activeColor = (() => {
    if (tool === 'pen') return toolSettings.pen.color;
    if (tool === 'highlighter') return toolSettings.highlighter.color;
    if (['line', 'arrow', 'rect', 'circle', 'triangle', 'coordSystem'].includes(tool)) {
      return toolSettings.shapes.color;
    }
    if (tool === 'text') return toolSettings.text.color;
    return '#2563EB';
  })();

  const activeStrokeWidth = (() => {
    if (tool === 'pen') return toolSettings.pen.strokeWidth;
    if (tool === 'highlighter') return toolSettings.highlighter.strokeWidth;
    if (tool === 'eraser') return toolSettings.eraser.strokeWidth;
    if (['line', 'arrow', 'rect', 'circle', 'triangle', 'coordSystem'].includes(tool)) {
      return toolSettings.shapes.strokeWidth;
    }
    return 2;
  })();

  const activeFontSize = toolSettings.text.fontSize || 24;

  // Handle incoming activeMathInsert into text
  useEffect(() => {
    if (activeMathInsert && textInputPos) {
      setTextInputValue((prev) => prev + activeMathInsert);
      onMathInserted?.();
      textInputRef.current?.focus();
    }
  }, [activeMathInsert, textInputPos, onMathInserted]);

  // Convert client viewport coordinates to canvas virtual coordinates
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - panOffset.x) / zoom;
      const y = (clientY - rect.top - panOffset.y) / zoom;
      return { x, y };
    },
    [panOffset, zoom]
  );

  // Focus text input when opened
  useEffect(() => {
    if (textInputPos && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInputPos]);

  // Main rendering loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cssWidth = canvas.width / dpr;
    const cssHeight = canvas.height / dpr;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Draw background color
    if (background === 'dark-grid') {
      ctx.fillStyle = '#1E293B'; // Dark Slate chalkboard
    } else {
      ctx.fillStyle = '#FFFFFF';
    }
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Apply Pan & Zoom transformation
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw Grid patterns
    const isDark = background === 'dark-grid';
    const gridMajorColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(59, 130, 246, 0.18)';
    const gridMinorColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.08)';

    // Visible world bounds
    const startX = -panOffset.x / zoom;
    const startY = -panOffset.y / zoom;
    const endX = (cssWidth - panOffset.x) / zoom;
    const endY = (cssHeight - panOffset.y) / zoom;

    if (background === 'grid' || background === 'dark-grid') {
      const gridSize = 25; // 25px math square
      const majorStep = 5;

      const firstX = Math.floor(startX / gridSize) * gridSize;
      const firstY = Math.floor(startY / gridSize) * gridSize;

      ctx.lineWidth = 1 / zoom;

      for (let x = firstX; x <= endX; x += gridSize) {
        const isMajor = Math.round(x / gridSize) % majorStep === 0;
        ctx.strokeStyle = isMajor ? gridMajorColor : gridMinorColor;
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }

      for (let y = firstY; y <= endY; y += gridSize) {
        const isMajor = Math.round(y / gridSize) % majorStep === 0;
        ctx.strokeStyle = isMajor ? gridMajorColor : gridMinorColor;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    } else if (background === 'dots') {
      const dotSpacing = 24;
      const firstX = Math.floor(startX / dotSpacing) * dotSpacing;
      const firstY = Math.floor(startY / dotSpacing) * dotSpacing;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(100, 116, 139, 0.35)';

      for (let x = firstX; x <= endX; x += dotSpacing) {
        for (let y = firstY; y <= endY; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2 / Math.min(zoom, 1.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (background === 'lines') {
      const lineSpacing = 32;
      const firstY = Math.floor(startY / lineSpacing) * lineSpacing;
      ctx.lineWidth = 1 / zoom;
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(59, 130, 246, 0.15)';

      for (let y = firstY; y <= endY; y += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    }

    // Render All Elements
    elements.forEach((el) => {
      ctx.save();
      const isSelected = selectedElementId === el.id;

      if (el.type === 'stroke') {
        const stroke = el as StrokeElement;
        if (stroke.points.length < 2) {
          ctx.restore();
          return;
        }

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = stroke.opacity || 1;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

        // Smooth curve through midpoints
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
          const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
        }

        // Connect to last point
        const lastIdx = stroke.points.length - 1;
        ctx.lineTo(stroke.points[lastIdx].x, stroke.points[lastIdx].y);
        ctx.stroke();
      } else if (el.type === 'shape') {
        const shape = el as ShapeElement;
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = shape.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (shape.fillColor) ctx.fillStyle = shape.fillColor;

        const x = shape.x;
        const y = shape.y;
        const w = shape.width;
        const h = shape.height;

        if (shape.shapeType === 'rect') {
          if (shape.fillColor) ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        } else if (shape.shapeType === 'circle') {
          ctx.beginPath();
          const radiusX = Math.abs(w) / 2;
          const radiusY = Math.abs(h) / 2;
          const centerX = x + w / 2;
          const centerY = y + h / 2;
          ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
          if (shape.fillColor) ctx.fill();
          ctx.stroke();
        } else if (shape.shapeType === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w, y + h);
          ctx.lineTo(x, y + h);
          ctx.closePath();
          if (shape.fillColor) ctx.fill();
          ctx.stroke();
        } else if (shape.shapeType === 'line') {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y + h);
          ctx.stroke();
        } else if (shape.shapeType === 'arrow') {
          const fromX = x;
          const fromY = y;
          const toX = x + w;
          const toY = y + h;
          const headlen = Math.max(12, shape.strokeWidth * 3);
          const angle = Math.atan2(toY - fromY, toX - fromX);

          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          // Arrow head
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(
            toX - headlen * Math.cos(angle - Math.PI / 6),
            toY - headlen * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(toX, toY);
          ctx.lineTo(
            toX - headlen * Math.cos(angle + Math.PI / 6),
            toY - headlen * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        } else if (shape.shapeType === 'coordSystem') {
          // Mathematical XY Coordinate System with ticks and origin
          const cx = x + w / 2;
          const cy = y + h / 2;
          const arrowSize = 10;

          // X-Axis
          ctx.beginPath();
          ctx.moveTo(x, cy);
          ctx.lineTo(x + w, cy);
          ctx.stroke();

          // X arrow
          ctx.beginPath();
          ctx.moveTo(x + w, cy);
          ctx.lineTo(x + w - arrowSize, cy - arrowSize / 2);
          ctx.moveTo(x + w, cy);
          ctx.lineTo(x + w - arrowSize, cy + arrowSize / 2);
          ctx.stroke();

          // Y-Axis
          ctx.beginPath();
          ctx.moveTo(cx, y + h);
          ctx.lineTo(cx, y);
          ctx.stroke();

          // Y arrow
          ctx.beginPath();
          ctx.moveTo(cx, y);
          ctx.lineTo(cx - arrowSize / 2, y + arrowSize);
          ctx.moveTo(cx, y);
          ctx.lineTo(cx + arrowSize / 2, y + arrowSize);
          ctx.stroke();

          // Labels
          ctx.font = 'bold 13px system-ui, sans-serif';
          ctx.fillStyle = shape.strokeColor;
          ctx.fillText('X', x + w - 14, cy + 18);
          ctx.fillText('Y', cx + 10, y + 14);
          ctx.fillText('0', cx - 14, cy + 16);

          // Grid ticks every 25px
          const tickStep = 25;
          ctx.lineWidth = 1;
          for (let tx = cx + tickStep; tx < x + w - 15; tx += tickStep) {
            ctx.beginPath();
            ctx.moveTo(tx, cy - 3);
            ctx.lineTo(tx, cy + 3);
            ctx.stroke();
          }
          for (let tx = cx - tickStep; tx > x + 15; tx -= tickStep) {
            ctx.beginPath();
            ctx.moveTo(tx, cy - 3);
            ctx.lineTo(tx, cy + 3);
            ctx.stroke();
          }
          for (let ty = cy + tickStep; ty < y + h - 15; ty += tickStep) {
            ctx.beginPath();
            ctx.moveTo(cx - 3, ty);
            ctx.lineTo(cx + 3, ty);
            ctx.stroke();
          }
          for (let ty = cy - tickStep; ty > y + 15; ty -= tickStep) {
            ctx.beginPath();
            ctx.moveTo(cx - 3, ty);
            ctx.lineTo(cx + 3, ty);
            ctx.stroke();
          }
        }
      } else if (el.type === 'text') {
        const textEl = el as TextElement;
        ctx.font = `${textEl.fontWeight || 'normal'} ${textEl.fontSize || 20}px 'SF Pro Display', system-ui, sans-serif`;
        ctx.fillStyle = textEl.color;
        ctx.textBaseline = 'top';

        const lines = textEl.text.split('\n');
        const lineHeight = (textEl.fontSize || 20) * 1.35;

        lines.forEach((line, index) => {
          ctx.fillText(line, textEl.x, textEl.y + index * lineHeight);
        });
      } else if (el.type === 'image') {
        const imgEl = el as ImageElement;
        let img = imageCacheRef.current.get(imgEl.src);
        if (!img) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            render();
          };
          img.src = imgEl.src;
          imageCacheRef.current.set(imgEl.src, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, imgEl.x, imgEl.y, imgEl.width, imgEl.height);
        }
      }

      // Selection bounding box
      if (isSelected) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        const bounds = getElementBounds(el);
        ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });

    // Render Current In-Progress Stroke
    if (isDrawing && currentStroke.length > 1) {
      ctx.save();
      const isHighlighter = tool === 'highlighter';
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeStrokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = isHighlighter ? 0.4 : 1;

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length - 1; i++) {
        const xc = (currentStroke[i].x + currentStroke[i + 1].x) / 2;
        const yc = (currentStroke[i].y + currentStroke[i + 1].y) / 2;
        ctx.quadraticCurveTo(currentStroke[i].x, currentStroke[i].y, xc, yc);
      }
      const lastIdx = currentStroke.length - 1;
      ctx.lineTo(currentStroke[lastIdx].x, currentStroke[lastIdx].y);
      ctx.stroke();
      ctx.restore();
    }

    // Render Current In-Progress Shape
    if (isDrawing && shapeStart && shapeEnd) {
      ctx.save();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeStrokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const x = Math.min(shapeStart.x, shapeEnd.x);
      const y = Math.min(shapeStart.y, shapeEnd.y);
      const w = Math.abs(shapeEnd.x - shapeStart.x);
      const h = Math.abs(shapeEnd.y - shapeStart.y);

      if (tool === 'rect') {
        ctx.strokeRect(x, y, w, h);
      } else if (tool === 'circle') {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.stroke();
      } else if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(shapeStart.x, shapeStart.y);
        ctx.lineTo(shapeEnd.x, shapeEnd.y);
        ctx.stroke();
      } else if (tool === 'arrow') {
        const fromX = shapeStart.x;
        const fromY = shapeStart.y;
        const toX = shapeEnd.x;
        const toY = shapeEnd.y;
        const headlen = Math.max(12, activeStrokeWidth * 3);
        const angle = Math.atan2(toY - fromY, toX - fromX);

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (tool === 'coordSystem') {
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.beginPath();
        ctx.moveTo(x, cy);
        ctx.lineTo(x + w, cy);
        ctx.moveTo(cx, y + h);
        ctx.lineTo(cx, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render Laser Pointer Trails
    const now = Date.now();
    laserPoints.forEach((lp) => {
      const age = now - lp.timestamp;
      if (age < 1500) {
        const alpha = 1 - age / 1500;
        ctx.save();
        ctx.fillStyle = lp.color || '#EF4444';
        ctx.shadowColor = lp.color || '#EF4444';
        ctx.shadowBlur = 15;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 6 / zoom, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing glow ring
        ctx.strokeStyle = lp.color || '#EF4444';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, (10 + (age / 1500) * 15) / zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });

    ctx.restore(); // Restore world transform
  }, [
    background,
    elements,
    isDrawing,
    currentStroke,
    shapeStart,
    shapeEnd,
    laserPoints,
    panOffset,
    zoom,
    tool,
    activeColor,
    activeStrokeWidth,
    selectedElementId,
  ]);

  // Sync canvas size to container
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = containerRef.current.getBoundingClientRect();
      const canvas = canvasRef.current;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      render();
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [render]);

  // Request animation frame loop for laser animations
  useEffect(() => {
    let animationId: number;
    const loop = () => {
      render();
      if (laserPoints.length > 0) {
        animationId = requestAnimationFrame(loop);
      }
    };
    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [render, laserPoints]);

  function getElementBounds(el: WhiteboardElement): { x: number; y: number; width: number; height: number } {
    if (el.type === 'stroke') {
      const stroke = el as StrokeElement;
      if (!stroke.points.length) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      stroke.points.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      return { x: minX, y: minY, width: maxX - minX || 10, height: maxY - minY || 10 };
    } else if (el.type === 'shape') {
      const s = el as ShapeElement;
      return { x: s.x, y: s.y, width: s.width, height: s.height };
    } else if (el.type === 'text') {
      const t = el as TextElement;
      const lines = t.text.split('\n');
      const maxLen = Math.max(...lines.map((l) => l.length), 1);
      return {
        x: t.x,
        y: t.y,
        width: maxLen * (t.fontSize * 0.6),
        height: lines.length * (t.fontSize * 1.35),
      };
    } else if (el.type === 'image') {
      const img = el as ImageElement;
      return { x: img.x, y: img.y, width: img.width, height: img.height };
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    // Pan with Right Mouse Button (button === 2), middle click (button === 1), or with Pan tool
    if (e.button === 2 || e.button === 1 || tool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (!canEdit && tool !== 'laser') return;

    // Laser pointer
    if (tool === 'laser') {
      const lp: LaserPoint = {
        userId: 'self',
        userName,
        color: userColor,
        x: worldPoint.x,
        y: worldPoint.y,
        timestamp: Date.now(),
      };
      addLaserPoint(lp);
      getSocket().emit('board:laser', { x: worldPoint.x, y: worldPoint.y, pageIndex });
      return;
    }

    // Text tool
    if (tool === 'text') {
      // Finalize previous text if open
      if (textInputPos && textInputValue.trim()) {
        finalizeText();
      }
      setTextInputPos(worldPoint);
      setTextInputValue('');
      return;
    }

    // Select Tool: check if clicked an element
    if (tool === 'select') {
      const hit = [...elements].reverse().find((el) => {
        const bounds = getElementBounds(el);
        return (
          worldPoint.x >= bounds.x - 6 &&
          worldPoint.x <= bounds.x + bounds.width + 6 &&
          worldPoint.y >= bounds.y - 6 &&
          worldPoint.y <= bounds.y + bounds.height + 6
        );
      });

      if (hit) {
        setSelectedElementId(hit.id);
        setIsDraggingElement(true);
        setDragStartPoint(worldPoint);
        dragOriginalElementRef.current = JSON.parse(JSON.stringify(hit));
        setElementOriginalPos({ x: (hit as any).x || 0, y: (hit as any).y || 0 });
      } else {
        setSelectedElementId(null);
      }
      return;
    }

    // Eraser Tool
    if (tool === 'eraser') {
      eraseAtPoint(worldPoint);
      setIsDrawing(true);
      return;
    }

    // Pen & Highlighter
    if (tool === 'pen' || tool === 'highlighter') {
      setIsDrawing(true);
      setCurrentStroke([worldPoint]);
      return;
    }

    // Shapes
    if (['rect', 'circle', 'triangle', 'line', 'arrow', 'coordSystem'].includes(tool)) {
      setIsDrawing(true);
      setShapeStart(worldPoint);
      setShapeEnd(worldPoint);
      return;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const worldPoint = screenToWorld(e.clientX, e.clientY);
    mouseWorldPosRef.current = worldPoint;

    // Broadcast cursor movement for real-time multiplayer cursors
    getSocket().emit('cursor:move', { x: worldPoint.x, y: worldPoint.y, pageIndex });

    if (isPanning || (e.buttons & 2) === 2) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (tool === 'laser' && e.buttons === 1) {
      const lp: LaserPoint = {
        userId: 'self',
        userName,
        color: userColor,
        x: worldPoint.x,
        y: worldPoint.y,
        timestamp: Date.now(),
      };
      addLaserPoint(lp);
      getSocket().emit('board:laser', { x: worldPoint.x, y: worldPoint.y, pageIndex });
      return;
    }

    if (!canEdit) return;

    if (isDraggingElement && selectedElementId && dragStartPoint && dragOriginalElementRef.current) {
      const dx = worldPoint.x - dragStartPoint.x;
      const dy = worldPoint.y - dragStartPoint.y;
      const orig = dragOriginalElementRef.current;

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== selectedElementId) return el;
          if (orig.type === 'stroke') {
            const stroke = orig as StrokeElement;
            const updatedPoints = stroke.points.map((p) => ({
              x: p.x + dx,
              y: p.y + dy,
            }));
            return { ...stroke, points: updatedPoints };
          }
          return {
            ...orig,
            x: ((orig as any).x || 0) + dx,
            y: ((orig as any).y || 0) + dy,
          } as WhiteboardElement;
        })
      );
      return;
    }

    if (isDrawing && tool === 'eraser') {
      eraseAtPoint(worldPoint);
      return;
    }

    if (isDrawing && (tool === 'pen' || tool === 'highlighter')) {
      setCurrentStroke((prev) => [...prev, worldPoint]);
      return;
    }

    if (isDrawing && shapeStart) {
      setShapeEnd(worldPoint);
      return;
    }
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    if (isPanning || (e && e.button === 2)) {
      setIsPanning(false);
      return;
    }

    if (isDraggingElement && selectedElementId) {
      setIsDraggingElement(false);
      const updated = elements.find((el) => el.id === selectedElementId);
      if (updated) {
        getSocket().emit('board:element:update', { element: updated, pageIndex });
      }
      setDragStartPoint(null);
      setElementOriginalPos(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    // Save pen/highlighter stroke
    if ((tool === 'pen' || tool === 'highlighter') && currentStroke.length > 0) {
      const strokeColor = tool === 'highlighter' ? toolSettings.highlighter.color : toolSettings.pen.color;
      const strokeW = tool === 'highlighter' ? toolSettings.highlighter.strokeWidth : toolSettings.pen.strokeWidth;

      const newStroke: StrokeElement = {
        id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        userId: 'self',
        userName,
        userColor,
        type: 'stroke',
        tool: tool as 'pen' | 'highlighter',
        points: currentStroke,
        color: strokeColor,
        strokeWidth: strokeW,
        opacity: tool === 'highlighter' ? 0.4 : 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setElements((prev) => [...prev, newStroke]);
      getSocket().emit('board:element:create', { element: newStroke, pageIndex });
      setCurrentStroke([]);
    }

    // Save shapes
    if (shapeStart && shapeEnd) {
      let x = Math.min(shapeStart.x, shapeEnd.x);
      let y = Math.min(shapeStart.y, shapeEnd.y);
      let width = Math.abs(shapeEnd.x - shapeStart.x);
      let height = Math.abs(shapeEnd.y - shapeStart.y);

      if (tool === 'line' || tool === 'arrow') {
        x = shapeStart.x;
        y = shapeStart.y;
        width = shapeEnd.x - shapeStart.x;
        height = shapeEnd.y - shapeStart.y;
      }

      if (Math.abs(width) > 3 || Math.abs(height) > 3) {
        const newShape: ShapeElement = {
          id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          userId: 'self',
          userName,
          userColor,
          type: 'shape',
          shapeType: tool as any,
          x,
          y,
          width,
          height,
          strokeColor: toolSettings.shapes.color,
          strokeWidth: toolSettings.shapes.strokeWidth,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        setElements((prev) => [...prev, newShape]);
        getSocket().emit('board:element:create', { element: newShape, pageIndex });
      }

      setShapeStart(null);
      setShapeEnd(null);
    }
  };

  const eraseAtPoint = (worldPoint: Point) => {
    const eraserRadius = (toolSettings.eraser.strokeWidth || 16) * 2;
    const toDeleteIds: string[] = [];

    elements.forEach((el) => {
      const bounds = getElementBounds(el);
      const isNear =
        worldPoint.x >= bounds.x - eraserRadius &&
        worldPoint.x <= bounds.x + bounds.width + eraserRadius &&
        worldPoint.y >= bounds.y - eraserRadius &&
        worldPoint.y <= bounds.y + bounds.height + eraserRadius;

      if (isNear) {
        if (el.type === 'stroke') {
          const stroke = el as StrokeElement;
          const hit = stroke.points.some((p) => {
            const dist = Math.hypot(p.x - worldPoint.x, p.y - worldPoint.y);
            return dist <= eraserRadius + stroke.strokeWidth / 2;
          });
          if (hit) toDeleteIds.push(el.id);
        } else {
          toDeleteIds.push(el.id);
        }
      }
    });

    if (toDeleteIds.length > 0) {
      const deleteSet = new Set(toDeleteIds);
      setElements((prev) => prev.filter((el) => !deleteSet.has(el.id)));
      getSocket().emit('board:elements:deleteBatch', { elementIds: toDeleteIds, pageIndex });
    }
  };

  const finalizeText = () => {
    if (!textInputPos || !textInputValue.trim()) {
      setTextInputPos(null);
      setTextInputValue('');
      return;
    }

    const newText: TextElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: 'self',
      userName,
      userColor,
      type: 'text',
      x: textInputPos.x,
      y: textInputPos.y,
      text: textInputValue,
      fontSize: activeFontSize,
      color: toolSettings.text.color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setElements((prev) => [...prev, newText]);
    getSocket().emit('board:element:create', { element: newText, pageIndex });
    setTextInputPos(null);
    setTextInputValue('');
  };

  // Zoom and Pan with Mouse Wheel (Smooth, cursor-anchored)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Shift key pans horizontally
    if (e.shiftKey) {
      setPanOffset((prev) => ({
        x: prev.x - e.deltaY,
        y: prev.y,
      }));
      return;
    }

    // Intuitive zoom step centered at cursor
    const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
    const newZoom = Math.min(4.0, Math.max(0.2, zoom * zoomFactor));

    if (Math.abs(newZoom - zoom) > 0.001) {
      const worldX = (mouseX - panOffset.x) / zoom;
      const worldY = (mouseY - panOffset.y) / zoom;

      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;

      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    }
  };

  // Delete selected element
  const deleteSelected = () => {
    if (!selectedElementId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedElementId));
    getSocket().emit('board:element:delete', { elementId: selectedElementId, pageIndex });
    setSelectedElementId(null);
  };

  // Clipboard Image Pasting and Element Copy / Paste (Ctrl+C / Ctrl+V)
  useEffect(() => {
    const processImageSource = (src: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCacheRef.current.set(src, img);
        let width = img.naturalWidth || 400;
        let height = img.naturalHeight || 300;
        const maxDim = 500;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        let targetPos = mouseWorldPosRef.current;
        if (!targetPos || (targetPos.x === 0 && targetPos.y === 0)) {
          const container = containerRef.current;
          const cx = container ? container.clientWidth / 2 : window.innerWidth / 2;
          const cy = container ? container.clientHeight / 2 : window.innerHeight / 2;
          targetPos = screenToWorld(cx, cy);
        }

        const newImg: ImageElement = {
          id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          userId: 'self',
          userName,
          userColor,
          type: 'image',
          src,
          x: Math.round(targetPos.x - width / 2),
          y: Math.round(targetPos.y - height / 2),
          width,
          height,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        setElements((prev) => [...prev, newImg]);
        getSocket().emit('board:element:create', { element: newImg, pageIndex });
        setSelectedElementId(newImg.id);
        render();
      };
      img.src = src;
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        target !== textInputRef.current
      ) {
        return;
      }

      if (!canEdit) return;

      // 1. Check for Image in clipboard files
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (event) => {
              const src = event.target?.result as string;
              if (src) processImageSource(src);
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }

      // 2. Check for Image in clipboard items
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              const reader = new FileReader();
              reader.onload = (event) => {
                const src = event.target?.result as string;
                if (src) processImageSource(src);
              };
              reader.readAsDataURL(blob);
              return;
            }
          }
        }
      }

      // 3. Check for HTML containing an <img> tag or direct image link in text
      const html = e.clipboardData?.getData('text/html');
      if (html) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
          e.preventDefault();
          processImageSource(match[1]);
          return;
        }
      }

      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text && (text.startsWith('data:image/') || text.match(/^https?:\/\/.*\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i))) {
        e.preventDefault();
        processImageSource(text);
        return;
      }

      // 4. Check for copied internal whiteboard element
      if (copiedElementRef.current) {
        e.preventDefault();
        const orig = copiedElementRef.current;
        const newId = `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        let cloned: WhiteboardElement;
        if (orig.type === 'stroke') {
          const st = orig as StrokeElement;
          cloned = {
            ...st,
            id: newId,
            points: st.points.map((p) => ({ x: p.x + 30, y: p.y + 30 })),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        } else {
          cloned = {
            ...orig,
            id: newId,
            x: ((orig as any).x || 0) + 30,
            y: ((orig as any).y || 0) + 30,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as WhiteboardElement;
        }

        setElements((prev) => [...prev, cloned]);
        getSocket().emit('board:element:create', { element: cloned, pageIndex });
        setSelectedElementId(newId);
        copiedElementRef.current = cloned;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        target !== textInputRef.current
      ) {
        return;
      }

      // Copy element: Ctrl+C / Cmd+C (supporting English 'c' and Russian 'с' key)
      const isC = e.code === 'KeyC' || e.key.toLowerCase() === 'c' || e.key === 'с' || e.key === 'С';
      if ((e.ctrlKey || e.metaKey) && isC && selectedElementId) {
        const el = elements.find((item) => item.id === selectedElementId);
        if (el) {
          copiedElementRef.current = JSON.parse(JSON.stringify(el));
        }
      }

      // Delete element: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId && !textInputPos) {
        e.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canEdit, selectedElementId, elements, pageIndex, userName, userColor, textInputPos, screenToWorld]);

  return (
    <div
      ref={containerRef}
      id="tutorboard-canvas-container"
      className="relative w-full h-full overflow-hidden select-none bg-slate-100 touch-none cursor-crosshair"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      style={{
        cursor:
          tool === 'pan' || isPanning
            ? 'grab'
            : tool === 'eraser'
            ? 'crosshair'
            : tool === 'laser'
            ? 'cell'
            : tool === 'select'
            ? 'default'
            : 'crosshair',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Real-time Multiplayer Cursors */}
      {(Object.values(cursors) as CursorPosition[]).map((cur) => {
        if (cur.userId === 'self') return null;
        const screenX = cur.x * zoom + panOffset.x;
        const screenY = cur.y * zoom + panOffset.y;

        return (
          <div
            key={cur.userId}
            className="absolute pointer-events-none transition-transform duration-75 flex items-start gap-1 z-30"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
            }}
          >
            <svg
              className="w-4 h-4 drop-shadow"
              viewBox="0 0 24 24"
              fill={cur.color || '#3B82F6'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            >
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" />
            </svg>
            <span
              className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-white shadow-md whitespace-nowrap flex items-center gap-1"
              style={{ backgroundColor: cur.color || '#3B82F6' }}
            >
              <span>{cur.avatar || (cur.role === 'tutor' ? '👨‍🏫' : '🎓')}</span>
              <span>{cur.userName}</span>
            </span>
          </div>
        );
      })}

      {/* Selected Element Action Floating Bar */}
      {selectedElementId && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/80 rounded-xl px-4 py-2 flex items-center gap-3 z-40 animate-in fade-in"
        >
          <span className="text-xs font-medium text-slate-600">Элемент выбран</span>
          <button
            onClick={deleteSelected}
            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            Удалить
          </button>
        </div>
      )}

      {/* Inline Text Input Overlay */}
      {textInputPos && (
        <div
          className="absolute z-50"
          style={{
            left: `${textInputPos.x * zoom + panOffset.x}px`,
            top: `${textInputPos.y * zoom + panOffset.y}px`,
          }}
        >
          <div className="bg-white rounded-lg shadow-xl border-2 border-blue-500 p-2 flex flex-col gap-2 min-w-[240px]">
            <textarea
              ref={textInputRef}
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              placeholder="Введите текст или формулу..."
              rows={2}
              className="w-full text-slate-800 font-sans text-sm focus:outline-none resize-none bg-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  finalizeText();
                } else if (e.key === 'Escape') {
                  setTextInputPos(null);
                  setTextInputValue('');
                }
              }}
            />
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-[10px] text-slate-600">Enter - готово, Esc - отмена</span>
              <button
                onClick={finalizeText}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Control Overlay at Bottom-Right */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-xl p-1 flex items-center gap-1 z-30">
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
          title="Уменьшить"
          className="p-1.5 hover:bg-slate-100 text-slate-700 rounded-lg transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-slate-700 w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
          title="Увеличить"
          className="p-1.5 hover:bg-slate-100 text-slate-700 rounded-lg transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPanOffset({ x: 0, y: 0 });
          }}
          title="Сбросить масштаб и вид"
          className="p-1.5 hover:bg-slate-100 text-slate-700 rounded-lg transition ml-0.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lock Notice if Student and locked */}
      {isLocked && userRole === 'student' && (
        <div className="absolute top-4 left-4 bg-amber-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 pointer-events-none z-30">
          <span>🔒 Доска заблокирована преподавателем для объяснения материала</span>
        </div>
      )}
    </div>
  );
};
