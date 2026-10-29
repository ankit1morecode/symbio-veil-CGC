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

function Board({ component, index, selectedComponent, onSelectComponent, exploded, spacing = .21 }) {
  const [hover, setHover] = useState(false);
  const isSelected = (typeof selectedComponent === 'string' ? selectedComponent : selectedComponent?.id) === component.id;
  const y = -.82 + index * (exploded ? .3 : spacing);
  const color = healthColor(component.observedHealth || component.health);
  const boardColors = ['#18584f', '#3e5550', '#26556c', '#4b4164', '#655136', '#245b50', '#394e66', '#3d5c61'];
  return <group position={[0, y, 0]} onClick={e => { e.stopPropagation(); onSelectComponent?.(component.id); }} onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}>
    <mesh><boxGeometry args={[.94, .032, .94]} /><meshStandardMaterial color={isSelected ? '#43ac9a' : boardColors[index % boardColors.length]} emissive={isSelected ? '#38b8a8' : color} emissiveIntensity={isSelected ? .22 : .025} metalness={.2} roughness={.6} /></mesh>
    <mesh position={[.05, .055, -.06]}><boxGeometry args={[.32, .075, .32]} /><meshStandardMaterial color="#161e27" metalness={.6} roughness={.4} /></mesh>
    {Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[(i % 3 - 1) * .3, .048, .3 - Math.floor(i / 3) * .58]}><boxGeometry args={[.09, .055, .09]} /><meshStandardMaterial color={i % 2 ? '#a8a59a' : '#29323e'} metalness={.6} roughness={.4} /></mesh>)}
    <mesh position={[.4, .055, .4]}><sphereGeometry args={[.023, 8, 8]} /><meshBasicMaterial color={color} /></mesh>
    {(isSelected || hover) && <Line points={[[-.49, .03, -.49], [.49, .03, -.49], [.49, .03, .49], [-.49, .03, .49], [-.49, .03, -.49]]} color="#79e5dc" lineWidth={1.5} />}
    {(isSelected || (exploded && index % 2 === 0)) && <SceneLabel title={component.name || component.id} position={[.69, .025, 0]} accent={color} statusColor={color} screenScale={.00048} />}
  </group>;
}

function SatelliteModel({ satellite, selectedComponent, onSelectComponent, exploded }) {
  const components = satellite?.components || [];
  const displayed = useMemo(() => components.length ? components : [], [components]);
  const boards = displayed.filter(c => !['solar', 'battery', 'dock'].includes(c.targetClass));
  const solar = displayed.find(c => c.targetClass === 'solar');
  const battery = displayed.find(c => c.targetClass === 'battery');
  const dock = displayed.find(c => c.targetClass === 'dock');
  const isSelected = c => c && (typeof selectedComponent === 'string' ? selectedComponent : selectedComponent?.id) === c.id;
  const spacing = Math.min(.21, 1.65 / Math.max(1, boards.length - 1));
  const structureTop = exploded ? Math.max(1.2, -.82 + (boards.length - 1) * .3 + .2) : 1.02;
  return <group rotation={[0, -.3, .08]} position={[0, exploded ? -.28 : 0, 0]}>
    <SolarPanel side={-1} component={solar} onSelectComponent={onSelectComponent} selected={isSelected(solar)} /><SolarPanel side={1} component={solar} onSelectComponent={onSelectComponent} selected={isSelected(solar)} />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}${z}`} position={[x * .53, (structureTop - 1.13) / 2, z * .53]}><boxGeometry args={[.055, structureTop + 1.13, .055]} /><meshStandardMaterial color="#afb9bf" metalness={.8} roughness={.28} /></mesh>))}
    <mesh position={[0, -1.1, 0]}><boxGeometry args={[1.12, .09, 1.12]} /><meshStandardMaterial color="#8b969e" metalness={.85} roughness={.23} /></mesh>
    <mesh position={[0, structureTop, 0]}><boxGeometry args={[1.12, .055, 1.12]} /><meshStandardMaterial color="#87939b" metalness={.8} roughness={.25} transparent opacity={exploded ? .5 : .9} /></mesh>
    <mesh position={[0, structureTop + .115, 0]} rotation={[Math.PI / 2, 0, 0]} onClick={e => { e.stopPropagation(); if (dock) onSelectComponent?.(dock.id); }}><torusGeometry args={[.28, .045, 10, 36]} /><meshStandardMaterial color={isSelected(dock) ? '#79e5dc' : '#af9462'} metalness={.8} roughness={.32} /></mesh>
    <mesh position={[0, structureTop + .106, 0]}><cylinderGeometry args={[.19, .19, .03, 32]} /><meshStandardMaterial color="#253746" metalness={.7} roughness={.3} /></mesh>
    {boards.map((c, index) => <Board key={c.id || index} component={c} index={index} selectedComponent={selectedComponent} onSelectComponent={onSelectComponent} exploded={exploded} spacing={spacing} />)}
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
    } else camera.position.set(5.3, 3.2, 5.7);
    controls.target.copy(target);
    controls.update();
  }, [exploded, camera, controls, size.width, size.height]);
  return null;
}

export function TwinScene({ satellite, selectedComponent, onSelectComponent, exploded = false, pair = false }) {
  return <TwinBoundary><Canvas camera={{ position: [5.3, 3.2, 5.7], fov: 37, near: .05, far: 40 }} dpr={[1, 1.7]} gl={{ alpha: true, antialias: true }} fallback={<div style={{ color: '#8fa5b6', padding: 40 }}>A WebGL2-capable browser is required for this view.</div>}>
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
