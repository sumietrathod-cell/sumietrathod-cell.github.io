// AAROHAN AI WORLD billing: deterministic, non-GST monetary arithmetic.
// Currency values remain integer paise; do not use floating-point rounding
// to decide invoice totals or silently interpret malformed amounts.
export function toPaise(raw) {
  const text=String(raw ?? '').trim();
  if (!/^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/.test(text)) {
    throw new Error('Unit price must be INR 0.00 to 9,999,999.99 with at most two decimals.');
  }
  const [rupees,paise='']=text.split('.');
  const amount=Number(rupees)*100+Number((paise+'00').slice(0,2));
  if (!Number.isSafeInteger(amount)||amount<0||amount>999999999) {
    throw new Error('Unit price is outside the allowed range.');
  }
  return amount;
}
export function buildItems(lines) {
  if (!Array.isArray(lines)||lines.length<1||lines.length>50) {
    throw new Error('Add between 1 and 50 service lines.');
  }
  const entries=lines.map((entry,index)=>{
    const service=String(entry.service??'').trim();
    const qtyText=String(entry.qty??'').trim();
    if (service.length<1||service.length>200 || /[\u0000-\u001f\u007f-\u009f]/.test(service)) {
      throw new Error('Service name must be 1–200 characters (line '+(index+1)+').');
    }
    if (!/^[1-9][0-9]{0,3}$/.test(qtyText)||Number(qtyText)>9999) {
      throw new Error('Quantity must be 1–9,999 (line '+(index+1)+').');
    }
    return {service,qty:Number(qtyText),paise:toPaise(entry.price)};
  });
  // Defensive check also applies to results read back from the database.
  totalPaise(entries);
  return entries;
}
export function totalPaise(items) {
  if (!Array.isArray(items)||items.length<1||items.length>50) throw new Error('Invalid quotation items.');
  let total=0;
  for (const line of items) {
    if (typeof line.service!=='string'||!line.service.trim()||line.service.length>200 || /[\u0000-\u001f\u007f-\u009f]/.test(line.service) ||
        !Number.isInteger(line.qty)||line.qty<1||line.qty>9999 ||
        !Number.isInteger(line.paise)||line.paise<0||line.paise>999999999) {
      throw new Error('Quotation contains invalid line items.');
    }
    const amount=line.qty*line.paise;
    if (!Number.isSafeInteger(amount)||!Number.isSafeInteger(total+amount)) {
      throw new Error('Quotation total exceeds safe integer precision.');
    }
    total+=amount;
  }
  return total;
}
export function formatINR(paise) {
  if (!Number.isSafeInteger(paise)||paise<0) throw new Error('Invalid paise value.');
  return (paise/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});
}
