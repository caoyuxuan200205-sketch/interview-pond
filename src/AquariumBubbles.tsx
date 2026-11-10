import { useEffect, useRef } from 'react';
import './aquarium-bubbles.css';

const COUNT = 30;
const WATERLINE = 184;
// Open water beside the plants/rocks; the pearl dome is scenery, not an emitter.
const sources = [[270, 390], [435, 650], [580, 575], [915, 630], [1135, 655], [1470, 690]];
const between = (min: number, max: number) => min + Math.random() * (max - min);
type Bubble = { x: number; y: number; originY: number; anchor: number; radius: number; speed: number; terminal: number; phase: number; frequency: number; sway: number; depth: number; age: number; wait: number };
function birth(warm = false): Bubble {
  const [sourceX, sourceY] = sources[Math.floor(Math.random() * sources.length)];
  const radius = between(3, 10), depth = between(.55, 1);
  const anchor = sourceX + between(-22, 22);
  const y = warm ? between(WATERLINE + 20, sourceY) : sourceY;
  return { x: anchor, y, originY: sourceY, anchor, radius, speed: warm ? 25 + radius * 3 : 8, terminal: 25 + radius * 3, phase: between(0, Math.PI * 2), frequency: between(1.1, 2.1), sway: between(4, 15), depth, age: warm ? between(2, 12) : 0, wait: warm ? 0 : between(.3, 4) };
}

export default function AquariumBubbles({ enabled }: { enabled: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = layer.current;
    if (!root || !enabled) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.water-bubble'));
    const bubbles = nodes.map(() => birth(true));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, previous = 0, elapsed = 0;
    const paint = (bubble: Bubble, node: HTMLElement) => {
      const expansion = 1 + Math.max(0, (bubble.originY - bubble.y) / 600) * .1;
      const wobble = Math.sin(bubble.age * 2.3 + bubble.phase) * .035;
      node.style.width = node.style.height = `${bubble.radius * 2}px`;
      node.style.transform = `translate3d(${bubble.x - bubble.radius}px,${bubble.y - bubble.radius}px,0) scale(${expansion * (1 + wobble)},${expansion * (1 - wobble)})`;
      node.style.opacity = String(bubble.wait > 0 ? 0 : Math.min(1, bubble.age / .65, Math.max(0, (bubble.y - WATERLINE) / 35)) * bubble.depth * .78);
      node.style.filter = `blur(${(1 - bubble.depth) * .8}px)`;
    };
    const tick = (now: number) => {
      if (previous && now - previous < 1000 / 30) { frame = requestAnimationFrame(tick); return; }
      const dt = previous ? Math.min((now - previous) / 1000, .08) : 0;
      previous = now; elapsed += dt;
      bubbles.forEach((bubble, index) => {
        if (bubble.wait > 0) bubble.wait -= dt;
        else {
          bubble.age += dt;
          bubble.speed += (bubble.terminal - bubble.speed) * (1 - Math.exp(-dt * 2));
          bubble.y -= bubble.speed * dt;
          const current = Math.sin(elapsed * .29 + bubble.y * .003) * 9;
          const targetX = bubble.anchor + current + Math.sin(bubble.age * bubble.frequency + bubble.phase) * bubble.sway;
          bubble.x += (targetX - bubble.x) * (1 - Math.exp(-dt * 2.5));
          if (bubble.y <= WATERLINE) { bubbles[index] = birth(); }
        }
        paint(bubbles[index], nodes[index]);
      });
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      cancelAnimationFrame(frame); previous = 0;
      root.hidden = reducedMotion.matches;
      if (!document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', resume);
    reducedMotion.addEventListener('change', resume);
    resume();
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', resume); reducedMotion.removeEventListener('change', resume); };
  }, [enabled]);
  if (!enabled) return null;
  return <div className="aquarium-bubbles" ref={layer} aria-hidden="true">{Array.from({length:COUNT},(_,index)=><i className="water-bubble" key={index}/>)}</div>;
}
