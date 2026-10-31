import {EARTH_RADIUS} from './physics.js';
import {makeSpecialistBoards} from './specialist-boards.js';
export const SATELLITE_NAMES = ['AURORA', 'ATLAS', 'ORION', 'VEGA', 'NOVA', 'HELIOS'];
export const scenarios = [
 {id:'VEIL-REF-01',name:'Orbital symbiosis',description:'A two-spacecraft research constellation. Introduce a fault to explore autonomous recovery.',mode:'C1',fault:null},
 {id:'E0',name:'Independent baseline',description:'Processor loss with peer assistance disabled.',mode:'C0',fault:'F-01',cooperationEnabled:false},
 {id:'E1',name:'Wireless capability recovery',description:'A compatible peer fulfils an imaging processing task over a bounded crosslink.',mode:'C1',fault:'F-01'},
 {id:'E2',name:'Temporary physical support',description:'A validated near-coorbital pair approaches, captures, transfers bounded power, and separates.',mode:'C2',fault:'F-03',permitsPhysical:true,solarPausesMission:true},
 {id:'E3',name:'Reciprocal work',description:'Compatible reciprocal processing and relay services with separately recorded costs.',mode:'C1',fault:'F-01',reciprocalService:true},
 {id:'E4',name:'Emergency power / reserve',description:'A low-energy receiver needs support before its survival reserve is exhausted.',mode:'C2',fault:'F-03',permitsPhysical:true,emergency:true,solarPausesMission:true},
 {id:'E5',name:'Cross-generation interface',description:'Direct interfaces are incompatible; compatible semantic wireless services remain eligible.',mode:'C1',fault:'F-01'},
 {id:'E6',name:'Persistent integration',description:'A near-coorbital pair evaluates longer-lived integration and updated inertia.',mode:'C3',fault:'F-03',permitsPhysical:true,permitsIntegration:true,solarPausesMission:true,reducedPhysicalBenefit:true},
].map(x=>({
 // Declared capability flags. The planner and the physical model read these
 // rather than matching on a scenario identifier.
 permitsPhysical:false,permitsIntegration:false,emergency:false,cooperationEnabled:true,
 solarPausesMission:false,reducedPhysicalBenefit:false,reciprocalService:false,
 ...x,scenario_id:x.id,schema_version:'1.0',fidelity:'P2 SYNTHETIC REFERENCE',duration:86400,seed:20261029,modelValidity:'Closed-form two-body Kepler orbits; first-order thermal; geometric radio; bounded near-coorbital approach proxy. Not flight qualified.'}));
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
// Two versioned manifests. OSV-REF names the reference 6U bus by its board
// designators; GENERAL-REF is the hardware-agnostic equivalent, carrying the same
// modelled roles and fault classes under functional names so a scenario can run
// without assuming the OSV layout. Both declare the same physics.
export const manifests={
 'OSV-REF':{id:'OSV-REF',classId:'OSV-6U',version:'1.0',provenance:'P2 SYNTHETIC',description:'Reference 6U orbital service vehicle, board-designator naming.',
  boards:{alpha:'PCB-\u03b1 \u00b7 Executive',rail:'PCB-\u03b2 \u00b7 Power regulation',radio:'PCB-\u03b3 \u00b7 Communications',gnc:'PCB-\u03b4 \u00b7 Guidance & control',dock:'PCB-\u03c8 \u00b7 Docking interface',bus:'PCB-\u03a9 \u00b7 Motherboard',energy:'Subsystem-\u03be \u00b7 Energy',mission:'Mission \u00b7 Earth observation'}},
 'GENERAL-REF':{id:'GENERAL-REF',classId:'GENERAL-SC',version:'1.0',provenance:'P2 SYNTHETIC',description:'Hardware-agnostic spacecraft manifest; functional naming, no OSV board assumption.',
  boards:{alpha:'Executive computing',rail:'Regulated power',radio:'Communications',gnc:'Guidance & control',dock:'Cooperative interface',bus:'Internal bus',energy:'Energy storage & generation',mission:'Mission payload'}},
};
// Declared board elements the dossier requires in the manifest. They are not
// independently faultable: each follows its modelled parent through the existing
// dependency mechanism, so they add no hazard draws and invent no new physics.
const declaredElements=[
 ['watchdog','Watchdog timer','alpha','alpha'],['executive-service','Executive service','alpha','alpha'],
 ['scheduler','Task scheduler','alpha','alpha'],['config-store','Configuration store','alpha','alpha'],
 ['boot-state','Boot / reset state','alpha','alpha'],
 ['power-input','Input power link','rail','rail'],['protections','Protections & switches','rail','rail'],
 ['rail-sensors','Rail voltage / current sensors','rail','rail'],['eps-supervisor','EPS supervisor','rail','rail'],
 ['rf-a','RF-A critical link','radio','radio'],['rf-b','RF-B mission link','radio','radio'],
 ['rf-c','RF-C peer link','radio','radio'],['radio-controller','Radio controller','radio','radio'],
 ['radio-buffers','Link buffers','radio','radio'],
 ['estimator','Attitude estimator','gnc','nav'],['docking-controller','Docking controller','gnc','wheel'],
 ['psi-management','Management link','dock','dock'],['psi-route','Route fabric','dock','dock'],
 ['psi-transfer','Transfer path','dock','dock'],['psi-isolation','Isolation & protection','dock','dock'],
 ['contact-sensor','Contact sensor','dock','dock'],
 ['mcu','Management MCU','bus','bus'],['slot-power','Slot presence & power','bus','bus'],
 ['serial-fabric','CAN / I2C / SPI / UART fabric','bus','bus'],
 ['bms','Battery management','energy','battery'],['mppt','Solar MPPT','energy','solar'],
 ['charge-path','External charging path','energy','battery'],
 ['payload-datapath','Payload data path','mission','payload'],
];
export function createSpacecraft(index,scenario,manifestId='OSV-REF') {
 const id=`SAT-${String.fromCharCode(65+index)}`;
 const manifest=manifests[manifestId]||manifests['OSV-REF'];
 const specs=[
 ['alpha','Executive processor','alpha','compute',['F-01']],
 ['rail','3.3 V regulated rail','rail','rail',['F-02']],
 ['radio','S-band transceiver','radio','radio',['F-05']],
 ['nav','Navigation sensor','gnc','navigation',['F-07']],
 ['wheel','Reaction wheel','gnc','actuator',['F-08']],
 ['dock','Protected docking port','dock','dock',['F-10']],
 ['bus','Management bus','bus','bus',['F-06']],
 ['solar','Deployable solar array','energy','solar',['F-03']],
 ['battery','Lithium-ion battery','energy','battery',['F-04']],
 ['thermal','Thermal rejection node','energy','thermal',['F-09']],
 ['payload','Multispectral imager','mission','payload',['F-11']],
 ['monitor','Telemetry sensor','bus','monitor',['F-12']],
 ];
 const near=['E2','E4','E6'].includes(scenario.id),energy= scenario.id==='E4'&&index===0?24.25:84;
 return {id,name:SATELLITE_NAMES[index] || `VEIL ${index+1}`,role:index===0?'Earth observation':'Compute & relay',classId:manifest.classId,manifestId:manifest.id,manifestVersion:manifest.version,health:'OPERATIONAL',observedHealth:'OPERATIONAL',energyWh:energy,lastObservedEnergyWh:energy,capacityWh:120,reserveWh:24,solarW:20,loadW:8,temperatureK:310,observedTemperatureK:310,temperatureHistory:[],energyHistory:[],dryMassKg:12,propellantKg:.45,torqueNm:.002,conductance:.2,computeQuality:1,radioKbps:256,interfaceVersion:scenario.id==='E5'&&index===1?'2.0':'1.0',authorized:true,observationValid:true,observedAt:0,orbit:{radius:EARTH_RADIUS+500000+(near?index*2:index*18000),eccentricity:0,inclination:(near?51.6:51.6+index*4)*Math.PI/180,raan:(near?-.35:-.35+index*.12),phase:.58+(near?index*.00008:index*.33)},position:[],velocity:[],quaternion:[0,0,0,1],angularRateRadps:[0,0,0],inertiaKgm2:[.18,.18,.08],components:[...specs.map(([key,name,boardKey,targetClass,faultClasses])=>({id:`${id}-${key}`,name,board:manifest.boards[boardKey],boardKey,targetClass,health:'OPERATIONAL',observedHealth:'OPERATIONAL',faultClasses,temperatureK:310,powerW:key==='alpha'?2:0,dependencies:key==='alpha'?[`${id}-rail`,`${id}-bus`]:[],observedAt:0,confidence:1,faultability:true,incidents:[]})),...declaredElements.map(([key,name,boardKey,parent])=>({id:`${id}-${key}`,name,board:manifest.boards[boardKey],boardKey,targetClass:'declared',simulationStatus:'DECLARED',health:'OPERATIONAL',observedHealth:'OPERATIONAL',faultClasses:[],temperatureK:310,powerW:0,dependencies:[`${id}-${parent}`],observedAt:0,confidence:1,faultability:false,incidents:[]})),...makeSpecialistBoards(index,id)],capabilities:[{id:`${id}-compute`,name:'image.process',version:'1.0',quality:1,available:true,allowedModes:['C0','C1','C2','C3'],input:'image/raw-v1',output:'image/product-v1',capacity:1},{id:`${id}-relay`,name:'data.relay',version:'1.0',quality:1,available:true,allowedModes:['C1','C2','C3'],input:'bytes/v1',output:'bytes/v1'}],mission:{name:index===0?'Multispectral surface mapping':'Orbital data relay',status:'EXECUTING',quality:1,availability:1,assisted:false,requiredQuality:.8,deadline:3600,tasks:[{id:`${id}-acquire`,name:'Acquire observation',status:'COMPLETED',provider:id,quality:1},{id:`${id}-process`,name:'Process image product',status:'EXECUTING',provider:id,quality:1,prerequisites:[`${id}-acquire`]},{id:`${id}-deliver`,name:'Verify & downlink',status:'WAITING',provider:id,prerequisites:[`${id}-process`]}]}};
}
