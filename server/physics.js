export const MU = 398600441800000;
export const EARTH_RADIUS = 6378137;
export const MODEL_VERSION = 'VEIL-REF-01/1.0';
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const norm = v => Math.hypot(...v);
export const sub = (a,b) => a.map((x,i)=>x-b[i]);
export const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function propagateOrbit(orbit, time) {
  const a = orbit.radius, e=orbit.eccentricity || 0, n=Math.sqrt(MU/a**3);
  const M=(orbit.phase+n*time)%(Math.PI*2); let E=M;
  for(let k=0;k<12;k++) E-=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
  const c=Math.cos(orbit.raan),s=Math.sin(orbit.raan),ci=Math.cos(orbit.inclination),si=Math.sin(orbit.inclination);
  const rotate = ([x,y]) => [c*x-s*ci*y,s*x+c*ci*y,si*y];
  const d=n/(1-e*Math.cos(E));
  return {position:rotate([a*(Math.cos(E)-e),a*Math.sqrt(1-e*e)*Math.sin(E)]),velocity:rotate([-a*Math.sin(E)*d,a*Math.sqrt(1-e*e)*Math.cos(E)*d])};
}
export function inEclipse(position) { return position[0]<0 && Math.hypot(position[1],position[2])<EARTH_RADIUS; }
export function linkGeometry(a,b) {
 const v=sub(b.position,a.position), vv=dot(v,v), t=vv?clamp(-dot(a.position,v)/vv,0,1):0;
 const closest=a.position.map((x,i)=>x+t*v[i]);
 return {distanceM:norm(v),lineOfSight:norm(closest)>EARTH_RADIUS,relativeSpeedMps:norm(sub(a.velocity,b.velocity))};
}
export function thermalAt(T, dt, conductance=.2, heat=3, capacity=150, sink=295) {
 const eq=sink+heat/conductance; return eq+(T-eq)*Math.exp(-conductance*dt/capacity);
}
export function thermalCrossing(T, threshold, conductance=.06, heat=3, capacity=150,sink=295) {
 const eq=sink+heat/conductance; return -capacity/conductance*Math.log((threshold-eq)/(T-eq));
}
export function nextRandom(state) {
 state.rng=(Math.imul(1664525,state.rng)+1013904223)>>>0; return (state.rng+.5)/4294967296;
}
export function exponentialWait(state, ratePerHour) { return -Math.log(1-nextRandom(state))/ratePerHour*3600; }
export function weibullWait(state,beta,etaHours,ageHours=0) {
 if(!(beta>0&&etaHours>0)) throw new Error('Weibull beta and etaHours must be positive');
 return (etaHours*((ageHours/etaHours)**beta-Math.log(1-nextRandom(state)))**(1/beta)-ageHours)*3600;
}
export function transferEnergy(powerW,seconds,efficiency=.85) {
 const exportedWh=powerW*seconds/3600,receivedWh=exportedWh*efficiency;
 return {exportedWh,receivedWh,lossWh:exportedWh-receivedWh};
}
