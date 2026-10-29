import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import dayUrl from '../assets/earth-day.jpg';
import nightUrl from '../assets/earth-night.png';
import normalUrl from '../assets/earth-normal.jpg';
import { EARTH_SCENE_RADIUS, getOrbitPoints, healthColor, palette, toScene } from './sceneUtils';
import SceneLabel from './SceneLabel.jsx';

class SceneBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? <div role="status" style={fallbackStyle}>3D rendering is unavailable on this device.<br /><span style={{ opacity: .55 }}>Spacecraft controls and simulation remain available.</span></div> : this.props.children;
  }
}
const fallbackStyle = { display: 'grid', placeContent: 'center', textAlign: 'center', width: '100%', height: '100%', color: '#acbdca', fontSize: 13, lineHeight: 1.8, background: 'radial-gradient(ellipse, #102231, #070e16 70%)' };

function Earth({ time }) {
  const ref = useRef();
  const [day, night, normal] = useTexture([dayUrl, nightUrl, normalUrl]);
  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = 8;
    normal.anisotropy = 8;
  }, [day, night, normal]);
  useFrame(() => { if (ref.current) ref.current.rotation.y = -.8 + time * 7.292115e-5; });
  const glow = useMemo(() => ({
    uniforms: { glowColor: { value: new THREE.Color('#4b9bce') }, intensity: { value: .78 } },
    vertexShader: `varying vec3 vNormal; varying vec3 vPosition;
      void main(){ vNormal=normalize(normalMatrix*normal); vec4 mvPosition=modelViewMatrix*vec4(position,1.); vPosition=mvPosition.xyz; gl_Position=projectionMatrix*mvPosition; }`,
    fragmentShader: `varying vec3 vNormal; varying vec3 vPosition; uniform vec3 glowColor; uniform float intensity;
      void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(-vPosition))),3.7);gl_FragColor=vec4(glowColor,rim*intensity);}`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false,
  }), []);
  return <group>
    <mesh ref={ref}>
      <sphereGeometry args={[EARTH_SCENE_RADIUS, 96, 96]} />
      <meshPhongMaterial map={day} normalMap={normal} normalScale={[.7, .7]} emissiveMap={night} emissive="#d8b68b" emissiveIntensity={.37} color="#a4b8c6" specular="#718c9b" shininess={12} />
    </mesh>
    <mesh scale={1.018}><sphereGeometry args={[EARTH_SCENE_RADIUS, 80, 80]} /><shaderMaterial {...glow} /></mesh>
    <mesh scale={1.045}><sphereGeometry args={[EARTH_SCENE_RADIUS, 64, 64]} /><meshBasicMaterial color="#3876b7" transparent opacity={.026} side={THREE.BackSide} depthWrite={false} /></mesh>
  </group>;
}

function Stars() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(1400 * 3);
    let seed = 14041983;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 1400; i++) {
      const theta = rand() * Math.PI * 2, phi = Math.acos(2 * rand() - 1), radius = 28 + rand() * 35;
      positions.set([radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <points geometry={geometry}><pointsMaterial color="#a1b4ca" size={.028} transparent opacity={.55} sizeAttenuation depthWrite={false} /></points>;
}

function OrbitTrail({ satellite, color }) {
  const points = useMemo(() => getOrbitPoints(satellite), [satellite.orbit?.radius, satellite.orbit?.inclination, satellite.orbit?.raan, satellite.orbit?.eccentricity, satellite.id]);
  return <Line points={points} color={color} transparent opacity={.45} lineWidth={.65} />;
}

function Spacecraft({ satellite, index, showLabels, onSelect, focusedId }) {
  const [hovered, setHovered] = useState(false);
  const rawPosition = satellite.position || satellite.inertial_r_m;
  const p = toScene(rawPosition);
  const color = palette[index % palette.length];
  const health = satellite.observedHealth || satellite.health || 'OPERATIONAL';
  const id = satellite.id || satellite.spacecraft_id;
  if (!rawPosition || rawPosition.length !== 3 || rawPosition.some(v => !Number.isFinite(v))) return null;
  return <group position={p} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize())}>
    <mesh onClick={e => { e.stopPropagation(); onSelect?.(id); }} onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}>
      <sphereGeometry args={[.095, 12, 12]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <group scale={hovered || focusedId === id ? 1.25 : 1}>
      <mesh><boxGeometry args={[.047, .07, .047]} /><meshStandardMaterial color="#d5dce0" metalness={.75} roughness={.3} /></mesh>
      <mesh position={[-.075, 0, 0]}><boxGeometry args={[.092, .047, .008]} /><meshStandardMaterial color="#335b87" emissive="#0d2941" emissiveIntensity={.4} metalness={.5} /></mesh>
      <mesh position={[.075, 0, 0]}><boxGeometry args={[.092, .047, .008]} /><meshStandardMaterial color="#335b87" emissive="#0d2941" emissiveIntensity={.4} metalness={.5} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[.12, .124, 48]} /><meshBasicMaterial color={color} transparent opacity={hovered ? .9 : .45} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    </group>
    {showLabels && <SceneLabel title={id} subtitle={hovered ? `${String(health).replaceAll('_', ' ')} · ${Number.isFinite(satellite.lastObservedEnergyWh) ? satellite.lastObservedEnergyWh.toFixed(1) + ' Wh' : 'energy unknown'}` : ''} position={[.18, .17, 0]} accent={color} statusColor={healthColor(health)} onClick={e => { e.stopPropagation(); onSelect?.(id); }} onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }} />}
  </group>;
}

function Connections({ spacecraft, connections, time, onPairSelect }) {
  return connections.map((link, index) => {
    const participants = link.participants || [link.a || link.requesterId || link.source, link.b || link.providerId || link.target];
    const a = spacecraft.find(s => (s.id || s.spacecraft_id) === participants[0]);
    const b = spacecraft.find(s => (s.id || s.spacecraft_id) === participants[1]);
    const dataActive = ['OPERATIONAL', 'ACTIVE'].includes(link.dataState || link.data_state);
    const mechanical = link.mechanicalState || link.mechanical_state;
    if (!a || !b || (!dataActive && !['CAPTURED', 'APPROACH'].includes(mechanical))) return null;
    const p1 = toScene(a.position), p2 = toScene(b.position);
    const isPhysical = mechanical === 'CAPTURED';
    const mid = p1.clone().lerp(p2, .5);
    const pulse = p1.clone().lerp(p2, (time % 5) / 5);
    return <group key={link.id || link.connection_id || index}>
      <Line points={[p1, p2]} color={isPhysical ? '#edb26c' : '#79e5dc'} lineWidth={isPhysical ? 2 : 1.3} transparent opacity={.8} dashed={!isPhysical} dashSize={.055} gapSize={.035} onClick={e => { e.stopPropagation(); onPairSelect?.(link.id || link.connection_id || link); }} />
      {dataActive && <mesh position={pulse}><sphereGeometry args={[.018, 8, 8]} /><meshBasicMaterial color="#ccfffa" /></mesh>}
      <SceneLabel title={isPhysical ? 'COUPLED ↗' : 'CROSSLINK ↗'} position={mid} center={[.5, .5]} screenScale={.00053} accent={isPhysical ? '#edb26c' : '#79e5dc'} onClick={e => { e.stopPropagation(); onPairSelect?.(link.id || link.connection_id || link); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }} />
    </group>;
  });
}

function CameraFocus({ focusedId, spacecraft, view }) {
  const { controls, camera } = useThree();
  useEffect(() => {
    if (!controls) return;
    camera.position.set(6.1, 3.4, 6.4);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [view, camera, controls]);
  const focus = spacecraft.find(s => s.id === focusedId);
  const target = focus?.position?.length === 3 ? toScene(focus.position).multiplyScalar(.48) : new THREE.Vector3();
  useFrame((_, dt) => {
    if (controls && controls.target.distanceTo(target) > .001) {
      controls.target.lerp(target, Math.min(1, dt * 2.4));
      controls.update();
    }
  });
  return null;
}

export function OrbitalScene({ spacecraft = [], connections = [], time = 0, showLabels = true, showTrails = true, onSelect, onPairSelect, focusedId = null, view = 'earth' }) {
  return <SceneBoundary>
    <Canvas camera={{ position: [6.1, 3.4, 6.4], fov: 39, near: .05, far: 120 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} fallback={<div style={fallbackStyle}>A WebGL2-capable browser is required for the 3D view.</div>} style={{ background: 'transparent' }}>
      <ambientLight intensity={.12} color="#7d9dc6" />
      <directionalLight position={[8, 0, 0]} intensity={3.25} color="#ddeaf6" />
      <directionalLight position={[-5, 0, -2]} intensity={.12} color="#4d7caf" />
      <Stars />
      <Suspense fallback={null}><Earth time={time} /></Suspense>
      {showTrails && spacecraft.map((s, i) => <OrbitTrail key={s.id || i} satellite={s} color={palette[i % palette.length]} />)}
      {spacecraft.map((s, i) => <Spacecraft key={s.id || i} satellite={s} index={i} showLabels={showLabels} onSelect={onSelect} focusedId={focusedId} />)}
      <Connections spacecraft={spacecraft} connections={connections} time={time} onPairSelect={onPairSelect} />
      <OrbitControls makeDefault enablePan={false} minDistance={4.9} maxDistance={16} enableDamping dampingFactor={.07} rotateSpeed={.4} zoomSpeed={.65} />
      <CameraFocus focusedId={focusedId} spacecraft={spacecraft} view={view} />
    </Canvas>
  </SceneBoundary>;
}

export default OrbitalScene;
