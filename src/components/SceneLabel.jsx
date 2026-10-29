import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Labels are ordinary WebGL sprites. They create no extra React roots or DOM overlays.
export default function SceneLabel({ title, subtitle = '', accent = '#79e5dc', statusColor, position = [0, 0, 0], screenScale = .0006, center = [0, .5], ...events }) {
  const label = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = '600 24px "Segoe UI", Arial, sans-serif';
    const titleWidth = context.measureText(String(title)).width;
    context.font = '18px "Segoe UI", Arial, sans-serif';
    const subtitleWidth = context.measureText(String(subtitle)).width;
    canvas.width = Math.min(540, Math.max(168, Math.ceil(Math.max(titleWidth + (statusColor ? 66 : 44), subtitleWidth + 38))));
    canvas.height = subtitle ? 92 : 58;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = 'rgba(9, 20, 31, .96)';
    c.strokeStyle = '#344956';
    c.lineWidth = 2;
    c.beginPath(); c.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 9); c.fill(); c.stroke();
    c.fillStyle = accent; c.fillRect(1, 11, 3, canvas.height - 22);
    c.font = '600 24px "Segoe UI", Arial, sans-serif';
    c.fillStyle = '#dfebef';
    c.textBaseline = 'middle';
    c.fillText(String(title), 19, subtitle ? 28 : 29, canvas.width - (statusColor ? 58 : 36));
    if (statusColor) { c.fillStyle = statusColor; c.beginPath(); c.arc(canvas.width - 21, subtitle ? 28 : 29, 4, 0, Math.PI * 2); c.fill(); }
    if (subtitle) { c.font = '18px "Segoe UI", Arial, sans-serif'; c.fillStyle = '#91aebb'; c.fillText(String(subtitle), 19, 65, canvas.width - 36); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return { texture, width: canvas.width, height: canvas.height };
  }, [title, subtitle, accent, statusColor]);
  useEffect(() => () => label.texture.dispose(), [label]);
  return <sprite position={position} center={center} scale={[label.width * screenScale, label.height * screenScale, 1]} {...events}>
    <spriteMaterial map={label.texture} transparent depthTest depthWrite={false} sizeAttenuation={false} toneMapped={false} />
  </sprite>;
}
