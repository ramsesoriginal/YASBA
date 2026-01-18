import { describe, expect, it } from "vitest";
import { parseImportJsonV1 } from "../exportImport";

describe("parseImportJsonV1", () => {
  it("parses a valid v1 export and normalizes record ordering by createdAt then id", () => {
    const json = JSON.stringify(
      {
        format: "yasba.export",
        version: 1,
        exportedAt: "2026-01-31T12:00:00.000Z",
        records: [
          // later createdAt
          {
            type: "CategoryCreated",
            id: "b",
            createdAt: "2026-01-02T00:00:00.000Z",
            categoryId: "cat-b",
            name: "B",
          },
          // same createdAt, id tie-break
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
        ],
      },
      null,
      2
    );

    const env = parseImportJsonV1(json);
    expect(env.format).toBe("yasba.export");
    expect(env.version).toBe(1);
    expect(env.exportedAt).toBe("2026-01-31T12:00:00.000Z");
    expect(env.records.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseImportJsonV1("{")).toThrow(/invalid JSON/i);
  });

  it("rejects unsupported format", () => {
    const json = JSON.stringify({
      format: "something-else",
      version: 1,
      exportedAt: "2026-01-31T12:00:00.000Z",
      records: [],
    });

    expect(() => parseImportJsonV1(json)).toThrow(/unsupported format/i);
  });

  it("rejects unsupported version", () => {
    const json = JSON.stringify({
      format: "yasba.export",
      version: 999,
      exportedAt: "2026-01-31T12:00:00.000Z",
      records: [],
    });

    expect(() => parseImportJsonV1(json)).toThrow(/unsupported version/i);
  });

  it("rejects unknown record type", () => {
    const json = JSON.stringify({
      format: "yasba.export",
      version: 1,
      exportedAt: "2026-01-31T12:00:00.000Z",
      records: [
        {
          type: "HackedRecordType",
          id: "x",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(() => parseImportJsonV1(json)).toThrow(/unknown type/i);
  });

  it("rejects missing required fields for known record types", () => {
    const json = JSON.stringify({
      format: "yasba.export",
      version: 1,
      exportedAt: "2026-01-31T12:00:00.000Z",
      records: [
        // CategoryCreated missing categoryId
        {
          type: "CategoryCreated",
          id: "c1",
          createdAt: "2026-01-01T00:00:00.000Z",
          name: "Groceries",
        },
      ],
    });

    expect(() => parseImportJsonV1(json)).toThrow(/invalid or missing "categoryId"/i);
  });
});
