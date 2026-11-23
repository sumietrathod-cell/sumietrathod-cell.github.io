import { validWithdrawalPhones } from "./csv-import-policy.ts";

const headers = ["full_name", "phone_e164", "email", "consent_status", "consent_evidence"];
const index = Object.fromEntries(headers.map((key, i) => [key, i]));
const csv = (...data: string[][]) => [headers, ...data];
const phone = "+919999000456";
const unknown = ["Test Contact", phone, "test@example.invalid", "unknown", ""];
const withdrawn = ["Test Contact", phone, "test@example.invalid", "withdrawn", ""];
const granted = ["Test Contact", phone, "test@example.invalid", "granted", "self-asserted-proof"];

Deno.test("later valid withdrawn row overrides earlier unknown contact", () => {
  const result = validWithdrawalPhones(csv(unknown, withdrawn), index);
  if (!result.has(phone) || result.size !== 1) throw new Error("withdrawal precedence failed");
});

Deno.test("earlier withdrawn also overrides a later unknown or alleged grant", () => {
  const result = validWithdrawalPhones(csv(withdrawn, unknown, granted), index);
  if (!result.has(phone) || result.size !== 1) throw new Error("withdrawn was not retained");
});

Deno.test("fabricated granted row alone is never an opt-out or a valid grant", () => {
  const result = validWithdrawalPhones(csv(granted), index);
  if (result.size !== 0) throw new Error("granted CSV row must not count as withdrawn");
});

Deno.test("malformed withdrawn rows must not suppress a separate valid unknown row", () => {
  const bad = [
    ["Test", "bad-phone", "", "withdrawn", ""],
    ["Test", phone, "invalid-email", "withdrawn", ""],
    ["A".repeat(161), phone, "", "withdrawn", ""],
    ["Test", phone, "", "withdrawn", "E".repeat(501)],
    ["Test", phone, "", "withdrawn", "", "EXTRA-COLUMN"],
  ];
  for (const row of bad) {
    if (validWithdrawalPhones(csv(unknown, row), index).size !== 0) {
      throw new Error("Invalid withdrawal row affected precedence");
    }
  }
});

Deno.test("mixed-case withdrawal and whitespace normalization", () => {
  const row = [" Test ", "  +919999000456 ", "", " WiThDrAwN ", ""];
  if (!validWithdrawalPhones(csv(row), index).has(phone)) {
    throw new Error("valid withdrawn state was overlooked");
  }
});

Deno.test("only valid withdrawn phones are returned, duplicates collapse safely", () => {
  const other = ["Second", "+919999000457", "", "withdrawn", ""];
  const result = validWithdrawalPhones(csv(withdrawn, withdrawn, other), index);
  if (result.size !== 2 || !result.has(phone) || !result.has(other[1])) {
    throw new Error("unexpected withdrawal set");
  }
});
