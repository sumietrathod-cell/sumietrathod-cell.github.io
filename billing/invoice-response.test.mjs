import test from 'node:test';
import assert from 'node:assert/strict';
import {requireInvoiceDraft} from './invoice-response.mjs';
const q='123e4567-e89b-42d3-a456-426614174000';
const i='123e4567-e89b-42d3-a456-426614174001';
const valid={id:i,quotation_id:q,issued_at:'2026-11-24T00:30:00Z',status:'draft'};
test('accepts matching synthetic invoice draft',()=>assert.equal(requireInvoiceDraft([valid],q).id,i));
test('rejects empty or multiple RPC rows',()=>{for(const rows of [[],[valid,valid]])assert.throws(()=>requireInvoiceDraft(rows,q))});
test('rejects mismatched quotation, invalid id and date',()=>{
 for(const row of [{...valid,quotation_id:i},{...valid,id:'not-a-uuid'},{...valid,issued_at:'not-a-date'}])
 assert.throws(()=>requireInvoiceDraft(row,q));
});
test('rejects non-draft statuses',()=>assert.throws(()=>requireInvoiceDraft({...valid,status:'paid'},q)));
