import { Contract, ethers, keccak256, toUtf8Bytes } from "ethers";
import { CONTRACT_ADDRESS } from "../../src/lib/contract.js";

const READ_RPC = process.env.RPC_URL || process.env.BASE_RPC_URL || "https://mainnet.base.org";
const RECEIPT_HASH_ABI = ["function usedReceiptHashes(bytes32) view returns (bool)"];
const MONEY_PATTERN = /(?<!\d)(?:\d{1,3}(?:[.\s]\d{3})+|\d+)[,.]\d{2}(?!\d)/g;

function normalizeLine(line: string): string {
  return line
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

function normalizeMoney(value: string): string {
  const compact = value.replace(/\s/g, "");
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  return Number(normalized).toFixed(2);
}

/** Stable receipt identity across OCR spacing and line-break changes. */
export function createReceiptHash(lines: string[], receiptDate: string): string {
  const normalizedLines = lines.map(normalizeLine).filter(Boolean);
  const receiptNumber = normalizedLines
    .map((line) =>
      line.match(/\b(?:FIS|BELGE|FATURA)\s*(?:NO|NUMARASI)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]{2,})/i)?.[1]
    )
    .find(Boolean);
  const totalLineIndex = normalizedLines.findIndex((line) => /\bTOPLAM\b/i.test(line));
  const totalCandidates = totalLineIndex >= 0
    ? normalizedLines
      .slice(totalLineIndex, totalLineIndex + 2)
      .flatMap((line) => [...line.matchAll(MONEY_PATTERN)].map((match) => match[0]))
    : [];
  const total = totalCandidates[totalCandidates.length - 1];
  const identity = receiptNumber || total
    ? `receipt|date:${receiptDate}|number:${receiptNumber ?? ""}|total:${total ? normalizeMoney(total) : ""}`
    : `receipt|date:${receiptDate}|text:${normalizedLines.join("\n")}`;

  return keccak256(toUtf8Bytes(identity));
}

/** Keeps receipts submitted before the stable identity hash rollout protected. */
export function createLegacyReceiptHash(lines: string[]): string {
  const normalizedReceipt = lines
    .map((line) => line.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR"))
    .filter(Boolean)
    .join("\n");
  return keccak256(toUtf8Bytes(normalizedReceipt));
}

export async function isReceiptHashUsed(receiptHash: string): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(READ_RPC);
  const contract = new Contract(
    process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS,
    RECEIPT_HASH_ABI,
    provider
  );
  return Boolean(await contract.usedReceiptHashes(receiptHash));
}
