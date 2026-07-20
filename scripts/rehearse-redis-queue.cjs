const assert=require("node:assert/strict");
const {once}=require("node:events");

async function main(){
 const {RunQueue}=await import("../dist/packages/queue/src/index.js"),port=Number(process.env.AGENT_COMPANY_REDIS_PORT||6379),runId=process.env.REDIS_REHEARSAL_RUN_ID;
 if(!runId)throw new Error("REDIS_REHEARSAL_RUN_ID required");const queue=new RunQueue({host:"127.0.0.1",port});
 try{
  if(process.argv[2]==="seed"){await queue.enqueue({runId,requestId:"before-server-restart"});const job=await queue.queue.getJob(runId);assert.equal(job?.data.requestId,"before-server-restart");console.log(JSON.stringify({phase:"seed",runId,state:await job?.getState()}));return;}
  if(process.argv[2]!=="recover")throw new Error("Use seed or recover");const seen=[];const worker=queue.worker({host:"127.0.0.1",port},async job=>{seen.push(job.data.runId)});try{let job=await queue.queue.getJob(runId);assert.ok(job,"AOF-restored BullMQ job missing");if(!(await job.isCompleted()))await once(worker,"completed");job=await queue.queue.getJob(runId);assert.deepEqual(seen,[runId]);assert.equal(job?.data.requestId,"before-server-restart");assert.equal(await job?.getState(),"completed");console.log(JSON.stringify({phase:"recover",runId,state:"completed",deliveries:seen.length}));await job?.remove();}finally{await worker.close();}
 }finally{await queue.close();}
}
main().catch(error=>{console.error(error);process.exit(1)});
