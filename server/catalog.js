import {EARTH_RADIUS} from './physics.js';
export const scenarios = [
 {id:'VEIL-REF-01',name:'Orbital symbiosis',description:'A two-spacecraft research constellation. Introduce a fault to explore autonomous recovery.',mode:'C1',fault:null},
 {id:'E0',name:'Independent baseline',description:'Processor loss with peer assistance disabled.',mode:'C0',fault:'F-01'},
 {id:'E1',name:'Wireless capability recovery',description:'A compatible peer fulfils an imaging processing task over a bounded crosslink.',mode:'C1',fault:'F-01'},
 {id:'E2',name:'Temporary physical support',description:'A validated near-coorbital pair approaches, captures, transfers bounded power, and separates.',mode:'C2',fault:'F-03'},
 {id:'E3',name:'Reciprocal work',description:'Compatible reciprocal processing and relay services with separately recorded costs.',mode:'C1',fault:'F-01'},
 {id:'E4',name:'Emergency power / reserve',description:'A low-energy receiver needs support before its survival reserve is exhausted.',mode:'C2',fault:'F-03'},
 {id:'E5',name:'Cross-generation interface',description:'Direct interfaces are incompatible; compatible semantic wireless services remain eligible.',mode:'C1',fault:'F-01'},
 {id:'E6',name:'Persistent integration',description:'A near-coorbital pair evaluates longer-lived integration and updated inertia.',mode:'C3',fault:'F-03'},
].map(x=>({...x,scenario_id:x.id,schema_version:'1.0',fidelity:'P2 SYNTHETIC REFERENCE',duration:86400,seed:20261029,modelValidity:'Closed-form two-body Kepler orbits; first-order thermal; geometric radio; bounded near-coorbital approach proxy. Not flight qualified.'}));
export const faultModels = [
 ['F-01','Controller / computation','compute','Compute capacity 100% to 0%; mission tasks pause.'],
 ['F-02','Regulated power rail','rail','3.3 V to 2.9 V; dependent executive services lose power.'],
 ['F-03','Solar generation','solar','Illuminated solar output 20 W to 0 W.'],
 ['F-04','Battery system','battery','Usable battery capacity 120 Wh to 96 Wh.'],
 ['F-05','Radio / communication','radio','Usable bitrate 256 kbit/s to 0.'],
 ['F-06','Internal bus','bus','Internal service transaction delivery drops to zero.'],
 ['F-07','Navigation measurement','navigation','Navigation dropout prevents safe approach.'],
 ['F-08','Attitude / actuator','actuator','Available torque 0.002 N.m to 0 N.m.'],
 ['F-09','Thermal control','thermal','Conductance 0.20 to 0.06 W/K; temperature evolves physically.'],
 ['F-10','Adaptive docking interface','dock','Direct power path isolation; capture does not imply transfer.'],
 ['F-11','Mission payload','payload','Mission output quality drops below the 0.8 requirement.'],
 ['F-12','Monitoring / telemetry','monitor','Temperature sensor +8 K bias or frozen measurement; truth remains unchanged.'],
].map(([id,name,targetClass,effect])=>({id,name,targetClass,effect,version:'1.0',provenance:'P2 SYNTHETIC',durationSemantics:['PERMANENT','TRANSIENT','INTERMITTENT','PROGRESSIVE']}));
export function createSpacecraft(index,scenario) {
 const id=`SAT-${String.fromCharCode(65+index)}`;
 const specs=[
 ['alpha','Executive processor','PCB-\u03b1 \u00b7 Executive','compute',['F-01']],
 ['rail','3.3 V regulated rail','PCB-\u03b2 \u00b7 Power regulation','rail',['F-02']],
 ['radio','S-band transceiver','PCB-\u03b3 \u00b7 Communications','radio',['F-05']],
 ['nav','Navigation sensor','PCB-\u03b4 \u00b7 Guidance & control','navigation',['F-07']],
 ['wheel','Reaction wheel','PCB-\u03b4 \u00b7 Guidance & control','actuator',['F-08']],
 ['dock','Protected docking port','PCB-\u03c8 \u00b7 Docking interface','dock',['F-10']],
 ['bus','Management bus','PCB-\u03a9 \u00b7 Motherboard','bus',['F-06']],
 ['solar','Deployable solar array','Subsystem-\u03be \u00b7 Energy','solar',['F-03']],
 ['battery','Lithium-ion battery','Subsystem-\u03be \u00b7 Energy','battery',['F-04']],
 ['thermal','Thermal rejection node','Subsystem-\u03be \u00b7 Energy','thermal',['F-09']],
 ['payload','Multispectral imager','Mission \u00b7 Earth observation','payload',['F-11']],
 ['monitor','Telemetry sensor','PCB-\u03a9 \u00b7 Motherboard','monitor',['F-12']],
 ];
 const near=['E2','E4','E6'].includes(scenario.id),energy= scenario.id==='E4'&&index===0?24.25:84;
 return {id,name:index===0?'ASTER':index===1?'LYRA':`VEIL ${index+1}`,role:index===0?'Earth observation':'Compute & relay',classId:'OSV-6U',health:'OPERATIONAL',observedHealth:'OPERATIONAL',energyWh:energy,lastObservedEnergyWh:energy,capacityWh:120,reserveWh:24,solarW:20,loadW:8,temperatureK:310,observedTemperatureK:310,temperatureHistory:[],energyHistory:[],dryMassKg:12,propellantKg:.45,torqueNm:.002,conductance:.2,computeQuality:1,radioKbps:256,interfaceVersion:scenario.id==='E5'&&index===1?'2.0':'1.0',authorized:true,observationValid:true,observedAt:0,orbit:{radius:EARTH_RADIUS+500000+(near?0:index*18000),eccentricity:0,inclination:(near?51.6:51.6+index*4)*Math.PI/180,raan:(near?-.35:-.35+index*.12),phase:.58+(near?index*.00008:index*.33)},position:[],velocity:[],quaternion:[0,0,0,1],angularRateRadps:[0,0,0],inertiaKgm2:[.18,.18,.08],components:specs.map(([key,name,board,targetClass,faultClasses])=>({id:`${id}-${key}`,name,board,targetClass,health:'OPERATIONAL',observedHealth:'OPERATIONAL',faultClasses,temperatureK:310,powerW:key==='alpha'?2:0,dependencies:key==='alpha'?[`${id}-rail`,`${id}-bus`]:[],observedAt:0,confidence:1,faultability:true,incidents:[]})),capabilities:[{id:`${id}-compute`,name:'image.process',version:'1.0',quality:1,available:true,allowedModes:['C0','C1','C2','C3'],input:'image/raw-v1',output:'image/product-v1',capacity:1},{id:`${id}-relay`,name:'data.relay',version:'1.0',quality:1,available:true,allowedModes:['C1','C2','C3'],input:'bytes/v1',output:'bytes/v1'}],mission:{name:index===0?'Multispectral surface mapping':'Orbital data relay',status:'EXECUTING',quality:1,availability:1,assisted:false,requiredQuality:.8,deadline:3600,tasks:[{id:`${id}-acquire`,name:'Acquire observation',status:'COMPLETED',provider:id,quality:1},{id:`${id}-process`,name:'Process image product',status:'EXECUTING',provider:id,quality:1,prerequisites:[`${id}-acquire`]},{id:`${id}-deliver`,name:'Verify & downlink',status:'WAITING',provider:id,prerequisites:[`${id}-process`]}]}};
}
