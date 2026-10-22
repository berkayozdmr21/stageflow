import { Pool, PoolClient } from "pg";
import {
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { HttpException } from "@nestjs/common";
import { z } from "zod";
import type { Actor } from "../../../packages/contracts";
export type { Actor } from "../../../packages/contracts";
export const fail = (message: string, status = 400): never => {
  throw new HttpException({ message }, status);
};
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success)
    fail(
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return r.data as T;
}
export const text = z.string().trim().min(1).max(200);
export const timestamp = z.string().datetime({ offset: true });
export function camel(value: any): any {
  if (Array.isArray(value)) return value.map(camel);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, a) => a.toUpperCase()),
        camel(v),
      ]),
    );
  return value;
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return Date.parse(a) < Date.parse(d) && Date.parse(c) < Date.parse(b);
}
export function interval(start: string, end: string) {
  if (Date.parse(end) <= Date.parse(start))
    fail("Bitiş, başlangıçtan sonra olmalı.");
}
export class Domain {
  constructor(
    public pool: Pool,
    public publish: (org: string) => void = () => {},
  ) {}
  async login(email: string, password: string) {
    const user = (
      await this.pool.query("SELECT * FROM users WHERE email=$1", [
        email.toLowerCase(),
      ])
    ).rows[0];
    if (!user) fail("E-posta veya parola hatalı.", 401);
    const [salt, hash] = user.password.split(":");
    const computed = scryptSync(password, salt, 64);
    if (!timingSafeEqual(Buffer.from(hash, "hex"), computed))
      fail("E-posta veya parola hatalı.", 401);
    const { password: _, ...rest } = user;
    return camel(rest) as Actor;
  }
  async festival(actor: Actor, id: string, c: Pool | PoolClient = this.pool) {
    const row = (
      await c.query("SELECT * FROM festivals WHERE id=$1 AND org_id=$2", [
        id,
        actor.orgId,
      ])
    ).rows[0];
    if (!row) fail("Festival bulunamadı.", 404);
    return row;
  }
  async snapshot(a: Actor, festivalId = "northline-26") {
    const festival = await this.festival(a, festivalId);
    const rows = async (sql: string, args: any[] = [festivalId]) =>
      (await this.pool.query(sql, args)).rows;
    const stages = await rows(
      "SELECT * FROM stages WHERE festival_id=$1 ORDER BY id",
    );
    const performances = await rows(
      "SELECT * FROM performances WHERE festival_id=$1 ORDER BY starts_at",
    );
    const favorites = (
      await rows("SELECT performance_id FROM favorites WHERE user_id=$1", [
        a.id,
      ])
    ).map((r) => r.performance_id);
    const tickets = await rows(
      a.role === "attendee"
        ? "SELECT id,code,category,checked_in_at FROM tickets WHERE festival_id=$1 AND user_id=$2"
        : "SELECT id,code,category,checked_in_at FROM tickets WHERE festival_id=$1",
      a.role === "attendee" ? [festivalId, a.id] : [festivalId],
    );
    if (a.role === "attendee")
      return camel({
        user: a,
        festival,
        stages,
        performances,
        favorites,
        tickets,
      });
    const [tasks, crew, equipment, reservations, shifts, incidents, audit] =
      await Promise.all([
        rows("SELECT * FROM tasks WHERE festival_id=$1 ORDER BY due_at"),
        rows(
          "SELECT id,name,role,team FROM users WHERE org_id=$1 AND role<>'attendee'",
          [a.orgId],
        ),
        rows("SELECT * FROM equipment WHERE festival_id=$1 ORDER BY name"),
        rows(
          "SELECT r.* FROM reservations r JOIN equipment e ON e.id=r.equipment_id WHERE e.festival_id=$1 ORDER BY r.starts_at",
        ),
        rows("SELECT * FROM shifts WHERE festival_id=$1 ORDER BY starts_at"),
        rows(
          "SELECT * FROM incidents WHERE festival_id=$1 ORDER BY created_at DESC",
        ),
        rows("SELECT * FROM audit WHERE org_id=$1 ORDER BY id DESC LIMIT 80", [
          a.orgId,
        ]),
      ]);
    return camel({
      user: a,
      festival,
      stages,
      performances,
      tasks,
      crew,
      equipment,
      reservations,
      shifts,
      incidents,
      audit,
      tickets,
      favorites,
    });
  }
  async mutate(a: Actor, action: string, input: unknown, mutationId: string) {
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(mutationId))
      fail("Geçerli mutationId gerekli.");
    const c = await this.pool.connect();
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ action, input }))
      .digest("hex");
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [a.orgId]);
      const prior = (
        await c.query(
          "SELECT result,request_hash FROM mutations WHERE user_id=$1 AND mutation_id=$2",
          [a.id, mutationId],
        )
      ).rows[0];
      if (prior) {
        if (prior.request_hash && prior.request_hash !== requestHash)
          fail("Bu işlem anahtarı başka bir değişiklik için kullanılmış.", 409);
        await c.query("COMMIT");
        return prior.result;
      }
      const result = await this.execute(c, a, action, input);
      await c.query(
        "INSERT INTO mutations(user_id,mutation_id,result,request_hash) VALUES($1,$2,$3,$4)",
        [a.id, mutationId, JSON.stringify(result), requestHash],
      );
      await c.query(
        "INSERT INTO audit(org_id,user_id,name,action,entity,details)VALUES($1,$2,$3,$4,$5,$6)",
        [
          a.orgId,
          a.id,
          a.name,
          action,
          String(
            (input as any)?.id || (input as any)?.festivalId || "northline-26",
          ),
          JSON.stringify({ result }),
        ],
      );
      await c.query("COMMIT");
      this.publish(a.orgId);
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  private async execute(
    c: PoolClient,
    a: Actor,
    action: string,
    raw: unknown,
  ): Promise<any> {
    const requireRole = (...roles: string[]) => {
      if (!roles.includes(a.role)) fail("Bu işlem için yetkin yok.", 403);
    };
    const scoped = async (table: string, id: string) => {
      const joins =
        table === "reservations"
          ? `JOIN equipment e ON e.id=t.equipment_id JOIN festivals f ON f.id=e.festival_id`
          : `JOIN festivals f ON f.id=t.festival_id`;
      const row = (
        await c.query(
          `SELECT t.* FROM ${table} t ${joins} WHERE t.id=$1 AND f.org_id=$2 FOR UPDATE OF t`,
          [id, a.orgId],
        )
      ).rows[0];
      if (!row) fail("Kayıt bulunamadı.", 404);
      return row;
    };
    const stage = async (id: string, festival: string) => {
      if (
        !(
          await c.query(
            "SELECT id FROM stages WHERE id=$1 AND festival_id=$2",
            [id, festival],
          )
        ).rowCount
      )
        fail("Sahne bu festivale ait değil.");
    };
    switch (action) {
      case "task.create": {
        requireRole("admin", "stage");
        const v = parse(
          z.object({
            festivalId: text,
            title: text,
            description: z.string().max(2000).default(""),
            team: text,
            stageId: text.nullable(),
            assignee: text.nullable(),
            priority: z.enum(["low", "medium", "high"]),
            dueAt: timestamp,
            dependencies: z.array(text).max(20).default([]),
          }),
          raw,
        );
        await this.festival(a, v.festivalId, c);
        if (v.stageId) await stage(v.stageId, v.festivalId);
        if (
          v.assignee &&
          !(
            await c.query("SELECT id FROM users WHERE id=$1 AND org_id=$2", [
              v.assignee,
              a.orgId,
            ])
          ).rowCount
        )
          fail("Ekip üyesi bulunamadı.");
        for (const id of v.dependencies) {
          const dep = await scoped("tasks", id);
          if (dep.festival_id !== v.festivalId)
            fail("Bağımlılık aynı festivalde olmalı.");
        }
        const id = randomUUID();
        await c.query(
          "INSERT INTO tasks(id,festival_id,title,description,team,stage_id,assignee,priority,due_at,dependencies)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            id,
            v.festivalId,
            v.title,
            v.description,
            v.team,
            v.stageId,
            v.assignee,
            v.priority,
            v.dueAt,
            v.dependencies,
          ],
        );
        return { id };
      }
      case "task.status": {
        requireRole("admin", "stage", "technician", "gate");
        const v = parse(
          z.object({
            id: text,
            status: z.enum(["todo", "doing", "done"]),
            version: z.number().int().positive(),
          }),
          raw,
        );
        const t = await scoped("tasks", v.id);
        if (!["admin", "stage"].includes(a.role) && t.assignee !== a.id)
          fail("Yalnızca kendi görevlerini güncelleyebilirsin.", 403);
        if (t.version !== v.version)
          fail("Görev başka cihazda değişti. Güncelleyip tekrar dene.", 409);
        if (v.status !== "todo" && t.dependencies.length) {
          const deps = await c.query(
            "SELECT id FROM tasks WHERE id=ANY($1::text[]) AND status<>'done'",
            [t.dependencies],
          );
          if (deps.rowCount) fail("Önce bağımlı görevler tamamlanmalı.", 409);
        }
        if (v.status !== "done") {
          const children = await c.query(
            "SELECT id FROM tasks WHERE $1=ANY(dependencies) AND status<>'todo'",
            [t.id],
          );
          if (children.rowCount)
            fail("Bu göreve bağlı, başlamış görevler var.", 409);
        }
        await c.query(
          "UPDATE tasks SET status=$2,version=version+1 WHERE id=$1",
          [v.id, v.status],
        );
        return { id: v.id, status: v.status, version: v.version + 1 };
      }
      case "stage.move": {
        requireRole("admin", "stage");
        const v = parse(
          z.object({
            id: text,
            x: z.number().min(5).max(95),
            y: z.number().min(8).max(90),
          }),
          raw,
        );
        await scoped("stages", v.id);
        await c.query("UPDATE stages SET x=$2,y=$3 WHERE id=$1", [
          v.id,
          Math.round(v.x),
          Math.round(v.y),
        ]);
        return v;
      }
      case "performance.save": {
        requireRole("admin", "stage");
        const v = parse(
          z.object({
            id: text.optional(),
            festivalId: text,
            stageId: text,
            artist: text,
            genre: text,
            startsAt: timestamp,
            endsAt: timestamp,
            version: z.number().int().positive().optional(),
          }),
          raw,
        );
        const festival = await this.festival(a, v.festivalId, c);
        await stage(v.stageId, v.festivalId);
        interval(v.startsAt, v.endsAt);
        if (
          Date.parse(v.startsAt) <
            Date.parse(festival.starts_at + "T00:00:00+03:00") ||
          Date.parse(v.endsAt) >
            Date.parse(festival.ends_at + "T23:59:59+03:00")
        )
          fail("Performans festival tarihleri içinde olmalı.");
        if (v.id) {
          const old = await scoped("performances", v.id);
          if (old.version !== v.version)
            fail("Program değişti. Güncel veriyi yükle.", 409);
          if (old.festival_id !== v.festivalId)
            fail("Festival değiştirilemez.");
        }
        const others = (
          await c.query(
            "SELECT * FROM performances WHERE festival_id=$1 AND id<>$2",
            [v.festivalId, v.id || ""],
          )
        ).rows;
        if (
          others.some(
            (p) =>
              (p.stage_id === v.stageId ||
                p.artist.toLowerCase() === v.artist.toLowerCase()) &&
              overlaps(p.starts_at, p.ends_at, v.startsAt, v.endsAt),
          )
        )
          fail("Sahne veya sanatçı saatlerinde çakışma var.", 409);
        const id = v.id || randomUUID();
        if (v.id)
          await c.query(
            "UPDATE performances SET stage_id=$2,artist=$3,genre=$4,starts_at=$5,ends_at=$6,version=version+1 WHERE id=$1",
            [id, v.stageId, v.artist, v.genre, v.startsAt, v.endsAt],
          );
        else
          await c.query(
            "INSERT INTO performances(id,festival_id,stage_id,artist,genre,starts_at,ends_at)VALUES($1,$2,$3,$4,$5,$6,$7)",
            [
              id,
              v.festivalId,
              v.stageId,
              v.artist,
              v.genre,
              v.startsAt,
              v.endsAt,
            ],
          );
        return { id };
      }
      case "reservation.create": {
        requireRole("admin", "stage", "technician");
        const v = parse(
          z.object({
            equipmentId: text,
            stageId: text,
            quantity: z.number().int().min(1).max(1000),
            startsAt: timestamp,
            endsAt: timestamp,
          }),
          raw,
        );
        const e = await scoped("equipment", v.equipmentId);
        await stage(v.stageId, e.festival_id);
        interval(v.startsAt, v.endsAt);
        const active = (
          await c.query(
            "SELECT * FROM reservations WHERE equipment_id=$1 AND returned=false",
            [e.id],
          )
        ).rows;
        const points = [
          Date.parse(v.startsAt),
          ...active
            .filter((r) =>
              overlaps(r.starts_at, r.ends_at, v.startsAt, v.endsAt),
            )
            .map((r) =>
              Math.max(Date.parse(r.starts_at), Date.parse(v.startsAt)),
            ),
        ];
        const peak = Math.max(
          ...points.map((t) =>
            active
              .filter(
                (r) =>
                  Date.parse(r.starts_at) <= t && t < Date.parse(r.ends_at),
              )
              .reduce((n, r) => n + r.quantity, 0),
          ),
        );
        if (peak + v.quantity > e.quantity)
          fail("Seçilen saatlerde yeterli ekipman yok.", 409);
        const id = randomUUID();
        await c.query(
          "INSERT INTO reservations VALUES($1,$2,$3,$4,$5,$6,false,$7)",
          [
            id,
            v.equipmentId,
            v.stageId,
            v.quantity,
            v.startsAt,
            v.endsAt,
            a.id,
          ],
        );
        return { id };
      }
      case "reservation.return": {
        requireRole("admin", "stage", "technician");
        const v = parse(z.object({ id: text }), raw);
        await scoped("reservations", v.id);
        await c.query("UPDATE reservations SET returned=true WHERE id=$1", [
          v.id,
        ]);
        return { id: v.id, returned: true };
      }
      case "shift.create": {
        requireRole("admin", "stage");
        const v = parse(
          z.object({
            festivalId: text,
            userId: text,
            stageId: text,
            startsAt: timestamp,
            endsAt: timestamp,
          }),
          raw,
        );
        await this.festival(a, v.festivalId, c);
        await stage(v.stageId, v.festivalId);
        interval(v.startsAt, v.endsAt);
        if (
          !(
            await c.query(
              "SELECT id FROM users WHERE id=$1 AND org_id=$2 AND role<>'attendee'",
              [v.userId, a.orgId],
            )
          ).rowCount
        )
          fail("Ekip üyesi bulunamadı.");
        const shifts = (
          await c.query("SELECT * FROM shifts WHERE user_id=$1", [v.userId])
        ).rows;
        if (
          shifts.some((s) =>
            overlaps(s.starts_at, s.ends_at, v.startsAt, v.endsAt),
          )
        )
          fail("Ekip üyesinin vardiyası çakışıyor.", 409);
        const id = randomUUID();
        await c.query("INSERT INTO shifts VALUES($1,$2,$3,$4,$5,$6)", [
          id,
          v.festivalId,
          v.userId,
          v.stageId,
          v.startsAt,
          v.endsAt,
        ]);
        return { id };
      }
      case "incident.create": {
        requireRole("admin", "stage", "technician", "gate");
        const v = parse(
          z.object({
            festivalId: text,
            title: text,
            description: z.string().min(1).max(2000),
            severity: z.enum(["low", "medium", "high"]),
            stageId: text.nullable(),
            photo: z.string().max(700000).nullable().optional(),
          }),
          raw,
        );
        await this.festival(a, v.festivalId, c);
        if (v.stageId) await stage(v.stageId, v.festivalId);
        if (
          v.photo &&
          !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.photo)
        )
          fail("Geçersiz fotoğraf.");
        const id = randomUUID();
        await c.query(
          "INSERT INTO incidents(id,festival_id,title,description,severity,stage_id,created_by,photo)VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            id,
            v.festivalId,
            v.title,
            v.description,
            v.severity,
            v.stageId,
            a.id,
            v.photo || null,
          ],
        );
        return { id };
      }
      case "incident.resolve": {
        requireRole("admin", "stage");
        const v = parse(z.object({ id: text }), raw);
        await scoped("incidents", v.id);
        await c.query("UPDATE incidents SET status='resolved' WHERE id=$1", [
          v.id,
        ]);
        return { id: v.id };
      }
      case "ticket.checkin": {
        requireRole("admin", "gate");
        const v = parse(z.object({ id: text }), raw);
        const ticket = await scoped("tickets", v.id);
        if (ticket.checked_in_at) fail("Bilet daha önce kullanıldı.", 409);
        await c.query(
          "UPDATE tickets SET checked_in_at=now(),checked_in_by=$2 WHERE id=$1",
          [v.id, a.id],
        );
        return { id: v.id, accepted: true };
      }
      case "favorite.toggle": {
        const v = parse(z.object({ id: text }), raw);
        await scoped("performances", v.id);
        const existing = await c.query(
          "DELETE FROM favorites WHERE user_id=$1 AND performance_id=$2 RETURNING performance_id",
          [a.id, v.id],
        );
        if (!existing.rowCount)
          await c.query("INSERT INTO favorites VALUES($1,$2)", [a.id, v.id]);
        return { id: v.id, favorite: !existing.rowCount };
      }
      default:
        fail("İşlem bulunamadı.", 404);
    }
  }
}
