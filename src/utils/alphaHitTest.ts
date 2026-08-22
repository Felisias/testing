// Pixel-perfect alpha hit-testing utility for transparent PNGs and irregular tool shapes
import type React from 'react';

interface CachedImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  aspectRatio: number;
}

const imageAlphaCache = new Map<string, CachedImageData>();
const imageLoadingPromises = new Map<string, Promise<CachedImageData | null>>();

/**
 * Pre-warms and caches the alpha channel ImageData of a transparent image.
 */
export function preloadImageAlpha(src: string): Promise<CachedImageData | null> {
  if (!src) return Promise.resolve(null);
  if (imageAlphaCache.has(src)) {
    return Promise.resolve(imageAlphaCache.get(src)!);
  }
  if (imageLoadingPromises.has(src)) {
    return imageLoadingPromises.get(src)!;
  }

  const promise = new Promise<CachedImageData | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;

        if (!naturalW || !naturalH) {
          resolve(null);
          return;
        }

        // Limit size for optimal memory & lookup speed (max 300px)
        const scale = Math.min(1, 300 / Math.max(naturalW, naturalH));
        const width = Math.max(1, Math.round(naturalW * scale));
        const height = Math.max(1, Math.round(naturalH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const cached: CachedImageData = {
          width,
          height,
          data: imgData.data,
          aspectRatio: naturalW / naturalH,
        };

        imageAlphaCache.set(src, cached);
        resolve(cached);
      } catch (err) {
        console.warn('Failed to extract alpha data from image:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = src;
  });

  imageLoadingPromises.set(src, promise);
  return promise;
}

/**
 * Synchronous pixel alpha lookup from cache (0..255).
 * Returns -1 if image is not yet cached.
 */
export function getCachedPixelAlpha(
  src: string,
  normX: number, // 0.0 to 1.0
  normY: number  // 0.0 to 1.0
): number {
  if (normX < 0 || normX > 1 || normY < 0 || normY > 1) {
    return 0; // Outside image boundary
  }

  const cached = imageAlphaCache.get(src);
  if (!cached) {
    // If not yet in cache, trigger async load
    preloadImageAlpha(src);
    return -1; // Unknown / fallback to true
  }

  const px = Math.min(cached.width - 1, Math.max(0, Math.floor(normX * cached.width)));
  const py = Math.min(cached.height - 1, Math.max(0, Math.floor(normY * cached.height)));
  const index = (py * cached.width + px) * 4 + 3; // Alpha channel byte

  return cached.data[index] ?? 0;
}

/**
 * Checks whether a screen coordinate (clientX, clientY) hits a non-transparent pixel
 * of a transformed custom image or procedural tool stationery item.
 */
export function isPointInToolShape(
  clientX: number,
  clientY: number,
  element: HTMLElement,
  customImageSrc?: string,
  rotationDeg: number = 0
): boolean {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;

  // Center of the element in client coordinates
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const dx = clientX - centerX;
  const dy = clientY - centerY;

  // Un-rotate the point relative to element's rotation
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const unrotX = dx * cos - dy * sin;
  const unrotY = dx * sin + dy * cos;

  if (customImageSrc) {
    // Custom PNG Image Hit-Testing
    const cached = imageAlphaCache.get(customImageSrc);
    const aspect = cached ? cached.aspectRatio : 1;

    // Sizing inside container (object-contain behavior)
    let renderW = rect.width;
    let renderH = rect.height;

    // If container aspect ratio differs from image aspect ratio:
    const containerAspect = rect.width / rect.height;
    if (containerAspect > aspect) {
      renderW = rect.height * aspect;
      renderH = rect.height;
    } else {
      renderW = rect.width;
      renderH = rect.width / aspect;
    }

    const normX = (unrotX + renderW / 2) / renderW;
    const normY = (unrotY + renderH / 2) / renderH;

    if (normX < 0 || normX > 1 || normY < 0 || normY > 1) {
      return false; // Point is outside the image's bounding box
    }

    const alpha = getCachedPixelAlpha(customImageSrc, normX, normY);
    if (alpha === -1) {
      // Image still loading into cache - allow hit to prevent dead clicks
      return true;
    }

    // Alpha threshold: only consider solid pixels (alpha >= 20 out of 255)
    return alpha >= 20;
  }

  // Default / Procedural 3D Stationery Hit-Testing:
  // Procedural stationery is an angled rectangular barrel (~160px by ~32px)
  const barrelHalfW = Math.min(rect.width * 0.48, 80);
  const barrelHalfH = Math.min(rect.height * 0.35, 18);

  return Math.abs(unrotX) <= barrelHalfW && Math.abs(unrotY) <= barrelHalfH;
}

/**
 * Passes an unhandled pointer/click event through to the next element underneath,
 * bypassing the current element with transparent hitboxes.
 */
export function passEventThrough(
  e: React.PointerEvent | React.MouseEvent | PointerEvent | MouseEvent,
  currentElement: HTMLElement
) {
  const native = 'nativeEvent' in e ? (e as any).nativeEvent : e;
  if (!native || typeof native.clientX !== 'number') return;

  const prevDisplay = currentElement.style.pointerEvents;
  currentElement.style.pointerEvents = 'none';

  try {
    const underlying = document.elementFromPoint(native.clientX, native.clientY);
    if (underlying && underlying !== currentElement && !currentElement.contains(underlying)) {
      let newEvent: Event;
      if (typeof window.PointerEvent !== 'undefined' && (native instanceof PointerEvent || native.type.startsWith('pointer'))) {
        newEvent = new PointerEvent(native.type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: native.clientX,
          clientY: native.clientY,
          screenX: native.screenX,
          screenY: native.screenY,
          button: native.button ?? 0,
          buttons: native.buttons ?? 1,
          pointerId: native.pointerId ?? 1,
          pointerType: native.pointerType || 'mouse',
          isPrimary: native.isPrimary ?? true,
          width: native.width || 1,
          height: native.height || 1,
          pressure: native.pressure || 0.5,
          shiftKey: native.shiftKey,
          altKey: native.altKey,
          ctrlKey: native.ctrlKey,
          metaKey: native.metaKey,
        });
      } else if (typeof window.MouseEvent !== 'undefined' && (native instanceof MouseEvent || native.type.startsWith('mouse') || native.type === 'click')) {
        newEvent = new MouseEvent(native.type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: native.clientX,
          clientY: native.clientY,
          screenX: native.screenX,
          screenY: native.screenY,
          button: native.button ?? 0,
          buttons: native.buttons ?? 1,
          shiftKey: native.shiftKey,
          altKey: native.altKey,
          ctrlKey: native.ctrlKey,
          metaKey: native.metaKey,
        });
      } else {
        newEvent = new Event(native.type, { bubbles: true, cancelable: true });
      }

      underlying.dispatchEvent(newEvent);
    }
  } catch (err) {
    // Fail-safe silently if browser sandbox prohibits simulated event dispatching
    console.debug('Pass event through ignored:', err);
  } finally {
    currentElement.style.pointerEvents = prevDisplay;
  }
}
