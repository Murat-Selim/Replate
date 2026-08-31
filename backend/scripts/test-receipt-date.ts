import assert from "node:assert/strict";
import {
  assertCompleteReceipt,
  assertRecentReceiptDate,
  ReceiptDateError,
  ReceiptQualityError,
} from "../server/services/receipt-date.js";
import { createReceiptHash } from "../server/services/receipt-hash.js";

const today = new Date("2026-08-06T12:00:00Z");

assert.equal(assertRecentReceiptDate(["TARIH: 06.08.2026"], today), "2026-08-06");
assert.equal(assertRecentReceiptDate(["TARIH : 31/07/2026"], today), "2026-07-31");
assert.equal(assertRecentReceiptDate(["TARIH: 07.07.2026"], today), "2026-07-07");
assert.equal(assertRecentReceiptDate(["TARIH: 06.07.2026"], today, false), "2026-07-06");
assert.equal(assertRecentReceiptDate(["Receipt date: November 12 2025"], today, false), "2025-11-12");
assert.equal(assertRecentReceiptDate(["DATE: November 12, 2025"], today, false), "2025-11-12");
assert.doesNotThrow(() => assertCompleteReceipt(["TARIH: 06.08.2026", "TOPLAM 100,00"]));
assert.throws(
  () => assertCompleteReceipt(["TARIH: 06.08.2026", "ELMA 1 KG"]),
  (error) => error instanceof ReceiptQualityError && error.code === "RECEIPT_INCOMPLETE"
);
assert.throws(
  () => assertRecentReceiptDate(["TARIH: 06.07.2026"], today),
  (error) => error instanceof ReceiptDateError && error.code === "RECEIPT_DATE_OUT_OF_RANGE"
);
assert.throws(
  () => assertRecentReceiptDate(["ELMA 1 KG"], today),
  (error) => error instanceof ReceiptDateError && error.code === "RECEIPT_DATE_NOT_FOUND"
);
assert.equal(
  createReceiptHash(["TARIH: 15/08/2026", "FIS NO: 0100", "TOPLAM *555,98"], "2026-08-15"),
  createReceiptHash(["TARİH:15/08/2026", "FİŞ NO:0100", "TOPLAM", "*555.98"], "2026-08-15")
);

console.log("Receipt date checks passed");
