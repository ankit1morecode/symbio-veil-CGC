import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {createHash} from 'node:crypto';
const dataRoot=path.resolve(process.env.DATA_DIRECTORY||'data/runs');
let Model, mongoConnected=false,mongoConfigured=false;
export async function connectStorage(){
 await fs.mkdir(dataRoot,{recursive:true});
 mongoConfigured=Boolean(process.env.MONGODB_URI);if(mongoConfigured){try{await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:3500});const schema=new mongoose.Schema({runId:{type:String,unique:true,index:true},state:mongoose.Schema.Types.Mixed,checksum:String,updatedAt:Date});Model=mongoose.models.VeilRun||mongoose.model('VeilRun',schema);mongoConnected=true;console.log('VEIL persistence: MongoDB connected');}catch(error){console.warn(`MongoDB unavailable; using atomic local JSON journals. ${error.message.split('\n')[0]}`);}}
 else console.log('VEIL persistence: local JSON journals (MONGODB_URI not configured)');
}
export const storageLabel=()=>mongoConnected?'MongoDB · connected':mongoConfigured?'Local JSON journal · MongoDB unavailable':'Local JSON journal · MongoDB not configured';
const digest=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
export async function saveRun(run){
 const state=structuredClone(run);const payload={schemaVersion:'1.0',checksum:digest(state),state};
 if(mongoConnected){await Model.updateOne({runId:run.runId},{$set:{state,checksum:payload.checksum,updatedAt:new Date()}},{upsert:true});return;}
 if(!/^[\w-]+$/.test(run.runId))throw new Error('Invalid run ID');const file=path.join(dataRoot,`${run.runId}.json`),temporary=`${file}.tmp`;await fs.writeFile(temporary,JSON.stringify(payload),'utf8');await fs.rename(temporary,file);
}
export async function loadRuns(){
 if(mongoConnected){const docs=await Model.find({}).sort({updatedAt:-1}).limit(10).lean();return docs.reverse().filter(x=>digest(x.state)===x.checksum).map(x=>({...x.state,playing:false,commandResults:x.state.commandResults||{}}));}
 const all=(await fs.readdir(dataRoot)).filter(x=>x.endsWith('.json'));const metadata=await Promise.all(all.map(async name=>({name,mtime:(await fs.stat(path.join(dataRoot,name))).mtimeMs})));const entries=metadata.sort((a,b)=>b.mtime-a.mtime).slice(0,10).reverse().map(x=>x.name);const runs=[];
 for(const name of entries){try{const payload=JSON.parse(await fs.readFile(path.join(dataRoot,name),'utf8'));if(payload.schemaVersion==='1.0'&&digest(payload.state)===payload.checksum)runs.push({...payload.state,playing:false,commandResults:payload.state.commandResults||{}});}catch{console.warn(`Ignored invalid or incomplete journal: ${name}`);}}return runs;
}
export async function closeStorage(){if(mongoConnected)await mongoose.disconnect();}
