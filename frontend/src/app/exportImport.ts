import type { DomainRecord, IsoDateTime } from "../domain/types";

export type YasbaExportV1 = {
  format: "yasba.export";
  version: 1;
  exportedAt: IsoDateTime;
  records: DomainRecord[];
};

type SortKey = { createdAt: IsoDateTime; id: string };

function compareSortKey(a: SortKey, b: SortKey): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function makeExportEnvelopeV1(params: {
  records: readonly DomainRecord[];
  exportedAt: IsoDateTime;
}): YasbaExportV1 {
  const sorted = [...params.records].sort((ra, rb) =>
    compareSortKey({ createdAt: ra.createdAt, id: ra.id }, { createdAt: rb.createdAt, id: rb.id })
  );

  return {
    format: "yasba.export",
    version: 1,
    exportedAt: params.exportedAt,
    records: sorted,
  };
}

export function envelopeToJson(envelope: YasbaExportV1): string {
  return JSON.stringify(envelope, null, 2);
}

export type ImportError = { message: string };

function isRecordObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isIsoString(x: unknown): x is IsoDateTime {
  return typeof x === "string" && x.includes("T") && x.endsWith("Z");
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function requireField<T>(
  obj: Record<string, unknown>,
  key: string,
  pred: (v: unknown) => v is T,
  ctx: string
): T {
  const v = obj[key];
  if (!pred(v)) throw new Error(`${ctx}: invalid or missing "${key}"`);
  return v;
}

// Minimal per-type validators (Phase 1 strict-enough)
function validateDomainRecord(x: unknown): DomainRecord {
  if (!isRecordObject(x)) throw new Error("record: not an object");

  const type = requireField(x, "type", isString, "record");
  const id = requireField(x, "id", isString, `record(${type})`);
  requireField(x, "createdAt", isIsoString, `record(${type}:${id})`);

  // base fields are good; now type-specific checks (just the required ones)
  switch (type) {
    case "CategoryCreated":
      requireField(x, "categoryId", isString, `record(${type}:${id})`);
      requireField(x, "name", isString, `record(${type}:${id})`);
      break;

    case "CategoryRenamed":
      requireField(x, "categoryId", isString, `record(${type}:${id})`);
      requireField(x, "name", isString, `record(${type}:${id})`);
      break;

    case "CategoryArchived":
      requireField(x, "categoryId", isString, `record(${type}:${id})`);
      if (typeof x.archived !== "boolean")
        throw new Error(`record(${type}:${id}): invalid or missing "archived"`);
      break;

    case "CategoryReordered":
      if (!Array.isArray(x.orderedCategoryIds) || !x.orderedCategoryIds.every(isString)) {
        throw new Error(`record(${type}:${id}): invalid or missing "orderedCategoryIds"`);
      }
      break;

    case "CategoryReparented":
      requireField(x, "categoryId", isString, `record(${type}:${id})`);
      if (x.parentCategoryId !== undefined && !isString(x.parentCategoryId)) {
        throw new Error(`record(${type}:${id}): invalid "parentCategoryId"`);
      }
      break;

    case "TransactionCreated":
      requireField(x, "occurredAt", isIsoString, `record(${type}:${id})`);
      if (typeof x.amountCents !== "number")
        throw new Error(`record(${type}:${id}): invalid or missing "amountCents"`);
      // categoryId is optional
      if (x.categoryId !== undefined && !isString(x.categoryId))
        throw new Error(`record(${type}:${id}): invalid "categoryId"`);
      // payee/memo optional
      if (x.payee !== undefined && !isString(x.payee))
        throw new Error(`record(${type}:${id}): invalid "payee"`);
      if (x.memo !== undefined && !isString(x.memo))
        throw new Error(`record(${type}:${id}): invalid "memo"`);
      break;

    case "TransactionVoided":
      requireField(x, "transactionId", isString, `record(${type}:${id})`);
      break;

    case "TransactionCorrected":
      requireField(x, "transactionId", isString, `record(${type}:${id})`);
      if (!isRecordObject(x.replacement))
        throw new Error(`record(${type}:${id}): invalid or missing "replacement"`);
      requireField(x.replacement, "occurredAt", isIsoString, `record(${type}:${id}).replacement`);
      if (typeof x.replacement.amountCents !== "number")
        throw new Error(`record(${type}:${id}).replacement: invalid "amountCents"`);
      if (x.replacement.categoryId !== undefined && !isString(x.replacement.categoryId)) {
        throw new Error(`record(${type}:${id}).replacement: invalid "categoryId"`);
      }
      break;

    case "BudgetAssigned":
      requireField(x, "monthKey", isString, `record(${type}:${id})`);
      requireField(x, "categoryId", isString, `record(${type}:${id})`);
      if (typeof x.amountCents !== "number")
        throw new Error(`record(${type}:${id}): invalid or missing "amountCents"`);
      break;

    default:
      throw new Error(`record: unknown type "${type}"`);
  }

  return x as DomainRecord;
}

export function parseImportJsonV1(text: string): YasbaExportV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("import: invalid JSON");
  }

  if (!isRecordObject(raw)) throw new Error("import: root must be an object");

  const format = requireField(raw, "format", isString, "import");
  const version = raw.version;
  const exportedAt = requireField(raw, "exportedAt", isIsoString, "import");

  if (format !== "yasba.export") throw new Error(`import: unsupported format "${format}"`);
  if (version !== 1) throw new Error(`import: unsupported version "${String(version)}"`);

  if (!Array.isArray(raw.records)) throw new Error('import: invalid or missing "records"');

  const records = raw.records.map(validateDomainRecord);

  // Normalize: re-sort deterministically so import doesn't depend on input order
  const normalized = makeExportEnvelopeV1({ records, exportedAt });

  return normalized;
}
