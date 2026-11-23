import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCustomer} from './amounts.mjs';

test('accepts and trims ordinary synthetic customer name',()=>assert.equal(validateCustomer('  Demo Client Ltd  '),'Demo Client Ltd'));
test('accepts Gujarati customer name',()=>assert.equal(validateCustomer('નમૂના ગ્રાહક'),'નમૂના ગ્રાહક'));
test('rejects empty and whitespace-only names',()=>{for(const s of ['', '   '])assert.throws(()=>validateCustomer(s),/Customer name/);});
test('rejects control and line separator characters',()=>{for(const s of ['Demo\nClient','Demo\u001bClient','Demo\u2028Client','Demo\u007fClient'])assert.throws(()=>validateCustomer(s),/Customer name/);});
test('enforces maximum 160 characters',()=>{assert.equal(validateCustomer('A'.repeat(160)).length,160);assert.throws(()=>validateCustomer('A'.repeat(161)),/Customer name/);});
test('rejects non-string input',()=>assert.throws(()=>validateCustomer({name:'Demo'}),/Customer name/));
