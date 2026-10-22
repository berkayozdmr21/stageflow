import { test } from "node:test";
import assert from "node:assert/strict";
import { festivalDisplayDate } from "../packages/contracts";

test("festival date labels do not depend on the device timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of [
      "UTC",
      "Europe/Istanbul",
      "America/Los_Angeles",
      "Asia/Tokyo",
    ]) {
      process.env.TZ = zone;
      assert.equal(
        festivalDisplayDate("2026-10-24T22:30:00Z"),
        "25.10.2026",
        zone,
      );
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("festival date labels keep offset timestamps and audit instants consistent", () => {
  assert.equal(festivalDisplayDate("2026-10-25T00:15:00+03:00"), "25.10.2026");
  assert.equal(festivalDisplayDate("2026-10-24T21:15:00Z"), "25.10.2026");
});
