// Deterministic display reference only. Allocation MUST happen atomically
// in the private database after provider verification and invoice locking.
// Never calculate the next number from the browser or MAX(receipt_number).
export function formatReceiptReference(financialYear,sequence) {
 if (typeof financialYear!=='string' || !/^[0-9]{4}-[0-9]{2}$/.test(financialYear))
  throw new Error('Invalid financial year');
 const [start,end]=financialYear.split('-').map(Number);
 if (start<2000 || start>9999 || end!==(start+1)%100)
  throw new Error('Invalid financial year sequence');
 if (!Number.isSafeInteger(sequence) || sequence<1 || sequence>999999999)
  throw new Error('Invalid receipt sequence');
 return 'AAR-REC-'+financialYear+'-'+String(sequence).padStart(6,'0');
}
