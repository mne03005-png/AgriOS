import 'reflect-metadata';
import assert = require('node:assert/strict');
import { ConfigService } from '@nestjs/config';
import { RequestContextService } from '../src/common/request-context.service';
import { MobileService } from '../src/modules/mobile/mobile.service';
import { ExecutionService } from '../src/modules/execution/execution.service';
import { ValveControlService } from '../src/modules/device-control/valve-control.service';
import { DeviceControlService } from '../src/modules/device-control/device-control.service';
import { PlcGatewayDeviceController } from '../src/modules/device-control/adapters/plc-gateway-device-controller';
import { ActionQueueService } from '../src/modules/action-queue/action-queue.service';

type Test = { name: string; run: () => void | Promise<void> }; const tests: Test[] = []; const test = (name: string, run: Test['run']) => tests.push({ name, run });
const context = () => new RequestContextService();
const inContext = <T>(ctx: RequestContextService, fn: () => T | Promise<T>) => new Promise<T>((resolve, reject) => ctx.run({ tenantId: 'tenant-a', farmId: 'farm-a', userId: 'user-a', role: 'FARM_MANAGER', requestId: 'req-a' }, () => Promise.resolve(fn()).then(resolve, reject)));

function mobileFixture(deviceOverride: Record<string, unknown> = {}) {
  const plans: any[] = []; const jobs: any[] = [];
  const device = { id: 'valve-a', tenantId: 'tenant-a', fieldId: 'field-a', field: { id: 'field-a', tenantId: 'tenant-a', farmId: 'farm-a' }, ...deviceOverride };
  const prisma: any = { device: { findFirst: async ({ where }: any) => where.tenantId && where.tenantId !== device.tenantId ? null : device }, decisionRecord: { create: async ({ data }: any) => ({ id: 'decision-a', ...data }) }, actionPlan: { create: async ({ data }: any) => { const value={ id: `plan-${plans.length + 1}`, ...data }; plans.push(value); return value; } } };
  const queue = { enqueue: async (input: any) => { const value={ id: `job-${jobs.length + 1}`, ...input, status:'QUEUED' }; jobs.push(value); return value; } };
  const service = new MobileService(prisma, {} as any, { get: () => queue } as any);
  const user: any = { id: 'user-a', tenantId: 'tenant-a', farmId: 'farm-a', role: 'FARM_MANAGER' };
  return { service, plans, jobs, user };
}

test('1 mobile VALVE_OPEN queues without direct dispatcher', async()=>{const f=mobileFixture();const r:any=await f.service.valve({deviceId:'valve-a',command:'VALVE_OPEN'},f.user);assert.equal(r.queued,true);assert.equal(f.jobs.length,1);});
test('2 mobile VALVE_CLOSE queues without direct dispatcher', async()=>{const f=mobileFixture();const r:any=await f.service.valve({deviceId:'valve-a',command:'VALVE_CLOSE'},f.user);assert.equal(r.queued,true);assert.equal(f.jobs.length,1);});
test('3 mobile plan uses DEVICE_COMMAND', async()=>{const f=mobileFixture();await f.service.valve({deviceId:'valve-a',command:'VALVE_OPEN'},f.user);assert.equal(f.plans[0].actions[0].type,'DEVICE_COMMAND');});
test('4 mobile uses canonical queue service', async()=>{const f=mobileFixture();await f.service.valve({deviceId:'valve-a',command:'VALVE_OPEN'},f.user);assert.deepEqual(f.jobs[0],{id:'job-1',farmId:'farm-a',actionPlanId:'plan-1',status:'QUEUED'});});
test('5 mobile tenant mismatch rejects', async()=>{const f=mobileFixture({tenantId:'tenant-b'});await assert.rejects(()=>f.service.valve({deviceId:'valve-a',command:'VALVE_OPEN'},f.user));assert.equal(f.jobs.length,0);});
test('6 mobile farm mismatch rejects', async()=>{const f=mobileFixture({field:{id:'field-a',tenantId:'tenant-a',farmId:'farm-b'}});await assert.rejects(()=>f.service.valve({deviceId:'valve-a',command:'VALVE_OPEN'},f.user));assert.equal(f.jobs.length,0);});
test('7 mobile response never claims physical completion', async()=>{const f=mobileFixture();const r:any=await f.service.valve({deviceId:'valve-a',command:'VALVE_OPEN'},f.user);assert.equal(r.executed,false);assert.equal(r.physicalConfirmed,false);});

function executionFixture(safetyAllowed=true) {
  const ctx=context(); const plans:any[]=[]; const jobs:any[]=[]; let approvals=0;
  const prisma:any={field:{findFirst:async()=>({id:'field-a',farmId:'farm-a'})},device:{findFirst:async()=>({id:'pump-a'})},decisionRecord:{create:async({data}:any)=>({id:'decision-a',...data})},actionPlan:{create:async({data}:any)=>{const value={id:'plan-a',...data};plans.push(value);return value;}}};
  const queue={enqueue:async(input:any)=>{const value={id:'job-a',...input,status:'QUEUED'};jobs.push(value);return value;}};
  const service=new ExecutionService({check:async()=>({allowed:safetyAllowed,risks:safetyAllowed?[]:['NO_WATER']})} as any,{create:async()=>{approvals++;return{id:'approval-a',status:'PENDING'}}} as any,{create:async()=>({})} as any,ctx,prisma,{get:()=>queue} as any);
  return{ctx,service,plans,jobs,approvals:()=>approvals};
}
const executionDto:any={mode:'ASSISTED',fieldId:'field-a',deviceId:'pump-a',command:'PUMP_ON'};
test('8 guarded execution queues canonical plan',async()=>{const f=executionFixture();const r:any=await inContext(f.ctx,()=>f.service.run(executionDto));assert.equal(r.queued,true);assert.equal(f.jobs.length,1);});
test('9 execution has no direct dispatcher result',async()=>{const f=executionFixture();const r:any=await inContext(f.ctx,()=>f.service.run(executionDto));assert.equal('result' in r,false);assert.equal(r.executed,false);});
test('10 blocked execution remains pending manual review',async()=>{const f=executionFixture(false);const r:any=await inContext(f.ctx,()=>f.service.run(executionDto));assert.equal(r.queued,false);assert.equal(f.approvals(),1);});
test('11 AUTO disabled remains fail closed',async()=>{const previous=process.env.ENABLE_AUTO_EXECUTION;delete process.env.ENABLE_AUTO_EXECUTION;const f=executionFixture();try{await assert.rejects(()=>inContext(f.ctx,()=>f.service.run({...executionDto,mode:'AUTO'})),/AUTO mode is disabled/);}finally{previous===undefined?delete process.env.ENABLE_AUTO_EXECUTION:process.env.ENABLE_AUTO_EXECUTION=previous;}});
test('12 execution action uses DEVICE_COMMAND',async()=>{const f=executionFixture();await inContext(f.ctx,()=>f.service.run(executionDto));assert.equal(f.plans[0].actions[0].type,'DEVICE_COMMAND');});
test('13 execution response is not physical success',async()=>{const f=executionFixture();const r:any=await inContext(f.ctx,()=>f.service.run(executionDto));assert.equal(r.physicalConfirmed,false);assert.equal(r.status,'QUEUED');});

function valveFixture(overrides:Record<string,string>={},emergency=false) {
  const ctx=context(); const calls={queue:0,deviceCommand:0,execution:0}; const plans:any[]=[];
  const device={id:'valve-a',tenantId:'tenant-a',fieldId:'field-a',field:{farmId:'farm-a'},type:'VALVE',online:true,code:'V1',currentStatus:{}};
  const prisma:any={device:{findFirst:async({where}:any)=>where.tenantId==='tenant-a'?device:null,update:async()=>device},deviceCommand:{findFirst:async()=>null,create:async()=>{calls.deviceCommand++;throw new Error('RAW_DEVICE_COMMAND_FORBIDDEN');}},actionExecution:{create:async()=>{calls.execution++;throw new Error('RAW_EXECUTION_FORBIDDEN');}},actionQueueJob:{create:async()=>{calls.queue++;throw new Error('RAW_QUEUE_FORBIDDEN');}},safetyPolicy:{findFirst:async()=>emergency?{id:'estop'}:null},decisionRecord:{create:async({data}:any)=>({id:'decision-a',...data})},actionPlan:{create:async({data}:any)=>{const value={id:'plan-a',...data};plans.push(value);return value;}},approvalRequest:{create:async({data}:any)=>({id:'approval-a',...data})},eventLog:{create:async({data}:any)=>data}};
  const values:any={DEVICE_CONTROL_DRY_RUN:'true',VALVE_ALLOW_REAL_CONTROL:'false',VALVE_REQUIRE_FEEDBACK:'true',...overrides};
  const service=new ValveControlService(prisma,{get:(key:string)=>values[key]} as ConfigService,ctx,{record:async()=>({})} as any,{publish:()=>undefined} as any);
  return{ctx,service,calls,plans};
}
test('14 valve dry-run performs zero physical execution records',async()=>{const f=valveFixture();const r:any=await inContext(f.ctx,()=>f.service.requestOpenValve('valve-a',{dryRun:true}));assert.equal(r.executed,false);assert.deepEqual(f.calls,{queue:0,deviceCommand:0,execution:0});});
test('15 valve real request is explicitly rejected',async()=>{const f=valveFixture({DEVICE_CONTROL_DRY_RUN:'false'});await assert.rejects(()=>inContext(f.ctx,()=>f.service.requestOpenValve('valve-a',{dryRun:false})));});
test('16 valve dry-run does not use VALVE_CONTROL action',async()=>{const f=valveFixture();await inContext(f.ctx,()=>f.service.requestOpenValve('valve-a',{dryRun:true}));assert.equal(f.plans[0].actions[0].type,'MANUAL_CHECK');});
test('17 valve does not manually create DeviceCommand',async()=>{const f=valveFixture();await inContext(f.ctx,()=>f.service.requestOpenValve('valve-a',{dryRun:true}));assert.equal(f.calls.deviceCommand,0);});
test('18 valve does not manually create ActionExecution',async()=>{const f=valveFixture();await inContext(f.ctx,()=>f.service.requestOpenValve('valve-a',{dryRun:true}));assert.equal(f.calls.execution,0);});
test('19 valve does not create competing raw queue job',async()=>{const f=valveFixture();await inContext(f.ctx,()=>f.service.requestOpenValve('valve-a',{dryRun:true}));assert.equal(f.calls.queue,0);});
test('20 unresolved real approval remains fail closed',async()=>{const f=valveFixture({DEVICE_CONTROL_DRY_RUN:'false',VALVE_ALLOW_REAL_CONTROL:'true'});await assert.rejects(()=>inContext(f.ctx,()=>f.service.requestOpenValve('valve-a',{dryRun:false})),(error:any)=>error?.getResponse?.().reasons?.includes('APPROVAL_REQUIRED'));assert.equal(f.plans.length,0);});
test('21 emergency stop blocks valve OPEN',async()=>{const f=valveFixture({},true);await assert.rejects(()=>inContext(f.ctx,()=>f.service.requestOpenValve('valve-a',{dryRun:true})),(error:any)=>error?.getResponse?.().reasons?.includes('EMERGENCY_STOP_ACTIVE'));});
test('22 valve CLOSE remains available as dry-run simulation',async()=>{const f=valveFixture();const r:any=await inContext(f.ctx,()=>f.service.requestCloseValve('valve-a',{dryRun:true}));assert.equal(r.status,'DRY_RUN_SIMULATED');});

test('23 queue retry invokes real retry handoff with the same action plan identity',async()=>{const ctx=context();const enqueued:string[]=[];const job={id:'job-a',tenantId:'tenant-a',farmId:'farm-a',actionPlanId:'plan-a',status:'QUEUED'};const prisma:any={actionQueueJob:{update:async()=>job},actionPlan:{findFirst:async({where}:any)=>where.id==='plan-a'&&where.tenantId==='tenant-a'?{actions:[{type:'DEVICE_COMMAND',command:'VALVE_OPEN'}]}:null}};const queue=new ActionQueueService(prisma,ctx,{} as any,{publish:()=>undefined} as any,{} as any,{get:()=>undefined} as any);(queue as any).adapter={name:'test',handlesProcessing:true,enqueue:async(id:string)=>{enqueued.push(id)},size:async()=>0,next:async()=>undefined};const retried:any=await queue.retry('job-a');assert.equal(retried.actionPlanId,'plan-a');assert.deepEqual(enqueued,['job-a']);});
test('24 producers do not invent physical commandId',async()=>{const f=mobileFixture();await f.service.valve({deviceId:'valve-a',command:'VALVE_OPEN'},f.user);assert.equal(f.plans[0].actions[0].commandId,undefined);});
test('25 direct DeviceControl call without controlPath remains rejected',async()=>{const values:any={NODE_ENV:'test',PLC_GATEWAY_FAKE_TRANSPORT:'true',DEVICE_CONTROL_MODE:'PLC_GATEWAY',DEVICE_CONTROL_DRY_RUN:'false',VALVE_ALLOW_REAL_CONTROL:'true',ENABLE_AUTO_EXECUTION:'true',PLC_TRANSPORT:'MODBUS_TCP',PLC_REAL_WRITE_ENABLED:'true',PLC_PROFILE:{testOnly:true,unitId:1,points:{valveOpen:{type:'coil',address:1}}}};const config={get:(key:string)=>values[key]} as ConfigService;const plc=new PlcGatewayDeviceController(config);const ctx=context();const service=new DeviceControlService(plc as any,plc as any,plc as any,plc as any,plc,plc as any,{publish:()=>undefined} as any,config,{eventLog:{create:async()=>({})}} as any,ctx,{record:async()=>({})} as any);await assert.rejects(()=>inContext(ctx,()=>service.send('valve-a',{command:'VALVE_OPEN'} as any)),/Physical commands must enter through Safety, Approval, ActionPlan and ActionQueue/);});
test('26 execution rejects field outside tenant before safety',async()=>{const f=executionFixture();(f.service as any).prisma.field.findFirst=async()=>null;let safetyCalls=0;(f.service as any).safetyService.check=async()=>{safetyCalls++;return{allowed:true,risks:[]}};await assert.rejects(()=>inContext(f.ctx,()=>f.service.run(executionDto)),/Field is outside current tenant/);assert.equal(safetyCalls,0);});
test('27 execution rejects device outside field before safety',async()=>{const f=executionFixture();(f.service as any).prisma.device.findFirst=async()=>null;let safetyCalls=0;(f.service as any).safetyService.check=async()=>{safetyCalls++;return{allowed:true,risks:[]}};await assert.rejects(()=>inContext(f.ctx,()=>f.service.run(executionDto)),/Device is outside current field or tenant/);assert.equal(safetyCalls,0);});

async function main(){let passed=0;for(const item of tests){try{await item.run();passed++;console.log(`PASS ${item.name}`);}catch(error){console.error(`FAIL ${item.name}`,error);process.exitCode=1;}}console.log(`R1-B CONTROL ENTRY CONVERGENCE: ${passed}/${tests.length} PASS`);if(passed!==tests.length)process.exitCode=1;}
void main();
