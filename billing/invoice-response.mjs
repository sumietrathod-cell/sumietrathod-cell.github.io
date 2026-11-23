// Validate untrusted invoice RPC responses before presenting a document.
// This is a client-side defense in depth, not a substitute for database RLS.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requireInvoiceDraft(response,quotationId){
 const invoice=Array.isArray(response)?(response.length===1?response[0]:null):response;
 if(!invoice||typeof invoice!=='object'||Array.isArray(invoice)
   ||typeof quotationId!=='string'||!uuid.test(quotationId)
   ||typeof invoice.id!=='string'||!uuid.test(invoice.id)
   ||invoice.quotation_id!==quotationId
   ||typeof invoice.issued_at!=='string'
   ||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(invoice.issued_at)
   ||!Number.isFinite(Date.parse(invoice.issued_at)))
   ||!['draft',undefined,null].includes(invoice.status)){
  throw new Error('Invalid invoice draft response; document not opened.');
 }
 return invoice;
}
