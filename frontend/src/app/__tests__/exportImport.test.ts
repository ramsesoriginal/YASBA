import { describe, expect, it } from "vitest";
import type { DomainRecord } from "../../domain/types";
import { envelopeToJson, makeExportEnvelopeV1 } from "../exportImport";

describe("exportImport", () => {
  it("creates a v1 export envelope with stable ordering by createdAt then id", () => {
    const records: DomainRecord[] = [
      // later createdAt
      {
        type: "CategoryCreated",
        id: "b",
        createdAt: "2026-01-02T00:00:00.000Z",
        categoryId: "cat-b",
        name: "B",
      },
      // same createdAt as another, tie broken by id
      {
        type: "CategoryCreated",
        id: "c",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-c",
        name: "C",
      },
      {
        type: "CategoryCreated",
        id: "a",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-a",
        name: "A",
      },
    ];

    const env = makeExportEnvelopeV1({
      records,
      exportedAt: "2026-01-31T12:00:00.000Z",
    });

    expect(env.format).toBe("yasba.export");
    expect(env.version).toBe(1);
    expect(env.exportedAt).toBe("2026-01-31T12:00:00.000Z");

    // sorted: createdAt asc, id asc
    expect(env.records.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("serializes envelope as pretty JSON", () => {
    const records: DomainRecord[] = [
      {
        type: "CategoryCreated",
        id: "a",
        createdAt: "2026-01-01T00:00:00.000Z",
        categoryId: "cat-a",
        name: "A",
      },
    ];

    const env = makeExportEnvelopeV1({
      records,
      exportedAt: "2026-01-31T12:00:00.000Z",
    });

    const json = envelopeToJson(env);

    // quick smoke checks
    expect(json).toContain('"format": "yasba.export"');
    expect(json).toContain('"version": 1');
    expect(json).toContain('"exportedAt": "2026-01-31T12:00:00.000Z"');
    expect(json).toContain('"records":');
    expect(json).toContain('"type": "CategoryCreated"');
  });
});
