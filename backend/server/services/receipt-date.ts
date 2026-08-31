const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RECEIPT_AGE_DAYS = 30;
const DATE_PATTERN = /(?<!\d)(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?!\d)/g;
const DATE_LABEL = /(?:TAR(?:I|\u0130)H|DATE)/iu;
const RECEIPT_END_MARKER = /(?:TOPLAM|TOTAL|FIS\s*NO|F[İI]S\s*NO|BELGE\s*NO|THANK|TE[ŞS]EKK[UÜ]R)/iu;

export class ReceiptDateError extends Error {
  constructor(
    message: string,
    public readonly code: "RECEIPT_DATE_NOT_FOUND" | "RECEIPT_DATE_INVALID" | "RECEIPT_DATE_OUT_OF_RANGE"
  ) {
    super(message);
    this.name = "ReceiptDateError";
  }
}

export class ReceiptQualityError extends Error {
  readonly code = "RECEIPT_INCOMPLETE";

  constructor() {
    super("Upload the full receipt with its date and total or receipt number visible");
    this.name = "ReceiptQualityError";
  }
}

export function assertCompleteReceipt(lines: string[]): void {
  if (!lines.some((line) => RECEIPT_END_MARKER.test(line.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")))) {
    throw new ReceiptQualityError();
  }
}

function turkeyToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function parseDate(match: RegExpMatchArray): Date | null {
  const [, first, second, third] = match;
  const year = first.length === 4 ? Number(first) : third.length === 2 ? 2000 + Number(third) : Number(third);
  const month = Number(second);
  const day = first.length === 4 ? Number(third) : Number(first);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

export function assertRecentReceiptDate(lines: string[], now = new Date(), enforceRange = true): string {
  const candidates = lines.flatMap((line) => {
    DATE_PATTERN.lastIndex = 0;
    return [...line.matchAll(DATE_PATTERN)].map((match) => ({ line, match }));
  });
  if (!candidates.length) {
    throw new ReceiptDateError("Receipt date could not be detected", "RECEIPT_DATE_NOT_FOUND");
  }

  const candidate = candidates.find(({ line }) => DATE_LABEL.test(line)) ?? candidates[0];
  const receiptDate = parseDate(candidate.match);
  if (!receiptDate) {
    throw new ReceiptDateError("Receipt date is invalid", "RECEIPT_DATE_INVALID");
  }

  if (enforceRange) {
    const today = turkeyToday(now);
    const daysAgo = Math.floor((today.getTime() - receiptDate.getTime()) / DAY_MS);
    if (daysAgo < 0 || daysAgo > MAX_RECEIPT_AGE_DAYS) {
      throw new ReceiptDateError(
        "Only receipts from today or the previous 30 days are accepted",
        "RECEIPT_DATE_OUT_OF_RANGE"
      );
    }
  }

  return receiptDate.toISOString().slice(0, 10);
}
