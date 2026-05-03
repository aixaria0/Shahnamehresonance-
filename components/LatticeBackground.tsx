'use client';

import React, { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
}

export const LatticeBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    resize();

    const createPoints = (spacing: number) => {
      const pts: Point[] = [];
      const rows = Math.ceil(height / spacing) + 1;
      const cols = Math.ceil(width / spacing) + 1;
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          pts.push({
            x: j * spacing,
            y: i * spacing,
            baseX: j * spacing,
            baseY: i * spacing,
            phase: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.8,
          });
        }
      }
      return { pts, rows, cols };
    };

    const layer1 = createPoints(80);
    const layer2 = createPoints(160);

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = time * 0.0003;
      
      const activityPulse = (Math.sin(t * 2) + 1) / 2 * 0.3;

      const drawLayer = (layer: { pts: Point[], rows: number, cols: number }, color: string, lineWidth: number, interactionRadius: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';

        layer.pts.forEach(p => {
          const dx = mouseRef.current.x - p.baseX;
          const dy = mouseRef.current.y - p.baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const force = Math.max(0, (interactionRadius - dist) / interactionRadius);
          
          const resonance = 1 + force * 3 + activityPulse;
          const waveX = Math.sin(t * p.speed + p.phase) * (12 * resonance);
          const waveY = Math.cos(t * p.speed + p.phase) * (12 * resonance);
          
          p.x = p.baseX + waveX - dx * force * 0.3;
          p.y = p.baseY + waveY - dy * force * 0.3;
        });

        // Draw horizontal lines
        for (let i = 0; i < layer.rows; i++) {
          ctx.beginPath();
          for (let j = 0; j < layer.cols; j++) {
            const p = layer.pts[i * layer.cols + j];
            if (j === 0) ctx.moveTo(p.x, p.y);
            else ctx.bezierCurveTo(
              p.x - 20, p.y,
              layer.pts[i * layer.cols + j - 1].x + 20, layer.pts[i * layer.cols + j - 1].y,
              p.x, p.y
            );
          }
          ctx.stroke();
        }

        // Draw vertical lines
        for (let j = 0; j < layer.cols; j++) {
          ctx.beginPath();
          for (let i = 0; i < layer.rows; i++) {
            const p = layer.pts[i * layer.cols + j];
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.bezierCurveTo(
              p.x, p.y - 20,
              layer.pts[(i - 1) * layer.cols + j].x, layer.pts[(i - 1) * layer.cols + j].y + 20,
              p.x, p.y
            );
          }
          ctx.stroke();
        }
      };

      // Draw deep background layer (Turquoise)
      drawLayer(layer2, 'rgba(0, 206, 209, 0.03)', 0.5, 300);
      
      // Draw main layer (Gold)
      drawLayer(layer1, 'rgba(212, 175, 55, 0.08)', 0.8, 200);

      // Draw pulsing nodes
      layer1.pts.forEach((p, idx) => {
        if (idx % 11 === 0) {
          const pulse = (Math.sin(t * 4 + p.phase) + 1) / 2;
          const size = 1 + pulse * 3;
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          
          // Dynamic color shift
          const isGold = Math.sin(t + p.phase) > 0;
          const alpha = 0.1 + pulse * (0.3 + activityPulse);
          
          if (isGold) {
            ctx.fillStyle = `rgba(212, 175, 55, ${alpha})`;
            if (pulse > 0.9) {
              ctx.shadowBlur = 15 + activityPulse * 50;
              ctx.shadowColor = 'rgba(212, 175, 55, 0.5)';
            }
          } else {
            ctx.fillStyle = `rgba(0, 206, 209, ${alpha})`;
            if (pulse > 0.9) {
              ctx.shadowBlur = 15 + activityPulse * 50;
              ctx.shadowColor = 'rgba(0, 206, 209, 0.5)';
            }
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render(0);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: 'radial-gradient(circle at 50% 50%, #0a0a0a 0%, #050505 100%)' }}
    />
  );
};
