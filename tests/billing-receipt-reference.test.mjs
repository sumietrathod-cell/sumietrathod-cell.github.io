import test from 'node:test';
import assert from 'node:assert/strict';
import {formatReceiptReference} from '../billing/receipt-reference.mjs';
test('formats deterministic non-GST receipt references',()=>{
 assert.equal(formatReceiptReference('2026-27',1),'AAR-REC-2026-27-000001');
 assert.equal(formatReceiptReference('2026-27',1000000),'AAR-REC-2026-27-1000000');
});
test('rejects invalid years and sequences',()=>{
 for(const year of ['2026-26','2026-28','26-27','2026/27','1999-00'])
  assert.throws(()=>formatReceiptReference(year,1));
 for(const number of [0,-1,1.5,NaN,Infinity,'1',1000000000])
  assert.throws(()=>formatReceiptReference('2026-27',number));
});
