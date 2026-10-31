import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

// A 3D scene that owns the wheel traps page scrolling: three's OrbitControls
// calls preventDefault on every wheel event, so a reader scrolling with the
// cursor over the globe gets zoom instead of the page. The canvas covers about
// half the viewport on the orbital overview, so the page feels stuck.
//
// This sits in front of OrbitControls' own listener on the same element. A
// capture-phase handler runs before a bubble-phase one, so a plain wheel is
// stopped here and never reaches the controls: no preventDefault, and the page
// scrolls. Holding Ctrl or Cmd lets the event through to zoom as before, which
// is also what a trackpad pinch sends.
//
// It has to be synchronous. Gating OrbitControls' `enableZoom` from React state
// does not work: the state update lands a frame after the wheel event it was
// meant to govern, so the first turn of the wheel always does the wrong thing.
export default function WheelScrollGuard() {
  const domElement = useThree(state => state.gl.domElement);
  useEffect(() => {
    if (!domElement) return undefined;
    const onWheel = event => { if (!event.ctrlKey && !event.metaKey) event.stopPropagation(); };
    domElement.addEventListener('wheel', onWheel, { capture: true });
    return () => domElement.removeEventListener('wheel', onWheel, { capture: true });
  }, [domElement]);
  return null;
}
