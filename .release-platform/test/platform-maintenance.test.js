import test from 'node:test';
import assert from 'node:assert/strict';
import { runPlatformMaintenance } from '../src/index.js';

function maintenanceDb(){
  const queries=[];
  const statement=sql=>({
    bind(){ return this; },
    async first(){
      if(sql.includes('platform_settings')) return null;
      if(sql.includes('platform_audit_checkpoints')) return null;
      return null;
    },
    async all(){
      if(sql.includes('FROM platform_products')) return {results:[]};
      if(sql.includes('FROM audit_log')) return {results:[]};
      return {results:[]};
    },
    async run(){ return {meta:{changes:0}}; },
  });
  return {
    queries,
    prepare(sql){ queries.push(sql); return statement(sql); },
    async batch(items){ return items.map(()=>({success:true,meta:{changes:0}})); },
  };
}

test('scheduled retention uses the actual health-report timestamp column', async()=>{
  const DB=maintenanceDb();
  const result=await runPlatformMaintenance({DB});

  assert.equal(result.ok,true);
  assert.ok(DB.queries.some(sql=>sql.includes('platform_health_reports WHERE received_at')));
  assert.ok(!DB.queries.some(sql=>sql.includes('platform_health_reports WHERE created_at')));
});
