// AAROHAN AI WORLD — read-only Billing Overview for the loaded latest 100 records.
// These are document FACE VALUES, NOT revenue, payment confirmation or GST calculations.
import {totalPaise,formatINR} from './amounts.mjs';

function addDocumentValues(rows, selectItems) {
 let total=0, invalid=0;
 for (const row of rows) {
  try {
   const value=totalPaise(selectItems(row));
   if (!Number.isSafeInteger(total+value)) {
    invalid++;
    continue;
   }
   total+=value;
  } catch {
   invalid++;
  }
 }
 return {value:invalid ? null : formatINR(total), invalid};
}
export function summarizeRecentBilling(quotations,invoices) {
 if (!Array.isArray(quotations)||!Array.isArray(invoices)) {
  throw new TypeError('Billing overview requires quotation and invoice arrays');
 }
 const quotes=addDocumentValues(quotations,row=>row.items);
 const drafts=addDocumentValues(invoices,row=>row.billing_quotations?.items);
 return {
  quotationCount:quotations.length,
  invoiceDraftCount:invoices.length,
  quotationFaceValue:quotes.value,
  invoiceDraftFaceValue:drafts.value,
  incompleteValues:quotes.invalid+drafts.invalid,
  quotationListLimitReached:quotations.length>=100,
  invoiceListLimitReached:invoices.length>=100,
  paymentStatus:'Not connected — verify directly in Razorpay',
  receiptStatus:'Not available — receipts require payment verification'
 };
}
