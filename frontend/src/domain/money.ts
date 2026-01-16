import type { MoneyCents } from "./types";

/** Domain invariant: money is integer cents (no floats). */
export function assertMoneyCents(value: MoneyCents): void {
  if (!Number.isInteger(value)) {
    throw new Error(`MoneyCents must be an integer. Got: ${value}`);
  }
}
