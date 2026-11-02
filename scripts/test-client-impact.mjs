import assert from 'node:assert/strict';
import { feeImpact, creditImpact } from '../lib/business-simulator/client-impact.ts';
const reduced=feeImpact(1000000,1000,800,1000000);
assert.deepEqual(reduced,{current:100000,sameVolume:80000,proposed:80000,difference:-20000,concession:20000,needed:1250000});
assert.equal(feeImpact(1000000,1000,800,1250000).difference,0);
assert.equal(feeImpact(1000000,1000,0,1000000).needed,null);
assert.equal(feeImpact(0,1000,0,0).needed,0);
assert.equal(feeImpact(1,5000,5000,1).current,1);
assert.throws(()=>feeImpact(-1,100,100,100));
assert.throws(()=>feeImpact(100,10001,100,100));
assert.deepEqual(creditImpact(100000,30,1200,1000),{principal:100000,financing:986,fee:10000,afterFinancing:9014});
assert.equal(creditImpact(100000,30,0,0).afterFinancing,0);
assert.throws(()=>creditImpact(100000,1.5,1200,1000));
assert.throws(()=>creditImpact(100000,3651,1200,1000));
for(let rate=1;rate<=10000;rate+=113){const r=feeImpact(12345678,1000,rate,12345678);assert.ok(feeImpact(r.needed,rate,rate,r.needed).current>=r.current);}
console.log('PASS: client fee comparison, zero fee, recovery volume, cents rounding, credit financing, invalid inputs.');
