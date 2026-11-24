// Backend-only synthetic-friendly outstanding report aggregator.
// Accept only trusted server-fetched invoices and verified payment records.
// A single invalid invoice/payment fails the whole report closed.
import {calculateOutstanding} from './outstanding-snapshot.mjs';
export function summarizeOutstanding(invoices,payments,options={}) {
 // A paginated or stale payment query must never produce a misleading balance.
 if (options?.completeSnapshot!==true || options?.independentRefundDisputeCheck!==true)
  return {available:false,reason:'Complete independently rechecked payment snapshot required'};
 if (!Array.isArray(invoices)||!Array.isArray(payments))
  return {available:false,reason:'Invoice or payment records unavailable'};
 const invoiceIds=new Set(),byInvoice=new Map();
 for(const invoice of invoices) {
  if (!invoice || typeof invoice.id!=='string' || !invoice.id.trim() ||
      invoiceIds.has(invoice.id))
   return {available:false,reason:'Invalid or duplicate invoice'};
  invoiceIds.add(invoice.id);
  byInvoice.set(invoice.id,[]);
 }
 const paymentIds=new Set();
 for(const payment of payments) {
  if (!payment || !byInvoice.has(payment.invoiceId) ||
      typeof payment.paymentId!=='string' || paymentIds.has(payment.paymentId))
   return {available:false,reason:'Unmatched or duplicate payment'};
  paymentIds.add(payment.paymentId);
  byInvoice.get(payment.invoiceId).push(payment);
 }
 let total=0,paid=0,outstanding=0;
 const rows=[];
 for(const invoice of invoices) {
  const result=calculateOutstanding(invoice,byInvoice.get(invoice.id));
  if(!result.available)return {available:false,reason:result.reason};
  if(!Number.isSafeInteger(total+result.invoiceAmountPaise) ||
     !Number.isSafeInteger(paid+result.verifiedPaidPaise) ||
     !Number.isSafeInteger(outstanding+result.outstandingPaise))
   return {available:false,reason:'Unsafe report total'};
  total+=result.invoiceAmountPaise;
  paid+=result.verifiedPaidPaise;
  outstanding+=result.outstandingPaise;
  rows.push(result);
 }
 return {available:true,invoiceCount:rows.length,invoiceTotalPaise:total,
         verifiedPaidPaise:paid,outstandingPaise:outstanding,rows,
         asOf:'snapshot-only'};
}
