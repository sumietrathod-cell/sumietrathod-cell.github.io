// Pure, side-effect-free CSV consent conflict preflight.
// Only syntactically valid withdrawn rows take precedence over earlier unknown
// rows for the same phone, regardless of their position in the uploaded file.
// This prevents the first unknown row winning before a later "do not contact"
// request is processed. No customer data or network access in this module.
export function validWithdrawalPhones(
  rows: string[][],
  headers: Record<string, number>,
): Set<string> {
  const withdrawn = new Set<string>();
  const get = (row: string[], key: string) => (row[headers[key]] ?? "").trim();
  const headerCount = Object.keys(headers).length;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length > headerCount) continue;
    if (get(row, "consent_status").toLowerCase() !== "withdrawn") continue;
    const phone = get(row, "phone_e164");
    const name = get(row, "full_name");
    const email = get(row, "email");
    const evidence = get(row, "consent_evidence");
    if (!/^\+[1-9]\d{7,14}$/.test(phone) ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
        email.length > 254 || name.length > 160 || evidence.length > 500) continue;
    withdrawn.add(phone);
  }
  return withdrawn;
}
