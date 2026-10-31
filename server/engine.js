import {randomUUID, createHash} from 'node:crypto';
import {scenarios, faultModels, createSpacecraft, manifests} from './catalog.js';
import {MODEL_VERSION, clamp, norm, sub, propagateOrbit, inEclipse, linkGeometry, thermalAt, exponentialWait, weibullWait, nextRandom} from './physics.js';
import {initializeCommunications, updateCommunications, communicationSnapshot} from './communications.js';
import {boardSafety, faultEngineSummary} from './board-safety.js';
import {initializeTelemetry, sampleTelemetry, recordTelemetry, truncateTelemetry, telemetryCatalog, telemetrySeries} from './telemetry.js';
import {weights, normalization, agentView, candidate, planningContext, rankCandidates, viewPriority, consent, viewConfidence} from './planner.js';
export class SimulationError extends Error { constructor(code,message,status=400){super(message);this.code=code;this.status=status;} }
const fail=(code,message,status)=>{throw new SimulationError(code,message,status)};
const copy=o=>structuredClone(o);
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const validModes=['HYBRID','MANUAL','AUTOMATIC'];
export {telemetryCatalog, telemetrySeries};
export {weights};
const CONSERVATION_TOLERANCE_WH=1e-9;
// Separation is a commanded impulse with a propellant cost, not a free state
// change. Effective exhaust velocity is a P2 synthetic figure.
const SEPARATION_IMPULSE_MPS=.02,EFFECTIVE_EXHAUST_MPS=2000,RELEASE_STANDOFF_M=.4;
// Named deterministic streams. Hazard keeps the historical sequence so seeded
// schedules are unchanged; scenario covers initialization draws.
const streamState=(run,name)=>{run.rngStreams??={hazard:run.rng??run.seed??0,scenario:((run.seed??0)^0x9e3779b9)>>>0};
 return {get rng(){return run.rngStreams[name]},set rng(v){run.rngStreams[name]=v;if(name==='hazard')run.rng=v;}};};
export const LIMITATIONS=['P2 synthetic research demonstrator; no hardware calibration or flight qualification.','Closed-form Keplerian two-body propagation omits J2, drag, radiation pressure and collision prediction.','Proximity guidance is a bounded coorbital relative-motion proxy with explicit speed/acceleration gates; no flight-qualified 6-DOF GNC.','Single-node analytical thermal response and geometric communication windows; no calibrated RF link budget.','Mission evidence is a deterministic synthetic artifact/quality predicate, not real imagery or hardware repair.','Separation is modelled as a declared along-track impulse: the simplified propagator carries no argument of periapsis, so a released vehicle resumes on the formation orbit rather than from an integrated post-impulse state vector.','Reference UI and memory performance targets have not been measured on reference hardware.'];
export function makeRun(options={}) {
 if(options.schemaVersion&&String(options.schemaVersion).split('.')[0]!=='1'||options.schema_version&&String(options.schema_version).split('.')[0]!=='1')fail('VERSION_MISMATCH','Scenario schema major version must be 1.');
 const scenario=scenarios.find(x=>x.id===(options.scenarioId||options.scenario_id||'VEIL-REF-01'));
 if(!scenario) fail('INVALID_PARAMETER','Unknown scenario. Choose VEIL-REF-01 or E0–E6.');
 const seed=Number(options.seed??20261029); if(!Number.isInteger(seed)||seed<0||seed>4294967295) fail('INVALID_PARAMETER','Seed must be an unsigned 32-bit integer.');
 if(options.hazardModel&&!['EXPONENTIAL','WEIBULL'].includes(options.hazardModel))fail('INVALID_PARAMETER','Hazard model must be EXPONENTIAL or WEIBULL.');if(options.hazardModel==='WEIBULL'){numeric(options.weibullBeta,'Weibull beta',.001,100);numeric(options.weibullEtaHours,'Weibull etaHours',.001,1e9);}if(options.hazardPerNodeHour!==undefined)numeric(options.hazardPerNodeHour,'Hazard per node-hour',0,1000);if(options.sampleIntervalS!==undefined)numeric(options.sampleIntervalS,'Telemetry sample interval',1,3600);if(options.telemetryMaxPoints!==undefined)numeric(options.telemetryMaxPoints,'Telemetry history depth',10,20000);
 const count=Number(options.spacecraftCount||options.spacecraft_count||2);if(!Number.isInteger(count)||count<2||count>10)fail('INVALID_PARAMETER','Spacecraft count must be an integer between 2 and 10.');
 const manifestId=options.manifestId||options.manifest_id||'OSV-REF';if(!manifests[manifestId])fail('INVALID_PARAMETER',`Unknown manifest. Choose ${Object.keys(manifests).join(' or ')}.`);
 const policy=options.policyId||options.policy_id||'B3'; if(!['B0','B1','B2','B3'].includes(policy))fail('INVALID_PARAMETER','Policy must be B0, B1, B2 or B3.');
 const faultMode=options.faultMode||'HYBRID';if(!validModes.includes(faultMode))fail('INVALID_PARAMETER','Fault mode must be HYBRID, MANUAL or AUTOMATIC.');
 const run={schemaVersion:'1.0',runId:randomUUID(),revision:0,lastCommandRevision:0,scenarioId:scenario.id,scenario:copy(scenario),seed,policyId:policy,time:0,epoch:'2026-10-29T00:00:00.000Z',playing:false,timeScale:10,faultMode,profile:'P2 SYNTHETIC REFERENCE',rng:seed,rngStreams:{hazard:seed,scenario:(seed^0x9e3779b9)>>>0},manifestId,manifest:{...manifests[manifestId],boards:undefined},spacecraft:Array.from({length:count},(_,i)=>createSpacecraft(i,scenario,manifestId)),events:[],faults:[],decisions:[],contracts:[],connections:[],ledger:[],queue:[],sequence:0,eventCounter:0,commandResults:{},checkpoints:[],metrics:{verifiedAvailability:1,missionAvailability:1,missionSuccess:0,recoveryTimeS:null,energyExportedWh:0,energyReceivedWh:0,transferLossWh:0,dataTransferredMbit:0,propellantUsedKg:0,rejectedCandidates:0,safetyViolations:0,abortedActions:0,unnecessaryDocking:0,conservationResidualWh:0,conservationWorstResidualWh:0,dataLostMbit:0},modelVersion:MODEL_VERSION,limitations:LIMITATIONS,storage:'Local JSON journal',numericalConfig:{orbit:'Closed-form Kepler Newton solve, 12 iterations',resourceStepS:1,eventPrecisionS:.001,thermal:'Analytical constant-coefficient lumped node'},config:{hazardPerNodeHour:options.hazardPerNodeHour??.0002,hazardModel:options.hazardModel||'EXPONENTIAL',weibullBeta:options.weibullBeta,weibullEtaHours:options.weibullEtaHours,spontaneousEnabled:faultMode!=='MANUAL',maxDurationS:86400},availabilityIntegral:0,thresholdWatches:[],energyAudit:{lastClosing:null,reclaimed:0},observationLog:[],initialOptions:{scenarioId:scenario.id,seed,spacecraftCount:count,policyId:policy,manifestId,faultMode,hazardModel:options.hazardModel||'EXPONENTIAL',hazardPerNodeHour:options.hazardPerNodeHour??.0002,weibullBeta:options.weibullBeta,weibullEtaHours:options.weibullEtaHours}};
 const initRng=streamState(run,'scenario'),phaseJitter=(nextRandom(initRng)-.5)*.2,raanJitter=(nextRandom(initRng)-.5)*.15;for(const sat of run.spacecraft){sat.orbit.phase+=phaseJitter;sat.orbit.raan+=raanJitter;Object.assign(sat,propagateOrbit(sat.orbit,0));sat.navPosition=[...sat.position];sat.navVelocity=[...sat.velocity];sat.navAt=0;sat.eclipse=inEclipse(sat.position);sat.solarW=sat.eclipse?0:(sat.availableSolarW??20);scheduleHazards(run,sat);}
 if(scenario.fault) enqueue(run,{kind:'fault',at:20,spacecraftId:'SAT-A',componentId:`SAT-A-${scenario.fault==='F-01'?'alpha':'solar'}`,modelId:scenario.fault,origin:'SCENARIO_AUTO',parameters:{},duration:'PERMANENT'});
 event(run,'RUN_CREATED','info',null,`Loaded ${scenario.id} · ${scenario.name}. All reference parameters are synthetic.`);
 initializeCommunications(run);initializeTelemetry(run,{sampleIntervalS:options.sampleIntervalS,maxPoints:options.telemetryMaxPoints});recordTelemetry(run,'INIT');
 run.initialState=copy({...run,initialState:undefined,telemetry:undefined}); return run;
}
function id(run,prefix='EVT'){return `${prefix}-${String(++run.eventCounter).padStart(6,'0')}`;}
export function event(run,type,severity,spacecraftId,message,extra={}) {const entry={id:id(run),schemaVersion:'1.0',time:run.time,type,severity,spacecraftId,message,sequence:++run.sequence,...extra};run.events.push(entry);return entry;}
// Priority reflects an observed need for help, not spacecraft identity. Lower
// levels are more urgent; reserve and deadline remain explicit in the result.
export function spacecraftPriority(run,sat){
 const observedEnergy=sat.observationValid?sat.energyWh:sat.lastObservedEnergyWh??sat.energyWh;
 const energyMarginWh=Math.max(0,observedEnergy-sat.reserveWh),deadlineRemainingS=Math.max(0,sat.mission.deadline-run.time);
 const critical=energyMarginWh<=3||(['PAUSED','DEGRADED'].includes(sat.mission.status)&&deadlineRemainingS<=120);
 const high=!critical&&(sat.observedHealth==='FAILED'||sat.observedHealth==='DEGRADED'||['PAUSED','DEGRADED'].includes(sat.mission.status)||energyMarginWh<=15);
 const level=critical?1:high?2:3;
 const reason=critical?(energyMarginWh<=3?'Energy reserve nearly exhausted':'Mission deadline approaching'):high?(['PAUSED','DEGRADED'].includes(sat.mission.status)?'Mission needs assistance':sat.observedHealth!=='OPERATIONAL'?'Observed health degraded':'Energy reserve margin reduced'):'Nominal mission and reserve';
 return {level,label:['','Critical','High','Normal'][level],reason,energyMarginWh,deadlineRemainingS};
}
function queueOrder(run,a,b){
 const urgency=q=>['observe','replan'].includes(q.kind)?spacecraftPriority(run,run.spacecraft.find(s=>s.id===q.spacecraftId)||{energyWh:0,reserveWh:0,observationValid:true,observedHealth:'UNKNOWN',mission:{deadline:run.time,status:'UNKNOWN'}}).level:0;
 return a.at-b.at||a.priority-b.priority||urgency(a)-urgency(b)||String(a.spacecraftId).localeCompare(String(b.spacecraftId))||a.id.localeCompare(b.id);
}
function enqueue(run,item){const entry={id:id(run,'Q'),priority:item.kind==='fault'?0:1,...item};run.queue.push(entry);run.queue.sort((a,b)=>queueOrder(run,a,b));return entry;}
function hazardWait(run){const stream=streamState(run,'hazard');return run.config.hazardModel==='WEIBULL'?weibullWait(stream,run.config.weibullBeta,run.config.weibullEtaHours,run.time/3600):run.config.hazardPerNodeHour>0?exponentialWait(stream,run.config.hazardPerNodeHour):1e15;}
function scheduleHazards(run,sat){for(const comp of sat.components.filter(c=>c.faultability!==false&&c.faultClasses?.length))enqueue(run,{kind:'fault',at:run.time+hazardWait(run),spacecraftId:sat.id,componentId:comp.id,modelId:comp.faultClasses[0],origin:'STOCHASTIC',parameters:{},duration:'PERMANENT'});}
function satellite(run,id){return run.spacecraft.find(s=>s.id===id)||fail('UNKNOWN_SPACECRAFT',`Spacecraft ${id} does not exist.`,404);}
function component(sat,id){return sat.components.find(c=>c.id===id)||fail('UNKNOWN_COMPONENT',`Component ${id} is not in ${sat.id}'s manifest.`,404);}
function numeric(x,name,min,max){x=Number(x);if(!Number.isFinite(x)||x<min||x>max)fail('INVALID_PARAMETER',`${name} must be between ${min} and ${max}.`);return x;}
export function validateMutation(run,payload){
 if(!payload.commandId&&!payload.command_id)fail('INVALID_PARAMETER','A unique commandId is required.');const key=payload.commandId||payload.command_id;
 run.commandResults ||= {};if(run.commandResults[key])return {duplicate:true,result:copy(run.commandResults[key])};
 const revision=payload.expectedRevision??payload.expected_state_revision;if(!Number.isInteger(revision))fail('INVALID_PARAMETER','expectedRevision is required.');
 // Ticks advance the physical snapshot, but only accepted operator commands
 // invalidate another operator's intention. Every command still validates its
 // own guards against the current physical state before applying any effect.
 if(!Number.isInteger(run.lastCommandRevision)||run.lastCommandRevision<0||run.lastCommandRevision>run.revision)run.lastCommandRevision=run.revision;
 if(revision<run.lastCommandRevision||revision>run.revision)fail('REVISION_CONFLICT','Another command changed the run. Refresh the current snapshot and retry.',409);return {key};
}
export function completeMutation(run,key,metadata={}){run.revision++;run.lastCommandRevision=run.revision;run.commandResults[key]={runId:run.runId,revision:run.revision,accepted:true,...metadata};if(Object.keys(run.commandResults).length>1000)delete run.commandResults[Object.keys(run.commandResults)[0]];return snapshot(run);}
export function control(run,payload){const check=validateMutation(run,payload);if(check.duplicate)return snapshot(run);const action=payload.action;
 switch(action){case 'play':run.playing=true;break;case 'pause':run.playing=false;break;case 'step':advance(run,numeric(payload.seconds??payload.value??10,'Step seconds',.001,86400));break;case 'time_scale':run.timeScale=numeric(payload.value??payload.timeScale,'Time scale',1,100);break;
 case 'fault_mode':{const mode=payload.value??payload.faultMode;if(!validModes.includes(mode))fail('INVALID_PARAMETER','Choose HYBRID, MANUAL or AUTOMATIC.');const enabled=mode!=='MANUAL';if(enabled&&!run.config.spontaneousEnabled){for(const q of run.queue.filter(x=>x.kind==='fault'&&x.origin==='STOCHASTIC'))q.at=run.time+hazardWait(run);run.queue.sort((a,b)=>a.at-b.at);}run.faultMode=mode;run.config.spontaneousEnabled=enabled;event(run,'FAULT_MODE','info',null,`${mode} selected; existing physical faults remain active.`);break;}
 case 'reset':{run.telemetry=undefined;const fresh=makeRun(run.initialOptions);fresh.runId=run.runId;fresh.revision=run.revision;fresh.lastCommandRevision=run.lastCommandRevision;fresh.commandResults=run.commandResults;Object.assign(run,fresh);break;}
 case 'load_checkpoint':{const point=run.checkpoints.find(c=>c.id===(payload.value??payload.checkpointId));if(!point)fail('INVALID_PARAMETER','Checkpoint not found.');restoreCheckpoint(run,point);break;}
 case 'release':requestSeparation(run,payload.connectionId||payload.value);break;case 'clear_fault':clearFault(run,payload.faultId||payload.value);break;default:fail('INVALID_PARAMETER',`Unsupported control action: ${action}`);
 }return completeMutation(run,check.key);
}
export function injectFault(run,payload){
 const check=validateMutation(run,payload);if(check.duplicate)return snapshot(run);const sat=satellite(run,payload.spacecraftId||payload.spacecraft_id),comp=component(sat,payload.componentId||payload.component_id);
 const modelId=payload.modelId||payload.model_id,definition=faultModels.find(x=>x.id===modelId);if(!definition||!comp.faultClasses.includes(modelId))fail('UNSUPPORTED_FAULT',`${modelId} incompatible with ${comp.name}; choose ${comp.faultClasses.join(', ')}.`);
 if(run.faultMode==='AUTOMATIC')fail('INVALID_PARAMETER','Select HYBRID or MANUAL before manual injection.');const at=numeric(payload.activationTime??payload.scheduled_s??run.time,'Activation time',run.time,run.time+86400);
 const duration=payload.duration||'PERMANENT';if(!definition.durationSemantics.includes(duration))fail('INVALID_PARAMETER','Unsupported duration semantics.');const parameters=copy(payload.parameters||{});if(duration==='PROGRESSIVE'&&parameters.effect===undefined)parameters.effect='degraded';if(parameters.durationS!==undefined)numeric(parameters.durationS,'Transient duration',.001,86400);if(parameters.periodS!==undefined)numeric(parameters.periodS,'Intermittent period',.1,86400);if(parameters.cycles!==undefined)numeric(parameters.cycles,'Intermittent cycles',1,100);if(parameters.packetLoss!==undefined){numeric(parameters.packetLoss,'Packet loss fraction',0,1);if(modelId!=='F-05')fail('INVALID_PARAMETER','Packet loss is only defined for F-05 radio faults.');}if(parameters.hazardModel==='WEIBULL'){numeric(parameters.beta,'Weibull beta',.001,100);numeric(parameters.etaHours,'Weibull etaHours',.001,1e9);}if(parameters.effect!==undefined&&!['failed','degraded','bias','freeze'].includes(parameters.effect))fail('INVALID_PARAMETER','Effect must be failed, degraded, bias or freeze.');
 if(payload.trigger){const watch=armThreshold(run,sat,comp,modelId,duration,parameters,payload.trigger);return completeMutation(run,check.key,{watchId:watch.id});}
 const queued=enqueue(run,{kind:'fault',at,spacecraftId:sat.id,componentId:comp.id,modelId,origin:'MANUAL',duration,parameters:copy(parameters)});run.faults.push({...queued,status:'SCHEDULED',observationState:'UNKNOWN',diagnosisState:'UNASSESSED',rootId:queued.id,parentId:null,provenance:'P2 SYNTHETIC'});event(run,'FAULT_SCHEDULED','warning',sat.id,`${definition.name} ${at<=run.time?'injected now':`scheduled at T+${at.toFixed(1)} s`}.`,{componentId:comp.id,rootId:queued.id});processDue(run);return completeMutation(run,check.key);
}
const THRESHOLD_SIGNALS=['temperatureK','observedTemperatureK','energyWh'];
function armThreshold(run,sat,comp,modelId,duration,parameters,trigger){
 const signal=trigger.signal;if(!THRESHOLD_SIGNALS.includes(signal))fail('INVALID_PARAMETER',`Threshold signal must be one of ${THRESHOLD_SIGNALS.join(', ')}.`);
 if(trigger.above===undefined&&trigger.below===undefined)fail('INVALID_PARAMETER','A threshold trigger needs above or below.');
 if(trigger.above!==undefined)numeric(trigger.above,'Threshold above',-1e9,1e9);
 if(trigger.below!==undefined)numeric(trigger.below,'Threshold below',-1e9,1e9);
 const persistenceS=trigger.persistenceS===undefined?0:numeric(trigger.persistenceS,'Threshold persistence',0,86400);
 const releaseForS=trigger.releaseForS===undefined?null:numeric(trigger.releaseForS,'Threshold release window',0,86400);
 if(releaseForS!==null&&duration==='PERMANENT')fail('INVALID_PARAMETER','A permanent fault has no release path; use a clearable duration with releaseForS.');
 if(trigger.releaseAbove!==undefined)numeric(trigger.releaseAbove,'Release above',-1e9,1e9);
 if(trigger.releaseBelow!==undefined)numeric(trigger.releaseBelow,'Release below',-1e9,1e9);
 const watch={id:id(run,'WATCH'),spacecraftId:sat.id,componentId:comp.id,modelId,duration,parameters:copy(parameters),
  signal,above:trigger.above,below:trigger.below,persistenceS,releaseForS,releaseAbove:trigger.releaseAbove,releaseBelow:trigger.releaseBelow,
  state:'ARMED',heldSinceS:null,releaseSinceS:null,faultId:null,provenance:'P2 SYNTHETIC'};
 run.thresholdWatches.push(watch);
 event(run,'THRESHOLD_ARMED','info',sat.id,`${modelId} armed on ${signal} ${watch.above!==undefined?'above '+watch.above:'below '+watch.below} for ${persistenceS} s.`,{componentId:comp.id,watchId:watch.id});
 return watch;
}
const thresholdMet=(watch,value)=>watch.above!==undefined?value>=watch.above:value<=watch.below;
const releaseMet=(watch,value)=>watch.releaseBelow!==undefined?value<=watch.releaseBelow:watch.releaseAbove!==undefined?value>=watch.releaseAbove:!thresholdMet(watch,value);
function evaluateThresholds(run,dt){
 for(const watch of run.thresholdWatches){
  const sat=run.spacecraft.find(s=>s.id===watch.spacecraftId);if(!sat)continue;const value=sat[watch.signal];if(!Number.isFinite(value))continue;
  if(watch.state==='ARMED'){
   if(thresholdMet(watch,value)){watch.heldSinceS??=run.time-dt;
    if(run.time-watch.heldSinceS>=watch.persistenceS-1e-9){
     const queued=enqueue(run,{kind:'fault',at:run.time,spacecraftId:sat.id,componentId:watch.componentId,modelId:watch.modelId,origin:'THRESHOLD',duration:watch.duration,parameters:copy(watch.parameters)});
     watch.state='TRIPPED';watch.faultId=queued.id;watch.releaseSinceS=null;
     event(run,'THRESHOLD_TRIPPED','warning',sat.id,`${watch.signal} held ${watch.above!==undefined?'above '+watch.above:'below '+watch.below} for ${watch.persistenceS} s; ${watch.modelId} triggered.`,{componentId:watch.componentId,watchId:watch.id,rootId:queued.id});
    }
   }else watch.heldSinceS=null;
  }else if(watch.state==='TRIPPED'&&watch.releaseForS!==null){
   if(releaseMet(watch,value)){watch.releaseSinceS??=run.time-dt;
    if(run.time-watch.releaseSinceS>=watch.releaseForS-1e-9){
     const fault=run.faults.find(f=>f.id===watch.faultId&&f.status==='ACTIVE');
     if(fault)clearFault(run,fault.id);
     watch.state='ARMED';watch.heldSinceS=null;watch.releaseSinceS=null;watch.faultId=null;
     event(run,'THRESHOLD_RELEASED','success',sat.id,`${watch.signal} stayed clear for ${watch.releaseForS} s; ${watch.modelId} released and re-armed.`,{componentId:watch.componentId,watchId:watch.id});
    }
   }else watch.releaseSinceS=null;
  }
 }
}
function applyFault(run,q){
 if(run.faults.some(x=>x.id===q.id&&x.status!=='SCHEDULED'))return;const sat=satellite(run,q.spacecraftId),comp=component(sat,q.componentId);const suppressed=q.origin!=='MANUAL'&&run.faultMode==='MANUAL';
 const fault={...q,scheduledS:q.at,activatedS:suppressed?null:run.time,status:suppressed?'SUPPRESSED':'ACTIVE',observationState:'UNKNOWN',diagnosisState:'UNASSESSED',rootId:q.rootId||q.id,parentId:q.parentId||null,schemaVersion:'1.0',provenance:'P2 SYNTHETIC'};const existing=run.faults.findIndex(x=>x.id===q.id);if(existing>=0)run.faults[existing]=fault;else run.faults.push(fault);
 if(q.origin==='STOCHASTIC')enqueue(run,{...q,id:id(run,'Q'),at:run.time+hazardWait(run)});
 if(suppressed){event(run,'FAULT_SUPPRESSED','info',sat.id,`${q.modelId} automatic incident suppressed.`,{rootId:q.id,componentId:comp.id});return;}
 comp.incidents.push(q.id);recordTelemetry(run,'FAULT');event(run,'FAULT_ACTIVE','critical',sat.id,`${comp.name}: ${faultModels.find(x=>x.id===q.modelId).effect}`,{rootId:q.id,componentId:comp.id,origin:q.origin});recomputePhysical(run,sat);
 if(q.modelId!=='F-12')enqueue(run,{kind:'observe',at:run.time+6,spacecraftId:sat.id,faultId:q.id});
 if(q.duration==='TRANSIENT'||q.duration==='INTERMITTENT')enqueue(run,{kind:'clear',at:run.time+(q.parameters.durationS||60),spacecraftId:sat.id,faultId:q.id});
 if(q.duration==='PROGRESSIVE')enqueue(run,{kind:'progress',at:run.time+(q.parameters.durationS||120),spacecraftId:sat.id,faultId:q.id});
 for(const conn of run.connections.filter(c=>c.participants.includes(sat.id)&&!['COMPLETED','ABORTED'].includes(c.status)))revalidateConnection(run,conn);
}
function recomputePhysical(run,sat){
 for(const comp of sat.components){if(comp.simulationStatus==='CATALOG_ONLY')continue;const active=run.faults.filter(f=>f.componentId===comp.id&&f.status==='ACTIVE'&&f.modelId!=='F-12');comp.health=active.some(f=>f.parameters.effect!=='degraded')?'FAILED':active.length?'DEGRADED':'OPERATIONAL';}
 const health=key=>sat.components.find(c=>c.id===`${sat.id}-${key}`).health;const factor=key=>health(key)==='FAILED'?0:health(key)==='DEGRADED'?.5:1;
 sat.capacityWh=health('battery')==='OPERATIONAL'?120:96;if(sat.energyWh>sat.capacityWh){ledger(run,sat.id,'capacity-unavailable','capacity_reclassification',sat.energyWh-sat.capacityWh,'Wh');run.energyAudit??={lastClosing:null,reclaimed:0};run.energyAudit.reclaimed+=sat.energyWh-sat.capacityWh;sat.unavailableEnergyWh=(sat.unavailableEnergyWh||0)+sat.energyWh-sat.capacityWh;sat.energyWh=sat.capacityWh;}
 sat.packetLoss=Math.max(0,...run.faults.filter(f=>f.spacecraftId===sat.id&&f.modelId==='F-05'&&f.status==='ACTIVE'&&Number.isFinite(f.parameters?.packetLoss)).map(f=>f.parameters.packetLoss),0);
 sat.computeQuality=Math.min(factor('alpha'),factor('rail'),factor('bus'));sat.radioKbps=health('radio')==='FAILED'?0:health('radio')==='DEGRADED'?64:256;sat.torqueNm=.002*factor('wheel');sat.conductance=health('thermal')==='OPERATIONAL'?.2:.06;
 sat.observationValid=!run.faults.some(f=>f.componentId===`${sat.id}-monitor`&&f.status==='ACTIVE'&&f.parameters.effect==='freeze');sat.availableSolarW=health('solar')==='FAILED'?0:health('solar')==='DEGRADED'?4:20;sat.capabilities[0].quality=sat.computeQuality;sat.capabilities[0].available=sat.computeQuality>=.8;sat.capabilities[1].available=sat.radioKbps>0;
 for(const c of sat.components){if(c.simulationStatus==='CATALOG_ONLY')continue;const was=c.dependencyFailure;c.dependencyFailure=c.dependencies.some(dep=>sat.components.find(x=>x.id===dep)?.health==='FAILED');if(c.dependencyFailure){c.health='FAILED';if(!was){const cause=run.faults.find(f=>c.dependencies.includes(f.componentId)&&f.status==='ACTIVE');event(run,'DEPENDENCY_LOSS','warning',sat.id,`${c.name} unavailable because a declared dependency failed.`,{componentId:c.id,rootId:cause?.rootId,parentId:cause?.id});}}}
 sat.health=['alpha','rail','bus','battery'].some(k=>health(k)==='FAILED')?'FAILED':sat.components.some(c=>c.simulationStatus!=='CATALOG_ONLY'&&c.health!=='OPERATIONAL')?'DEGRADED':'OPERATIONAL';
 if(sat.computeQuality<.8&&!sat.mission.assisted){sat.mission.status='PAUSED';sat.mission.quality=0;sat.mission.tasks[1].status='PAUSED';sat.mission.availability=0;}if(health('solar')!=='OPERATIONAL'&&run.scenario.solarPausesMission&&!sat.mission.assisted){sat.mission.status='PAUSED';sat.mission.availability=0;sat.mission.tasks[1].status='PAUSED';}if(health('payload')!=='OPERATIONAL'){sat.mission.quality=factor('payload');sat.mission.availability=0;sat.mission.status='DEGRADED';}
}
// Recovery is measured against the fault this contract was planned for, not the
// first fault ever recorded against the spacecraft.
function recoveryTimeFor(run,contract,sat){
 const decision=run.decisions.find(d=>d.id===contract.decisionId);
 const named=decision?.causeFaultId?run.faults.find(f=>f.id===decision.causeFaultId):null;
 const cause=named??run.faults.filter(f=>f.spacecraftId===sat.id&&Number.isFinite(f.detectedS)).sort((x,y)=>y.detectedS-x.detectedS)[0];
 return Number.isFinite(cause?.detectedS)?run.time-cause.detectedS:null;
}
function observeFault(run,q){const fault=run.faults.find(f=>f.id===q.faultId);if(!fault||fault.status!=='ACTIVE')return;const sat=satellite(run,q.spacecraftId);if(!sat.observationValid)return;const comp=component(sat,fault.componentId);comp.observedHealth=comp.health;comp.observedAt=run.time;comp.confidence=viewConfidence(agentView(run,sat),run.time);fault.observationState='CONFIRMED';fault.diagnosisState='DIAGNOSED';fault.detectedS=run.time;sat.observedHealth=sat.health;sat.observedAt=run.time;event(run,'FAULT_DIAGNOSED','warning',sat.id,`Agent diagnosed unavailable ${comp.name} from local heartbeat/sensor observations.`,{rootId:fault.id,componentId:comp.id});plan(run,sat.id,fault.id);}
export function clearFault(run,faultId){const fault=run.faults.find(f=>f.id===faultId);if(!fault)fail('INVALID_PARAMETER','Fault does not exist.');if(fault.duration==='PERMANENT')fail('UNSUPPORTED_FAULT','Permanent physical fault has no clearing mechanism. External assistance does not repair components.');if(fault.status!=='ACTIVE')return;fault.status='CLEARED';if(fault.duration==='INTERMITTENT'&&(fault.cycle||1)<(fault.parameters.cycles||3)){const {status,observationState,diagnosisState,activatedS,detectedS,scheduledS,...base}=fault;enqueue(run,{...base,id:id(run,'Q'),at:run.time+(fault.parameters.periodS||60),rootId:fault.rootId,parentId:fault.id,cycle:(fault.cycle||1)+1});}const sat=satellite(run,fault.spacecraftId);recomputePhysical(run,sat);event(run,'FAULT_CLEARED','success',sat.id,`${fault.modelId} transient cleared.`,{rootId:fault.id,componentId:fault.componentId});if(sat.observationValid){for(const c of sat.components)if(c.simulationStatus!=='CATALOG_ONLY')c.observedHealth=c.health;sat.observedHealth=sat.health;}}
function ledger(run,source,destination,type,amount,unit,losses=0,contractId=null,extra={}){if(!Number.isFinite(amount)||amount<0)fail('MODEL_INVALID','Ledger rejected non-finite/negative quantity.');const row={id:id(run,'LED'),time:run.time,source,destination,type,amount,unit,losses,contractId,...extra};run.ledger.push(row);return row;}
export function plan(run,spacecraftId,causeFaultId=null){
 const sat=satellite(run,spacecraftId);if(run.contracts.some(c=>c.participants[0]===sat.id&&['PROPOSED','ACCEPTED','RESERVED','AUTHORIZED','ACTIVE'].includes(c.status)))return;const last=run.decisions.findLast(d=>d.spacecraftId===sat.id);if(last&&run.time-last.time<30&&!run.connections.some(c=>c.participants.includes(sat.id)&&c.status==='ABORTED'))return;
 // Agents decide on projections only. Nothing below this line may read a
 // spacecraft record: see the contract at the top of planner.js.
 const ctx=planningContext(run),views=new Map(run.spacecraft.map(s=>[s.id,agentView(run,s)])),self=views.get(sat.id);
 const candidates=[candidate(ctx,self,null,'C0')];
 for(const peer of run.spacecraft.filter(x=>x.id!==sat.id))for(const mode of ['C1','C2','C3'])candidates.push(candidate(ctx,self,views.get(peer.id),mode,viewPriority(views.get(peer.id),run.time)));
 const feasible=rankCandidates(candidates);let chosen=feasible[0];if(run.policyId==='B1')chosen=feasible.find(c=>c.mode==='C1')||chosen;if(run.policyId==='B2')chosen=feasible.find(c=>c.mode==='C2')||feasible.find(c=>c.mode==='C1')||chosen;
 const decision={id:id(run,'DEC'),time:run.time,spacecraftId:sat.id,causeFaultId,requesterPriority:viewPriority(self,run.time),chosenMode:chosen?.mode||'C0',chosenProvider:chosen?.provider||sat.id,candidates,weights:copy(weights),outcome:chosen?.mode==='C0'?'NO FEASIBLE RECOVERY':'PENDING EXECUTION',provenance:'P2 SYNTHETIC',modelVersion:MODEL_VERSION,agentInputs:[...views.values()],normalization:copy(normalization),confidence:viewConfidence(self,run.time),forecastCompletionS:chosen?.completionS??null};run.decisions.push(decision);run.metrics.rejectedCandidates+=candidates.filter(c=>c.status==='REJECTED').length;
 event(run,'DECISION','info',sat.id,chosen?.mode==='C0'?'NO FEASIBLE RECOVERY · continue controlled degradation.':`${chosen.mode} support selected from ${chosen.provider}; weighted score ${chosen.score.toFixed(3)}.`,{decisionId:decision.id});if(chosen&&chosen.mode!=='C0')proposeContract(run,sat,chosen,decision);else if(sat.mission.status!=='EXPIRED')enqueue(run,{kind:'replan',at:run.time+30,spacecraftId:sat.id});return decision;
}
function proposeContract(run,sat,chosen,decision){
 const contract={id:id(run,'SRCC'),revision:1,participants:[sat.id,chosen.provider],mode:chosen.mode,status:'PROPOSED',start:run.time,expiry:run.time+chosen.completionS+120,services:chosen.mode==='C1'?['image.process/v1']:['protected-power/v1'],resourceCaps:{powerW:chosen.mode==='C1'?0:10,energyWh:chosen.mode==='C1'?.15:1.6666666667,dataMbit:chosen.mode==='C1'?8:0},donorReserveWh:24,acceptances:{[sat.id]:false,[chosen.provider]:false},abortConditions:['DONOR_RESERVE','LINK_OR_INTERFACE_LOSS','THERMAL_LIMIT','GNC_LOSS'],decisionId:decision.id,usedEnergyWh:0,usedDataMbit:0,evidenceRefs:[]};run.contracts.push(contract);event(run,'CONTRACT_PROPOSED','info',sat.id,`${contract.id}: bilateral ${chosen.mode} capability contract proposed.`,{contractId:contract.id});for(const [i,state]of ['ACCEPTED','RESERVED','AUTHORIZED','ACTIVE'].entries())enqueue(run,{kind:'contract',at:run.time+i+1,contractId:contract.id,state,spacecraftId:sat.id});
}
function transitionContract(run,q){
 const c=run.contracts.find(x=>x.id===q.contractId);if(!c||['ABORTED','EXPIRED','COMPLETED','REJECTED'].includes(c.status))return;const a=satellite(run,c.participants[0]),b=satellite(run,c.participants[1]);
 if(q.state==='ACCEPTED'){
  // Each side decides from its own view. A plan is a proposal until both accept.
  const decisions={[a.id]:consent(agentView(run,a),'requester',c.resourceCaps),[b.id]:consent(agentView(run,b),'provider',c.resourceCaps)};
  c.acceptances={[a.id]:decisions[a.id].accepted,[b.id]:decisions[b.id].accepted};
  c.acceptanceRecord=Object.fromEntries(Object.entries(decisions).map(([pid,d])=>[pid,{...d,at:run.time}]));
  const vetoed=Object.entries(decisions).filter(([,d])=>!d.accepted);
  if(vetoed.length){c.status='REJECTED';c.conflictCode='CONTRACT_CONFLICT';c.abortReason=vetoed.map(([pid,d])=>`${pid}: ${d.reasons.join(', ')}`).join(' · ');
   event(run,'CONTRACT_REJECTED','warning',a.id,`Local veto — ${c.abortReason}.`,{contractId:c.id});return;}}
 if(q.state==='RESERVED'&&run.contracts.some(other=>other.id!==c.id&&other.participants[1]===b.id&&['RESERVED','AUTHORIZED','ACTIVE'].includes(other.status))){c.status='REJECTED';c.conflictCode='CONTRACT_CONFLICT';c.abortReason='Provider capacity already reserved by another contract.';event(run,'CONTRACT_REJECTED','warning',a.id,'Provider capacity already reserved.',{contractId:c.id,code:'CONTRACT_CONFLICT'});return;}
 c.status=q.state;event(run,`CONTRACT_${q.state}`,'info',a.id,`${c.id} · ${q.state.toLowerCase()}.`,{contractId:c.id});
 if(q.state==='ACTIVE'){
 const physical=c.mode!=='C1',geo=linkGeometry(a,b),conn={id:id(run,'LINK'),contractId:c.id,participants:c.participants,mode:c.mode,status:'ACTIVE',mechanicalState:physical?'APPROACH':'SEPARATE',dataState:physical?'MANAGEMENT':'OPERATIONAL',powerState:'ISOLATED',functionalState:physical?'INDEPENDENT':'REMOTE_SUPPORT',transferW:0,efficiency:.85,exportedWh:0,receivedWh:0,lossWh:0,dataTransferredMbit:0,startedAt:run.time,detachmentTime:null,detachmentReason:physical?'Approach and capture must complete first.':'Wireless service closes after verified output.',relativeDistanceM:geo.distanceM,relativeSpeedMps:geo.relativeSpeedMps,approachDuration:physical?Math.max(60,geo.distanceM/.8):0,approachStart:run.time,initialOffset:sub(a.position,b.position),captureVerified:false};
 if(physical){conn.detachmentTime=run.time+conn.approachDuration+600+(c.mode==='C3'?1800:30);enqueue(run,{kind:'capture',at:run.time+conn.approachDuration,connectionId:conn.id,spacecraftId:a.id});event(run,'APPROACH_STARTED','info',a.id,'Finite coorbital approach started; relative-state gates and propellant accounting active.',{contractId:c.id});}else{enqueue(run,{kind:'verify',at:run.time+64,connectionId:conn.id,spacecraftId:a.id});event(run,'CROSSLINK_ACTIVE','success',a.id,'Authorized RF service active. Electrical power remains isolated.',{contractId:c.id});}run.connections.push(conn);
 }
}
function revalidateConnection(run,c){
 if(!['ACTIVE','VERIFIED'].includes(c.status))return;const a=satellite(run,c.participants[0]),b=satellite(run,c.participants[1]);let reason='';if(c.mode==='C1'&&(!a.radioKbps||!b.radioKbps||!linkGeometry(a,b).lineOfSight))reason='RF link unavailable / Earth occultation';if(c.mode==='C1'&&b.computeQuality<.8&&!run.contracts.find(x=>x.id===c.contractId)?.services.includes('data.relay/v1'))reason='Provider output quality unavailable';if(c.mode!=='C1'&&(!a.torqueNm||!b.torqueNm||[a,b].some(s=>s.components.find(x=>x.id===`${s.id}-nav`).health==='FAILED')))reason='GNC authority unavailable';if(c.mode!=='C1'&&[a,b].some(s=>s.components.find(x=>x.id===`${s.id}-dock`).health!=='OPERATIONAL'))reason='Protected direct interface failed';if(b.energyWh<=b.reserveWh+.005)reason='Donor reserve protection';if(a.temperatureK>=333.15||b.temperatureK>=333.15)reason='Physical thermal limit';
 if(reason){c.status='ABORTED';c.transferW=0;c.powerState=c.mode==='C1'?'ISOLATED':'FAULT_ISOLATED';c.dataState='ISOLATED';c.functionalState='INDEPENDENT';c.detachmentTime=null;c.detachmentReason=c.mechanicalState==='CAPTURED'?'SAFE COUPLED / ISOLATED · separation requires valid local GNC and release paths.':reason;const contract=run.contracts.find(x=>x.id===c.contractId);contract.status='ABORTED';contract.abortReason=reason;run.metrics.abortedActions++;enqueue(run,{kind:'replan',at:run.time+1,spacecraftId:a.id});event(run,'CONTRACT_ABORTED','critical',a.id,`${reason}. Consumed resources retained in ledger.`,{contractId:contract.id});if(c.mechanicalState==='CAPTURED')c.safetyState='SAFE_COUPLED';}
}
function capture(run,q){
 const c=run.connections.find(x=>x.id===q.connectionId);if(!c||c.status!=='ACTIVE')return;revalidateConnection(run,c);if(c.status!=='ACTIVE')return;const a=satellite(run,c.participants[0]),b=satellite(run,c.participants[1]);
 if(c.relativeDistanceM>1.1||c.relativeSpeedMps>.1||a.interfaceVersion!==b.interfaceVersion){c.status='ABORTED';c.detachmentReason='CAPTURE_ENVELOPE_FAILED';event(run,'CAPTURE_REJECTED','critical',a.id,'Capture guard rejected relative geometry, speed or interface.');return;}
 recordTelemetry(run,'CAPTURE');c.mechanicalState='CAPTURED';c.captureVerified=true;c.detachmentReason=null;c.dataState='OPERATIONAL';c.powerState='PROTECTED_ACTIVE';c.transferW=10;c.functionalState=c.mode==='C3'?'INTEGRATED':'SYMBIOTIC';c.capturedAt=run.time;
 const masses=[a.dryMassKg+a.propellantKg,b.dryMassKg+b.propellantKg],total=masses[0]+masses[1];c.combinedMassKg=total;c.centerOfMassM=a.position.map((x,i)=>(x*masses[0]+b.position[i]*masses[1])/total);c.combinedInertiaKgm2=a.inertiaKgm2.map((x,i)=>x+b.inertiaKgm2[i]+(i===2?0:total*.2**2));c.controlMarginNm=a.torqueNm+b.torqueNm;
 event(run,'CAPTURE_VERIFIED','success',a.id,`Capture envelope passed; combined mass ${total.toFixed(3)} kg, inertia recomputed. Direct paths independently authorized.`,{contractId:c.contractId});enqueue(run,{kind:'verify',at:run.time+600,connectionId:c.id,spacecraftId:a.id});
}
function verify(run,q){
 const c=run.connections.find(x=>x.id===q.connectionId);if(!c||c.status!=='ACTIVE')return;revalidateConnection(run,c);if(c.status!=='ACTIVE')return;const a=satellite(run,c.participants[0]),b=satellite(run,c.participants[1]),contract=run.contracts.find(x=>x.id===c.contractId),quality=c.mode==='C1'?(contract.services.includes('data.relay/v1')?(b.radioKbps>0?1:0):b.computeQuality):a.mission.quality;
 const valid=run.time<=a.mission.deadline&&(c.mode==='C1'?quality>=.8&&c.dataTransferredMbit>=8:quality>=.8&&c.receivedWh>=1.4166&&a.energyWh>0);const evidence={id:id(run,'EVIDENCE'),time:run.time,quality:c.mode==='C1'?quality:1,deadlinePassed:run.time<=a.mission.deadline,receivedDataMbit:c.dataTransferredMbit,receivedEnergyWh:c.receivedWh,predicatePassed:valid,model:'synthetic deterministic mission artifact/v1'};contract.evidenceRefs.push(evidence);c.verification=evidence;
 if(valid){a.mission.status='ASSISTED';a.mission.assisted=true;a.mission.quality=1;a.mission.availability=1;a.mission.tasks[1]={...a.mission.tasks[1],status:'COMPLETED',provider:b.id,evidenceId:evidence.id,quality:1};a.mission.tasks[2]={...a.mission.tasks[2],status:'COMPLETED',quality:1,evidenceId:evidence.id};run.metrics.missionSuccess++;run.metrics.recoveryTimeS=recoveryTimeFor(run,contract,a);c.status='VERIFIED';contract.status='VERIFIED';const decision=run.decisions.find(x=>x.id===contract.decisionId);if(decision){decision.outcome='VERIFIED EXTERNAL ASSISTANCE';decision.actualCompletionS=run.time-decision.time;decision.forecastErrorS=Number.isFinite(decision.forecastCompletionS)?decision.actualCompletionS-decision.forecastCompletionS:null;}event(run,'MISSION_VERIFIED','success',a.id,'Mission criterion independently verified. External assistance; failed physical component remains failed.',{contractId:contract.id,evidenceId:evidence.id});}
 else{c.status='ABORTED';contract.status='ABORTED';event(run,'VERIFICATION_FAILED','critical',a.id,'Output failed delivered quantity, quality or deadline predicate.',{contractId:contract.id});}
 recordTelemetry(run,'VERIFY');c.transferW=0;c.powerState='ISOLATED';if(c.mode==='C1'){c.dataState='ISOLATED';c.status=valid?'COMPLETED':'ABORTED';contract.status=c.status;}else enqueue(run,{kind:'separate',at:run.time+(c.mode==='C3'?1800:30),connectionId:c.id,spacecraftId:a.id});
 if(valid&&run.scenario.reciprocalService&&a.id===run.spacecraft[0].id&&!run.contracts.some(x=>x.services.includes('data.relay/v1'))){const reciprocal={mode:'C1',provider:a.id,completionS:64,score:.92};proposeContract(run,b,reciprocal,{id:contract.decisionId});run.contracts.at(-1).services=['data.relay/v1'];event(run,'RECIPROCAL_SERVICE','info',b.id,'Reciprocal radio relay requested from A; failed A processor is not needed for the typed relay service.');}
}
export function requestSeparation(run,connectionId){const c=run.connections.find(x=>x.id===connectionId);if(!c)fail('INVALID_PARAMETER','Connection does not exist.');
 const owning=run.contracts.find(x=>x.id===c.contractId);if(owning&&['REJECTED','EXPIRED'].includes(owning.status))fail('CONTRACT_CONFLICT',`Contract ${owning.id} is ${owning.status.toLowerCase()}; it cannot command a release.`,409);if(c.mode==='C1'){c.status='COMPLETED';c.dataState='ISOLATED';run.contracts.find(x=>x.id===c.contractId).status='COMPLETED';return;}if(c.mechanicalState!=='CAPTURED')fail('FEASIBILITY_REJECTED','Only captured formations can execute controlled release.');separate(run,{connectionId});}
function separate(run,q){
 const c=run.connections.find(x=>x.id===q.connectionId);if(!c||c.mechanicalState!=='CAPTURED')return;const a=satellite(run,c.participants[0]),b=satellite(run,c.participants[1]);c.transferW=0;c.powerState='ISOLATED';c.dataState='ISOLATED';const separationPropellantKg=(a.dryMassKg+a.propellantKg)*SEPARATION_IMPULSE_MPS/EFFECTIVE_EXHAUST_MPS;
 const eligible=[a,b].every(s=>s.torqueNm>0&&s.propellantKg>.001&&s.components.find(x=>x.id===`${s.id}-dock`).health==='OPERATIONAL')&&a.propellantKg>=separationPropellantKg;
 if(!eligible){c.safetyState='SAFE_COUPLED';c.detachmentTime=null;c.detachmentReason='NOT DETERMINED · local actuation, release port or control authority unavailable.';event(run,'SAFE_COUPLED','warning',a.id,'Release infeasible; formation remains mechanically coupled with isolated paths.');return;}
 recordTelemetry(run,'SEPARATION');c.mechanicalState='RELEASED';c.functionalState='INDEPENDENT';c.status='COMPLETED';c.detachmentTime=run.time;c.detachmentReason='Controlled release completed; independent propagation resumes.';run.contracts.find(x=>x.id===c.contractId).status='COMPLETED';
 // The pair is co-located and co-moving at release, so the released vehicle
 // resumes on the formation orbit offset by the standoff distance. The simplified
 // propagator carries no argument of periapsis, so a general post-impulse state
 // vector cannot be expressed as elements here; the impulse is modelled as the
 // along-track drift below and charged against propellant.
 a.propellantKg-=separationPropellantKg;run.metrics.propellantUsedKg+=separationPropellantKg;
 ledger(run,a.id,'separation-impulse','propellant',separationPropellantKg,'kg',0,c.contractId,{deltaVMps:SEPARATION_IMPULSE_MPS});
 c.separationDeltaVMps=SEPARATION_IMPULSE_MPS;c.separationPropellantKg=separationPropellantKg;
 a.orbit={...b.orbit,phase:b.orbit.phase+RELEASE_STANDOFF_M/b.orbit.radius};a.releaseDriftStart=run.time;a.releaseDriftSpeed=SEPARATION_IMPULSE_MPS;event(run,'SEPARATION_COMPLETE','success',a.id,'Interfaces isolated, finite retreat impulse applied; independent propagation resumed.',{contractId:c.contractId});
}
function advancePhysical(run,dt){
 // Every path that moves stored energy in this tick reports into `audit`, so the
 // residual below is a real closure check rather than a restatement of the
 // transfer identity.
 run.energyAudit??={lastClosing:null,reclaimed:0};
 const measured=run.spacecraft.reduce((s,x)=>s+x.energyWh,0);
 const audit={opening:run.energyAudit.lastClosing??measured,reclaimed:run.energyAudit.reclaimed,generated:0,consumed:0,spill:0,exported:0,received:0,serviceWh:0};
 for(const sat of run.spacecraft){
  Object.assign(sat,propagateOrbit(sat.orbit,run.time));if(sat.releaseDriftStart!==undefined){const angle=sat.releaseDriftSpeed*(run.time-sat.releaseDriftStart)/sat.orbit.radius;Object.assign(sat,propagateOrbit({...sat.orbit,phase:sat.orbit.phase+angle},run.time));}
  if(sat.components.find(c=>c.id===`${sat.id}-nav`).observedHealth!=='FAILED'){sat.navPosition=[...sat.position];sat.navVelocity=[...sat.velocity];sat.navAt=run.time;}
  sat.eclipse=inEclipse(sat.position);sat.solarW=sat.eclipse?0:(sat.availableSolarW??20);sat.loadW=sat.energyWh<=0?0:8;
  const generated=sat.solarW*dt/3600,consumed=Math.min(sat.energyWh+generated,sat.loadW*dt/3600),next=sat.energyWh+generated-consumed,spill=Math.max(0,next-sat.capacityWh);sat.energyWh=clamp(next,0,sat.capacityWh);audit.generated+=generated;audit.consumed+=consumed;audit.spill+=spill;addLedgerAggregate(run,sat,'solar',generated,'generation');addLedgerAggregate(run,sat,'load',consumed,'consumption');if(spill)addLedgerAggregate(run,sat,'spill',spill,'curtailment');
  sat.temperatureK=thermalAt(sat.temperatureK,dt,sat.conductance);const monitorFaults=run.faults.filter(f=>f.spacecraftId===sat.id&&f.modelId==='F-12'&&f.status==='ACTIVE'),frozen=monitorFaults.some(f=>f.parameters.effect==='freeze');
  if(!frozen){sat.observedTemperatureK=sat.temperatureK+monitorFaults.length*8;sat.lastObservedEnergyWh=sat.energyWh;sat.observedAt=run.time;}else if(run.time-sat.observedAt>6){sat.observedHealth='UNKNOWN';sat.components.find(c=>c.id===`${sat.id}-monitor`).observedHealth='UNKNOWN';}
  if(sat.temperatureK>=333.15){sat.overTempSince??=run.time;if(run.time-sat.overTempSince>=10&&!sat.thermalDerated){sat.thermalDerated=true;sat.computeQuality=Math.min(sat.computeQuality,.5);sat.mission.availability=0;sat.mission.status='DEGRADED';event(run,'THERMAL_DERATE','warning',sat.id,'333.15 K threshold sustained for 10 s; compute derated.');}}else sat.overTempSince=null;
  if(run.time>sat.mission.deadline&&['PAUSED','DEGRADED'].includes(sat.mission.status)){sat.mission.status='EXPIRED';for(const task of sat.mission.tasks)if(task.status!=='COMPLETED')task.status='EXPIRED';event(run,'MISSION_EXPIRED','warning',sat.id,'Unresolved mission task exceeded its declared output deadline.');}
  if(sat.energyWh===0){sat.health='FAILED';sat.mission.availability=0;sat.mission.status='FAILED';}for(const comp of sat.components)if(comp.simulationStatus!=='CATALOG_ONLY')comp.temperatureK=sat.temperatureK;
  if(Math.floor(run.time/30)!==Math.floor((run.time-dt)/30)){sat.energyHistory.push({time:run.time,value:sat.energyWh});sat.temperatureHistory.push({time:run.time,value:sat.temperatureK});if(sat.energyHistory.length>300){sat.energyHistory.shift();sat.temperatureHistory.shift();}}
 }
 for(const c of run.connections){
  if(c.mechanicalState==='APPROACH'&&c.status==='ACTIVE'){
   const a=satellite(run,c.participants[0]),b=satellite(run,c.participants[1]),u=clamp((run.time-c.approachStart)/c.approachDuration,0,1),blend=1-10*u**3+15*u**4-6*u**5,derivative=(-30*u*u+60*u**3-30*u**4)/c.approachDuration;
   a.position=b.position.map((v,i)=>v+c.initialOffset[i]*blend);a.velocity=b.velocity.map((v,i)=>v+c.initialOffset[i]*derivative);c.relativeDistanceM=norm(sub(a.position,b.position));c.relativeSpeedMps=norm(sub(a.velocity,b.velocity));const fuel=Math.min(a.propellantKg,.002*dt/c.approachDuration);a.propellantKg-=fuel;ledger(run,a.id,'maneuver','propellant',fuel,'kg',0,c.contractId);run.metrics.propellantUsedKg+=fuel;
  }
  if(c.mechanicalState==='CAPTURED'){const a=satellite(run,c.participants[0]),b=satellite(run,c.participants[1]);a.position=b.position.map((v,i)=>v+(i===0?.4:0));a.velocity=copy(b.velocity);c.relativeDistanceM=.4;c.relativeSpeedMps=0;}
  if(c.status!=='ACTIVE')continue;revalidateConnection(run,c);if(c.status!=='ACTIVE')continue;const a=satellite(run,c.participants[0]),b=satellite(run,c.participants[1]),contract=run.contracts.find(x=>x.id===c.contractId);
  if(c.mode==='C1'){const loss=Math.max(a.packetLoss||0,b.packetLoss||0),remaining=8-c.dataTransferredMbit,attempted=Math.min(Math.max(0,remaining)/Math.max(1e-9,1-loss),Math.min(a.radioKbps,b.radioKbps)*dt/1000),bits=attempted*(1-loss);c.dataTransferredMbit+=bits;c.packetLoss=loss;c.lostMbit=(c.lostMbit||0)+(attempted-bits);contract.usedDataMbit=c.dataTransferredMbit;run.metrics.dataTransferredMbit+=bits;run.metrics.dataLostMbit=(run.metrics.dataLostMbit||0)+(attempted-bits);if(attempted>0){ledger(run,b.id,a.id,'data',bits,'Mbit',attempted-bits,c.contractId);const energy=.15*attempted/8;audit.serviceWh+=Math.min(energy,b.energyWh);b.energyWh=Math.max(0,b.energyWh-energy);ledger(run,b.id,'radio-compute','service_energy',energy,'Wh',0,c.contractId);}}
  if(c.powerState==='PROTECTED_ACTIVE'&&c.transferW>0){const remaining=Math.max(0,1.666666666666667-c.exportedWh),exportWh=Math.min(c.transferW*dt/3600,remaining,Math.max(0,b.energyWh-b.reserveWh),Math.max(0,a.capacityWh-a.energyWh)/c.efficiency),received=exportWh*c.efficiency,loss=exportWh-received;audit.exported+=exportWh;audit.received+=received;b.energyWh-=exportWh;a.energyWh+=received;c.exportedWh+=exportWh;c.receivedWh+=received;c.lossWh+=loss;contract.usedEnergyWh=c.exportedWh;ledger(run,b.id,a.id,'power_transfer',exportWh,'Wh',loss,c.contractId,{receivedWh:received});run.metrics.energyExportedWh+=exportWh;run.metrics.energyReceivedWh+=received;run.metrics.transferLossWh+=loss;}
 }
 evaluateThresholds(run,dt);
 sampleTelemetry(run);
 updateCommunications(run,dt,spacecraftPriority,audit);run.availabilityIntegral+=run.spacecraft.reduce((s,x)=>s+x.mission.availability,0)/run.spacecraft.length*dt;run.metrics.verifiedAvailability=run.metrics.missionAvailability=run.time?run.availabilityIntegral/run.time:1;
 const closing=run.spacecraft.reduce((s,x)=>s+x.energyWh,0),residual=closing-(audit.opening-audit.reclaimed+audit.generated-audit.consumed-audit.spill-audit.exported+audit.received-audit.serviceWh);
 run.energyAudit.lastClosing=closing;run.energyAudit.reclaimed=0;
 run.metrics.conservationResidualWh+=residual;run.metrics.conservationWorstResidualWh=Math.max(run.metrics.conservationWorstResidualWh||0,Math.abs(residual));
 if(Math.abs(residual)>CONSERVATION_TOLERANCE_WH&&!run.conservationFlagged){run.conservationFlagged=true;event(run,'CONSERVATION_RESIDUAL','critical',null,`Stored-energy audit residual ${residual.toExponential(3)} Wh exceeds the ${CONSERVATION_TOLERANCE_WH} Wh tolerance.`);}
}
function addLedgerAggregate(run,sat,dest,amount,type){if(amount===0)return;const bucket=Math.floor(run.time/60),key=`${sat.id}-${type}-${bucket}`,last=run.ledger.findLast(x=>x.aggregateKey===key);if(last){last.amount+=amount;last.throughTime=run.time;}else ledger(run,type==='generation'?'sun':sat.id,type==='generation'?sat.id:dest,type,amount,'Wh',0,null,{aggregateKey:key,throughTime:run.time});}
function processDue(run){if(run.queue.length&&run.queue[0].at<=run.time+1e-8)run.queue.sort((a,b)=>queueOrder(run,a,b));let count=0;while(run.queue.length&&run.queue[0].at<=run.time+1e-8){if(++count>10000)fail('MODEL_INVALID','Event queue loop detected.');const q=run.queue.shift();switch(q.kind){case 'replan':if(!satellite(run,q.spacecraftId).mission.assisted)plan(run,q.spacecraftId);break;case 'fault':applyFault(run,q);break;case 'observe':observeFault(run,q);break;case 'clear':clearFault(run,q.faultId);break;case 'progress':{const f=run.faults.find(x=>x.id===q.faultId);if(f&&f.status==='ACTIVE'){f.parameters.effect='failed';recomputePhysical(run,satellite(run,f.spacecraftId));enqueue(run,{kind:'observe',at:run.time+6,spacecraftId:f.spacecraftId,faultId:f.id});}break;}case 'contract':transitionContract(run,q);break;case 'capture':capture(run,q);break;case 'verify':verify(run,q);break;case 'separate':separate(run,q);break;}}}
export function advance(run,seconds){if(!Number.isFinite(seconds)||seconds<0)fail('INVALID_PARAMETER','Advance seconds must be nonnegative and finite.');if(!Number.isInteger(run.lastCommandRevision)||run.lastCommandRevision<0||run.lastCommandRevision>run.revision)run.lastCommandRevision=run.revision;const target=Math.min(run.time+seconds,run.config.maxDurationS);processDue(run);while(run.time<target-1e-8){let dt=Math.min(1,target-run.time);if(run.queue.length&&run.queue[0].at>run.time)dt=Math.min(dt,run.queue[0].at-run.time);if(run.communications?.enabled&&run.communications.nextSlotAt>run.time+1e-8)dt=Math.min(dt,run.communications.nextSlotAt-run.time);run.time=Math.round((run.time+dt)*1e9)/1e9;advancePhysical(run,dt);processDue(run);}if(run.time>=run.config.maxDurationS)run.playing=false;run.revision++;return run;}
export function snapshot(run){return {schemaVersion:run.schemaVersion,runId:run.runId,revision:run.revision,scenarioId:run.scenarioId,scenario:run.scenario,seed:run.seed,policyId:run.policyId,manifestId:run.manifestId,manifest:run.manifest,manifests:Object.values(manifests).map(m=>({id:m.id,classId:m.classId,version:m.version,description:m.description})),time:run.time,epoch:run.epoch,playing:run.playing,timeScale:run.timeScale,faultMode:run.faultMode,profile:run.profile,spacecraft:run.spacecraft.map(s=>({...copy(s),priority:spacecraftPriority(run,s),boardSafety:boardSafety(run,s),observedBoardSafety:boardSafety(run,s,true)})),events:copy(run.events.slice(-300)),faults:copy(run.faults),decisions:copy(run.decisions.slice(-30)),contracts:copy(run.contracts),connections:copy(run.connections),communications:communicationSnapshot(run),metrics:copy(run.metrics),storage:run.storage,modelVersion:run.modelVersion,limitations:run.limitations,sequence:run.sequence,checkpoints:run.checkpoints.map(c=>({id:c.id,name:c.name,time:c.time,checksum:c.checksum})),ledger:copy(run.ledger.slice(-100)),faultModels,faultEngine:faultEngineSummary(run),thresholdWatches:copy(run.thresholdWatches||[])};}
export function checkpoint(run,name='Checkpoint'){
 const point={id:id(run,'CP'),name:String(name).slice(0,80),schemaVersion:'1.0',time:run.time};
 event(run,'CHECKPOINT_SAVED','success',null,`${point.name} saved at T+${run.time.toFixed(1)} s.`);
 // Aggregate rows for the open minute bucket are still accumulating, so only the
 // frozen prefix can be checksummed. The mutable tail is stored in full; it is a
 // few rows per spacecraft, not the whole log.
 const totals=(rows,key)=>rows.reduce((sum,row)=>sum+(Number(row[key])||0),0);
 const tailSize=Math.min(run.ledger.length,6*run.spacecraft.length+16);
 const cut=run.ledger.length-tailSize;
 point.ledgerHead={length:run.ledger.length,cut,checksum:hash(run.ledger.slice(0,cut)),tail:copy(run.ledger.slice(cut)),
  amount:totals(run.ledger,'amount'),losses:totals(run.ledger,'losses')};
 point.eventHead={length:run.events.length,checksum:hash(run.events)};
 // Display trends are chart data, not simulation state: the dossier asks for
 // bounded trends and no render persistence, so they do not ride in every point.
 point.world=copy({...run,checkpoints:[],initialState:undefined,commandResults:{},ledger:[],events:[],telemetry:undefined,spacecraft:run.spacecraft.map(s=>({...s,energyHistory:[],temperatureHistory:[]}))});point.checksum=hash(point.world);run.checkpoints.push(point);if(run.checkpoints.length>100)run.checkpoints.shift();return {id:point.id,name:point.name,time:point.time,checksum:point.checksum};
}
export function restoreCheckpoint(run,point){
 if(point.schemaVersion!=='1.0')fail('VERSION_MISMATCH','Checkpoint major version incompatible.');if(hash(point.world)!==point.checksum)fail('CHECKSUM_MISMATCH','Checkpoint checksum failed; previous valid run retained.');
 const saved=run.checkpoints,runId=run.runId,initial=run.initialState,rev=run.revision,lastCommandRevision=run.lastCommandRevision,commandResults=run.commandResults;
 // Rewind the append-only logs to the head this checkpoint recorded. Rows above
 // the head are the future being discarded; the head's checksum proves the rest
 // is the same log the checkpoint was taken from.
 let ledger=run.ledger;const events=run.events.slice(0,point.eventHead?.length??run.events.length);
 if(point.ledgerHead){const prefix=run.ledger.slice(0,point.ledgerHead.cut);
  if(hash(prefix)!==point.ledgerHead.checksum)fail('CHECKSUM_MISMATCH','Ledger head does not match this run; previous valid run retained.');
  ledger=[...prefix,...copy(point.ledgerHead.tail)];}
 if(point.eventHead&&hash(events)!==point.eventHead.checksum)fail('CHECKSUM_MISMATCH','Event head does not match this run; previous valid run retained.');
 const telemetry=run.telemetry;Object.assign(run,copy(point.world),{runId,revision:rev,lastCommandRevision,commandResults,checkpoints:saved,initialState:initial,playing:false,ledger,events,telemetry});
 truncateTelemetry(run,point.time);
 // Operator audit records never consume the deterministic simulation event-ID stream.
 run.events.push({id:`AUDIT-${point.id}-${rev}`,schemaVersion:'1.0',time:run.time,type:'CHECKPOINT_RESTORED',severity:'info',spacecraftId:null,message:`Restored ${point.name}; exact RNG and event queue retained.`,sequence:++run.sequence,auditOnly:true});
}
export function exportRun(run){return {schemaVersion:'1.0',kind:'VEIL_REPLAY_BUNDLE',softwareBuildId:'symbio-veil/1.0.0',modelVersion:MODEL_VERSION,scenarioHash:hash(run.initialOptions),scenario:run.scenario,seed:run.seed,policyId:run.policyId,policyWeights:weights,numericalConfig:run.numericalConfig,provenance:'P2 SYNTHETIC REFERENCE',limitations:LIMITATIONS,initialOptions:run.initialOptions,initialStates:run.initialState?.spacecraft,finalState:snapshot(run),events:run.events,faults:run.faults,ledger:run.ledger,decisions:run.decisions,contracts:run.contracts,metrics:run.metrics,checkpoints:run.checkpoints,replayState:copy({...run,initialState:undefined}),logHash:hash(run.events),hash:hash({time:run.time,spacecraft:run.spacecraft,queue:run.queue,rng:run.rng,rngStreams:run.rngStreams})};}
export function importRun(bundle){if(bundle.schemaVersion!=='1.0'||bundle.kind!=='VEIL_REPLAY_BUNDLE'||!bundle.replayState)fail('VERSION_MISMATCH','Expected VEIL 1.x replay bundle.');const source=copy(bundle.replayState);if(!Array.isArray(source.spacecraft)||!Array.isArray(source.queue)||!Number.isFinite(source.time))fail('INVALID_PARAMETER','Replay has invalid world data.');if(bundle.hash!==hash({time:source.time,spacecraft:source.spacecraft,queue:source.queue,rng:source.rng,rngStreams:source.rngStreams}))fail('CHECKSUM_MISMATCH','Replay checksum failed.');source.playing=false;source.runId=randomUUID();source.lastCommandRevision=source.revision;return source;}
export function experiment(options={}){const scenarioId=options.scenarioId||options.scenario_id||'E1',seed=Number(options.seed??20261029),duration=numeric(options.durationS??options.duration_s??1800,'Experiment duration',1,86400),rows=[];const selected=options.policies||['B0','B1','B2','B3'];if(!Array.isArray(selected)||!selected.length||selected.some(p=>!['B0','B1','B2','B3'].includes(p)))fail('INVALID_PARAMETER','Choose at least one valid comparison policy.');for(const policyId of [...new Set(selected)].sort()){const run=makeRun({scenarioId,seed,policyId});advance(run,duration);rows.push({policyId,label:({B0:'Independent',B1:'Reactive',B2:'Docking first',B3:'VEIL weighted'})[policyId],scenarioId,seed,scenarioHash:hash({scenarioId,seed}),durationS:duration,metrics:copy(run.metrics),outcome:run.spacecraft[0].mission.status,donorEnergyWh:run.spacecraft[1].energyWh,events:run.events,decisions:run.decisions,modelVersion:MODEL_VERSION,limitations:LIMITATIONS});}return {id:randomUUID(),schemaVersion:'1.0',scenarioId,seed,durationS:duration,provenance:'P2 SYNTHETIC',policies:rows,results:rows,sharedExogenousDisturbances:true,sharedDisturbanceBasis:'Every policy run starts from identical initial states and identical named RNG streams. Hazard draws are consumed only at initialization and when a scheduled incident fires, neither of which depends on policy, so the exogenous incident schedule is identical across B0-B3. Verified by tests/planner-isolation.test.js.',assumptions:'Policy-dependent resource states may still induce different protection and abort outcomes from the same incidents. No confidence interval claimed from one seed.'};}
