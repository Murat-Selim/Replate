import assert from "node:assert/strict";
import {
  assertCompleteReceipt,
  assertRecentReceiptDate,
  ReceiptDateError,
  ReceiptQualityError,
} from "../server/services/receipt-date.js";

const today = new Date("2026-08-06T12:00:00Z");

assert.equal(assertRecentReceiptDate(["TARIH: 06.08.2026"], today), "2026-08-06");
assert.equal(assertRecentReceiptDate(["TARIH : 31/07/2026"], today), "2026-07-31");
assert.equal(assertRecentReceiptDate(["TARIH: 07.07.2026"], today), "2026-07-07");
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

console.log("Receipt date checks passed");
