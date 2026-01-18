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
