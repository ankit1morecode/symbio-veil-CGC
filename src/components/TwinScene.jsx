import React, { Component, useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { healthColor } from './sceneUtils';
import SceneLabel from './SceneLabel.jsx';

class TwinBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div role="status" style={{ display: 'grid', height: '100%', placeContent: 'center', color: '#92a6b7', fontSize: 13 }}>3D rendering is unavailable. Select components in the hierarchy.</div> : this.props.children; }
}

function SolarPanel({ side = 1, component, onSelectComponent, selected }) {
  const x = side * 1.38;
  return <group position={[x, .05, 0]} onClick={e => { e.stopPropagation(); if (component) onSelectComponent?.(component.id); }}>
    <mesh><boxGeometry args={[1.45, .055, 1.2]} /><meshStandardMaterial color="#8496a0" metalness={.85} roughness={.23} /></mesh>
    {Array.from({ length: 18 }, (_, i) => <mesh key={i} position={[(i % 6 - 2.5) * .228, .034, (Math.floor(i / 6) - 1) * .38]}><boxGeometry args={[.21, .008, .35]} /><meshStandardMaterial color={selected ? '#2e7181' : i % 4 === 0 ? '#1a3357' : '#152b4d'} metalness={.7} roughness={.22} emissive={selected ? '#3fcdbe' : '#143259'} emissiveIntensity={selected ? .3 : .12} /></mesh>)}
    <mesh position={[-side * .85, -.005, 0]}><boxGeometry args={[.3, .08, .1]} /><meshStandardMaterial color="#a1adb2" metalness={.8} roughness={.3} /></mesh>
  </group>;
}

// Each upright daughterboard plugs into a socket on the horizontal motherboard.
// These are schematic PCBs, not a claim of a flight-qualified mechanical layout.
function Board({ components, index, rows, selectedComponent, onSelectComponent, exploded }) {
  const [hover, setHover] = useState(false);
  const selectedId = typeof selectedComponent === 'string' ? selectedComponent : selectedComponent?.id;
  const component = components.find(c => c.id === selectedId) || components[0];
  const isSelected = components.some(c => c.id === selectedId);
  const col = index % 2, row = Math.floor(index / 2);
  const x = (col ? 1 : -1) * (exploded ? .34 : .245);
  const z = rows === 1 ? 0 : -.4 + row * .8 / (rows - 1);
  const y = -.37 + (exploded ? .16 + row * .12 : 0);
  const color = healthColor(component.observedHealth || component.health);
  const boardColors = ['#195f56', '#276879', '#375269', '#5a4b70', '#536c4d', '#266454', '#425f77', '#735d46'];
  return <group position={[x, y, z]} onClick={e => { e.stopPropagation(); onSelectComponent?.(component.id); }} onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}>
    <mesh><boxGeometry args={[.42, .72, .024]} /><meshStandardMaterial color={isSelected ? '#389c8b' : boardColors[index % boardColors.length]} emissive={isSelected ? '#38b8a8' : color} emissiveIntensity={isSelected ? .2 : .022} metalness={.18} roughness={.56} /></mesh>
    <mesh position={[0, .05, .023]}><boxGeometry args={[.18, .19, .028]} /><meshStandardMaterial color="#18232d" metalness={.55} roughness={.35} /></mesh>
    {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[(i % 3 - 1) * .13, .24 - Math.floor(i / 3) * .47, .023]} onClick={e => { e.stopPropagation(); onSelectComponent?.(components[i % components.length].id); }}><boxGeometry args={[.06, .052, .028]} /><meshStandardMaterial color={i % 2 ? '#c9b88c' : '#283544'} metalness={.58} roughness={.38} /></mesh>)}
    {[-.14, .14].map((pinX, i) => <mesh key={i} position={[pinX, -.34, .014]}><boxGeometry args={[.06, .04, .004]} /><meshStandardMaterial color="#d2b66f" metalness={.8} roughness={.3} /></mesh>)}
    <mesh position={[.155, .285, .024]}><sphereGeometry args={[.014, 8, 8]} /><meshBasicMaterial color={color} /></mesh>
    {(isSelected || hover) && <Line points={[[-.22, -.37, .02], [.22, -.37, .02], [.22, .37, .02], [-.22, .37, .02], [-.22, -.37, .02]]} color="#79e5dc" lineWidth={1.5} />}
    {(isSelected || hover) && <SceneLabel title={component.name || component.id} position={[col ? .26 : -.26, .4, .04]} accent={color} statusColor={color} screenScale={.00048} />}
  </group>;
}

function Motherboard({ component, sensor, selected, onSelectComponent, rows }) {
  const [hover, setHover] = useState(false);
  const color = healthColor(component?.observedHealth || component?.health);
  return <group position={[0, -.82, 0]} onClick={e => { e.stopPropagation(); if (component) onSelectComponent?.(component.id); }} onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = component ? 'pointer' : 'auto'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}>
    <mesh><boxGeometry args={[1.02, .065, 1.02]} /><meshStandardMaterial color={selected ? '#359889' : '#145a4d'} emissive={selected ? '#3dd9c6' : '#0a3f36'} emissiveIntensity={selected ? .24 : .08} metalness={.22} roughness={.5} /></mesh>
    {[-1, 1].flatMap(side => Array.from({ length: rows }, (_, row) => {
      const z = rows === 1 ? 0 : -.4 + row * .8 / (rows - 1);
      return <group key={`${side}-${row}`} position={[side * .245, .055, z]}>
        <mesh><boxGeometry args={[.43, .045, .04]} /><meshStandardMaterial color="#d2b16c" metalness={.78} roughness={.3} /></mesh>
        <mesh position={[0, .023, 0]}><boxGeometry args={[.38, .008, .026]} /><meshStandardMaterial color="#202c2d" roughness={.7} /></mesh>
      </group>;
    }))}
    {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}-${z}`} position={[x * .45, .036, z * .45]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.025, .007, 6, 12]} /><meshStandardMaterial color="#d7bc82" metalness={.8} roughness={.3} /></mesh>))}
    {sensor && <mesh position={[0, .045, 0]} onClick={e => { e.stopPropagation(); onSelectComponent?.(sensor.id); }}><boxGeometry args={[.1, .03, .1]} /><meshStandardMaterial color="#202c36" metalness={.5} roughness={.45} /></mesh>}
    {(selected || hover) && <Line points={[[-.52, .04, -.52], [.52, .04, -.52], [.52, .04, .52], [-.52, .04, .52], [-.52, .04, -.52]]} color="#79e5dc" lineWidth={1.5} />}
    {(selected || hover) && <SceneLabel title={component?.name || 'Motherboard / backplane'} position={[.66, .05, .45]} accent={color} statusColor={color} screenScale={.00048} />}
  </group>;
}

function SatelliteModel({ satellite, selectedComponent, onSelectComponent, exploded }) {
  const components = satellite?.components || [];
  const displayed = useMemo(() => components.length ? components : [], [components]);
  const motherboard = displayed.find(c => c.targetClass === 'bus');
  const motherboardSensor = displayed.find(c => c.targetClass === 'monitor' && c.board === motherboard?.board);
  const boards = Array.from(displayed.filter(c => !['solar', 'battery', 'dock', 'bus'].includes(c.targetClass) && c !== motherboardSensor).reduce((map, c) => {
    const key = c.board || c.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
    return map;
  }, new Map()).values());
  const solar = displayed.find(c => c.targetClass === 'solar');
  const battery = displayed.find(c => c.targetClass === 'battery');
  const dock = displayed.find(c => c.targetClass === 'dock');
  const isSelected = c => c && (typeof selectedComponent === 'string' ? selectedComponent : selectedComponent?.id) === c.id;
  const rows = Math.max(1, Math.ceil(boards.length / 2));
  const structureTop = exploded ? Math.max(1.02, .4 + (rows - 1) * .12) : 1.02;
  return <group rotation={[0, -.3, .08]} position={[0, exploded ? -.28 : 0, 0]}>
    <SolarPanel side={-1} component={solar} onSelectComponent={onSelectComponent} selected={isSelected(solar)} /><SolarPanel side={1} component={solar} onSelectComponent={onSelectComponent} selected={isSelected(solar)} />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}${z}`} position={[x * .53, (structureTop - 1.13) / 2, z * .53]}><boxGeometry args={[.055, structureTop + 1.13, .055]} /><meshStandardMaterial color="#afb9bf" metalness={.8} roughness={.28} /></mesh>))}
    <mesh position={[0, -1.1, 0]}><boxGeometry args={[1.12, .09, 1.12]} /><meshStandardMaterial color="#8b969e" metalness={.85} roughness={.23} /></mesh>
    <mesh position={[0, structureTop, 0]}><boxGeometry args={[1.12, .055, 1.12]} /><meshStandardMaterial color="#87939b" metalness={.8} roughness={.25} transparent opacity={exploded ? .5 : .9} /></mesh>
    <mesh position={[0, structureTop + .115, 0]} rotation={[Math.PI / 2, 0, 0]} onClick={e => { e.stopPropagation(); if (dock) onSelectComponent?.(dock.id); }}><torusGeometry args={[.28, .045, 10, 36]} /><meshStandardMaterial color={isSelected(dock) ? '#79e5dc' : '#af9462'} metalness={.8} roughness={.32} /></mesh>
    <mesh position={[0, structureTop + .106, 0]}><cylinderGeometry args={[.19, .19, .03, 32]} /><meshStandardMaterial color="#253746" metalness={.7} roughness={.3} /></mesh>
    <Motherboard component={motherboard} sensor={motherboardSensor} selected={isSelected(motherboard) || isSelected(motherboardSensor)} onSelectComponent={onSelectComponent} rows={rows} />
    {boards.map((group, index) => <Board key={group[0].board || group[0].id} components={group} index={index} rows={rows} selectedComponent={selectedComponent} onSelectComponent={onSelectComponent} exploded={exploded} />)}
    <mesh position={[.34, structureTop + .43, -.35]} rotation={[.12, 0, -.12]}><cylinderGeometry args={[.008, .008, .74, 8]} /><meshStandardMaterial color="#abb9bf" metalness={.8} roughness={.3} /></mesh>
    <mesh position={[0, -.97, 0]} onClick={e => { e.stopPropagation(); if (battery) onSelectComponent?.(battery.id); }}><boxGeometry args={[.77, .14, .73]} /><meshStandardMaterial color={isSelected(battery) ? '#79e5dc' : '#7c6448'} metalness={.6} roughness={.4} /></mesh>
  </group>;
}

function FitCamera({ exploded }) {
  const { camera, controls, size } = useThree();
  useEffect(() => {
    if (!controls) return;
    const target = new THREE.Vector3(0, exploded ? .22 : 0, 0);
    if (exploded) {
      const aspect = Math.max(.45, size.width / Math.max(1, size.height));
      const distance = Math.max(8.7, Math.max(3.6, 4.7 / aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 1.15);
      camera.position.copy(new THREE.Vector3(5.3, 3.2, 5.7).normalize().multiplyScalar(distance).add(target));
    } else camera.position.set(4, 2.8, 4.3);
    controls.target.copy(target);
    controls.update();
  }, [exploded, camera, controls, size.width, size.height]);
  return null;
}

export function TwinScene({ satellite, selectedComponent, onSelectComponent, exploded = false, pair = false }) {
  return <TwinBoundary><Canvas camera={{ position: [4.4, 3.08, 4.73], fov: 37, near: .05, far: 40 }} dpr={[1, 1.7]} gl={{ alpha: true, antialias: true }} fallback={<div style={{ color: '#8fa5b6', padding: 40 }}>A WebGL2-capable browser is required for this view.</div>}>
    <ambientLight intensity={.75} color="#a3b9ce" />
    <hemisphereLight intensity={1.4} color="#ceeaf7" groundColor="#182b40" />
    <directionalLight position={[3, 7, 4]} intensity={3.6} color="#e9edf0" />
    <directionalLight position={[-4, 1, -2]} intensity={2} color="#69a5c9" />
    <SatelliteModel satellite={satellite} selectedComponent={selectedComponent} onSelectComponent={onSelectComponent} exploded={exploded} />
    <gridHelper args={[12, 24, '#223846', '#172633']} position={[0, -1.6, 0]} material-transparent material-opacity={.23} />
    <OrbitControls makeDefault enablePan={false} minDistance={3.3} maxDistance={20} enableDamping dampingFactor={.08} rotateSpeed={.5} />
    <FitCamera exploded={exploded} />
  </Canvas></TwinBoundary>;
}

export default TwinScene;
