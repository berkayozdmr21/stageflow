import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { Domain, Actor, overlaps } from "../apps/api/src/domain";
import { seed } from "../apps/api/src/seed";
import { drain, reconcile } from "../packages/contracts/sync";
import { festivalDate, festivalInput } from "../packages/contracts";
import { randomUUID } from "node:crypto";
const admin: Actor = {
  id: "u-admin",
  orgId: "org-north",
  name: "Berkay Özdemir",
  role: "admin",
  team: "Operasyon",
};
const tech: Actor = {
  id: "u-tech",
  orgId: "org-north",
  name: "Ece Demir",
  role: "technician",
  team: "Teknik",
};
const other: Actor = { ...admin, id: "u-other", orgId: "org-other" };
const gate: Actor = { ...admin, id: "u-gate", role: "gate" };
const base =
  process.env.TEST_DATABASE_URL ||
  "postgresql://stageflow@127.0.0.1:55452/postgres";
const manager = new Pool({ connectionString: base });
const db = "stageflow_test_" + process.pid;
let pool: Pool, d: Domain;
before(async () => {
  await manager.query(`CREATE DATABASE ${db}`);
  const url = new URL(base);
  url.pathname = "/" + db;
  pool = new Pool({ connectionString: url.toString() });
  await pool.query(readFileSync("apps/api/src/schema.sql", "utf8"));
  await seed(pool);
  d = new Domain(pool);
});
after(async () => {
  if (pool) await pool.end();
  await manager.query(`DROP DATABASE IF EXISTS ${db}`);
  await manager.end();
});
const mutate = (action: string, input: any, actor = admin, id = randomUUID()) =>
  d.mutate(actor, action, input, id);
test("interval boundaries permit adjacent slots", () => {
  assert.equal(
    overlaps(
      "2026-10-24T10:00Z",
      "2026-10-24T11:00Z",
      "2026-10-24T11:00Z",
      "2026-10-24T12:00Z",
    ),
    false,
  );
});
test("organization isolation denies another festival", async () => {
  await assert.rejects(() => d.snapshot(other), /Festival bulunamadı/);
});
test("password authentication returns no password hash", async () => {
  await assert.rejects(() => d.login("admin@stageflow.local", "bad"), /parola/);
  const user = await d.login("admin@stageflow.local", "Stageflow2026!");
  assert.equal(user.id, "u-admin");
  assert.equal("password" in user, false);
});
test("attendee snapshot contains only public operations and own ticket", async () => {
  const snap = await d.snapshot({ ...admin, id: "u-guest", role: "attendee" });
  assert.equal(snap.tasks, undefined);
  assert.equal(snap.audit, undefined);
  assert.equal(snap.tickets.length, 1);
});
test("task dependencies block premature completion", async () => {
  await assert.rejects(
    () => mutate("task.status", { id: "t2", status: "done", version: 1 }, tech),
    /bağımlı/,
  );
});
test("optimistic task version and idempotency prevent double writes", async () => {
  const key = randomUUID();
  const input = { id: "t1", status: "done", version: 1 };
  const first = await mutate("task.status", input, tech, key);
  const duplicate = await mutate("task.status", input, tech, key);
  assert.deepEqual(first, duplicate);
  assert.equal(
    (await pool.query("SELECT version FROM tasks WHERE id='t1'")).rows[0]
      .version,
    2,
  );
  await assert.rejects(
    () => mutate("task.status", { ...input, status: "todo" }),
    /başka cihazda/,
  );
});
test("technician cannot edit another person task", async () => {
  await assert.rejects(
    () =>
      mutate("task.status", { id: "t3", status: "doing", version: 1 }, tech),
    /kendi görevlerini/,
  );
});
test("stage and artist schedule overlaps rejected", async () => {
  await assert.rejects(
    () =>
      mutate("performance.save", {
        festivalId: "northline-26",
        stageId: "main",
        artist: "Other",
        genre: "Rock",
        startsAt: "2026-10-24T16:30:00+03:00",
        endsAt: "2026-10-24T17:30:00+03:00",
      }),
    /çakışma/,
  );
});
test("reservation transaction rejects exhausted capacity", async () => {
  await assert.rejects(
    () =>
      mutate("reservation.create", {
        equipmentId: "eq1",
        stageId: "grove",
        quantity: 9,
        startsAt: "2026-10-24T15:00:00+03:00",
        endsAt: "2026-10-24T16:00:00+03:00",
      }),
    /yeterli ekipman/,
  );
});
test("inventory peak uses overlapping quantity rather than all reservations", async () => {
  const v = {
    equipmentId: "eq3",
    stageId: "main",
    quantity: 6,
    startsAt: "2026-10-24T10:00:00+03:00",
    endsAt: "2026-10-24T11:00:00+03:00",
  };
  await mutate("reservation.create", v);
  await mutate("reservation.create", {
    ...v,
    startsAt: v.endsAt,
    endsAt: "2026-10-24T12:00:00+03:00",
  });
});
test("shift overlap is rejected", async () => {
  await assert.rejects(
    () =>
      mutate("shift.create", {
        festivalId: "northline-26",
        userId: "u-tech",
        stageId: "grove",
        startsAt: "2026-10-24T12:00:00+03:00",
        endsAt: "2026-10-24T18:00:00+03:00",
      }),
    /vardiyası çakışıyor/,
  );
});
test("simultaneous ticket checkins accept once", async () => {
  const results = await Promise.allSettled([
    mutate("ticket.checkin", { id: "ticket-guest" }, gate),
    mutate("ticket.checkin", { id: "ticket-guest" }, gate),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
});
test("attendees cannot create operational tasks", async () => {
  await assert.rejects(
    () =>
      mutate("task.create", {}, { ...admin, id: "u-guest", role: "attendee" }),
    /yetkin yok/,
  );
});
test("mobile sync retains conflicting mutation and unsent tail", async () => {
  const queue = [1, 2, 3].map((n) => ({
    id: "mutation-" + n,
    userId: "u-tech",
    action: "task.status",
    input: { id: "t" + n },
    createdAt: new Date().toISOString(),
  }));
  const sent: string[] = [];
  const result = await drain(queue, async (m) => {
    if (m.id === "mutation-2")
      throw Object.assign(new Error("stale version"), { status: 409 });
    sent.push(m.id);
  });
  assert.equal(result.sent, 1);
  assert.equal(result.conflict, true);
  assert.deepEqual(
    result.remaining.map((m) => m.id),
    ["mutation-2", "mutation-3"],
  );
  assert.deepEqual(sent, ["mutation-1"]);
});
test("mobile offline retry retains original idempotency key", async () => {
  const queue = [
    {
      id: "same-key-001",
      userId: "u-tech",
      action: "task.status",
      input: {},
      createdAt: "",
    },
  ];
  const result = await drain(queue, async () => {
    throw new TypeError("Network unavailable");
  });
  assert.equal(result.offline, true);
  assert.equal(result.remaining[0].id, "same-key-001");
});

test("new mutations queued during sync are retained", async () => {
  const first = {
    id: "batch-one-001",
    userId: "u-tech",
    action: "task.status",
    input: { id: "t1" },
    createdAt: "",
  };
  const next = { ...first, id: "new-queued-002", input: { id: "t2" } };
  const result = await drain([first], async () => {});
  assert.deepEqual(
    reconcile([first], result.remaining, [first, next]).map((m) => m.id),
    [next.id],
  );
});
test("UTC persistence preserves Istanbul edit time and date", () => {
  assert.equal(festivalInput("2026-10-24T13:00:00Z"), "2026-10-24T16:00");
  assert.equal(festivalDate("2026-10-24T22:30:00Z"), "2026-10-25");
});
test("idempotency key cannot be reused for another operation", async () => {
  const key = randomUUID();
  await mutate("favorite.toggle", { id: "p1" }, admin, key);
  await assert.rejects(
    () => mutate("favorite.toggle", { id: "p2" }, admin, key),
    /başka bir değişiklik/,
  );
});
test("stage layout is tenant scoped and positions validated", async () => {
  await assert.rejects(
    () => mutate("stage.move", { id: "main", x: 52, y: 40 }, other),
    /bulunamadı/,
  );
  await mutate("stage.move", { id: "main", x: 52, y: 40 });
  assert.equal(
    (await pool.query("SELECT x FROM stages WHERE id='main'")).rows[0].x,
    52,
  );
  await assert.rejects(() =>
    mutate("stage.move", { id: "main", x: 200, y: 40 }),
  );
});
test("performances stay within festival dates", async () => {
  await assert.rejects(
    () =>
      mutate("performance.save", {
        festivalId: "northline-26",
        stageId: "main",
        artist: "Out of range",
        genre: "Rock",
        startsAt: "2026-10-27T12:00:00+03:00",
        endsAt: "2026-10-27T13:00:00+03:00",
      }),
    /festival tarihleri/,
  );
});
