import test from 'node:test';
import assert from 'node:assert/strict';
import {udyamDisplayLine} from '../billing/seller-identity.mjs';

test('unverified seller never exposes Udyam number',()=>{
 assert.equal(udyamDisplayLine({registrationNumber:'UDYAM-GJ-01-0013783'}),null);
 assert.equal(udyamDisplayLine({sellerIdentityVerified:false,registrationNumber:'UDYAM-GJ-01-0013783'}),null);
 assert.equal(udyamDisplayLine({sellerIdentityVerified:'true',registrationNumber:'UDYAM-GJ-01-0013783'}),null);
});
test('verified seller shows properly formatted Udyam as registration only',()=>{
 assert.equal(udyamDisplayLine({sellerIdentityVerified:true,registrationNumber:'UDYAM-GJ-01-0013783'}),'Udyam Registration No.: UDYAM-GJ-01-0013783');
});
test('verified flag does not bypass malformed registration guard',()=>{
 for(const value of ['GSTIN-123','UDYAM-GJ-01-123','UDYAM-GJ-01-0013783<script>',null])
 assert.equal(udyamDisplayLine({sellerIdentityVerified:true,registrationNumber:value}),null);
});
