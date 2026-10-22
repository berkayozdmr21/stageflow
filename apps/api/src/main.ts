import "reflect-metadata";
import QRCode from "qrcode";
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Module,
  Inject,
  UseGuards,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ValidationPipe,
  HttpException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import {
  SwaggerModule,
  DocumentBuilder,
  ApiTags,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { Pool } from "pg";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { Server } from "socket.io";
import { Domain, Actor, parse, text, fail } from "./domain";
import { seed } from "./seed";
import { z } from "zod";
import type { Request, Response } from "express";
function projectRoot() {
  let dir = __dirname;
  for (let i = 0; i < 9; i++) {
    const file = resolve(dir, "package.json");
    if (
      existsSync(file) &&
      JSON.parse(readFileSync(file, "utf8")).name === "stageflow"
    )
      return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Stageflow project root not found");
}
const root = projectRoot();
mkdirSync(resolve(root, ".runtime"), { recursive: true });
const secretFile = resolve(root, ".runtime/jwt.key");
if (!existsSync(secretFile))
  writeFileSync(secretFile, randomBytes(48).toString("hex"));
const secret = process.env.JWT_SECRET || readFileSync(secretFile, "utf8");
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
  throw Error("JWT_SECRET required in production");
const origins = (
  process.env.CORS_ORIGINS ||
  "http://127.0.0.1:9148,http://localhost:9148,http://127.0.0.1:9150,http://localhost:9150"
).split(",");
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://stageflow@127.0.0.1:55452/stageflow",
  max: 12,
});
const domain = new Domain(pool);
function cookie(header: string | undefined) {
  return header
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("sf_session="))
    ?.slice(11);
}
@Injectable()
class AuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private jwt: JwtService) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (req.path === "/api/health" || req.path === "/api/login") return true;
    try {
      const raw =
        req.headers.authorization?.replace(/^Bearer /, "") ||
        cookie(req.headers.cookie);
      const actor = this.jwt.verify(raw);
      if (actor.purpose !== "access") throw Error();
      req.actor = actor;
      return true;
    } catch {
      throw new UnauthorizedException("Oturumun sona erdi. Tekrar giriş yap.");
    }
  }
}
const attempts = new Map<string, { count: number; start: number }>();
@ApiTags("Stageflow")
@ApiBearerAuth()
@Controller("api")
@UseGuards(AuthGuard)
class Api {
  constructor(@Inject(JwtService) private jwt: JwtService) {}
  @Get("health") async health() {
    await pool.query("SELECT 1");
    return { status: "ok", database: "postgresql", version: "0.1.0" };
  }
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", example: "admin@stageflow.local" },
        password: { type: "string", example: "Stageflow2026!" },
      },
    },
  })
  @Post("login")
  async login(
    @Body() raw: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const v = parse(
      z.object({ email: z.email(), password: z.string().min(1).max(200) }),
      raw,
    );
    const ip = req.ip || "local";
    const current = attempts.get(ip);
    if (current && Date.now() - current.start < 60000) {
      if (current.count++ >= 20)
        fail("Çok fazla deneme. Bir dakika sonra tekrar dene.", 429);
    } else {
      if (attempts.size > 2000) attempts.clear();
      attempts.set(ip, { count: 1, start: Date.now() });
    }
    const user = await domain.login(v.email, v.password);
    const token = this.jwt.sign(
      { ...user, purpose: "access" },
      { expiresIn: "8h" },
    );
    res.cookie("sf_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE
        ? process.env.COOKIE_SECURE === "true"
        : process.env.NODE_ENV === "production",
      maxAge: 8 * 3600000,
      path: "/",
    });
    return { user, token };
  }
  @Post("logout") logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("sf_session", { path: "/" });
    return { ok: true };
  }
  @Get("me") me(@Req() req: any) {
    const { iat, exp, purpose, ...user } = req.actor;
    return { user };
  }
  @Get("snapshot") async snapshot(@Req() req: any) {
    const id = req.query.festivalId || "northline-26";
    const data = await domain.snapshot(req.actor, id);
    if (req.actor.role === "attendee") {
      for (const t of data.tickets) {
        t.qr = this.jwt.sign(
          { purpose: "entry", ticketId: t.id, festivalId: id },
          { expiresIn: "30d" },
        );
        t.qrSvg = await QRCode.toString(t.qr, {
          type: "svg",
          width: 230,
          margin: 2,
        });
      }
    }
    return data;
  }
  @ApiBody({
    schema: {
      type: "object",
      required: ["action", "input", "mutationId"],
      properties: {
        action: { type: "string", example: "task.status" },
        input: {
          type: "object",
          additionalProperties: true,
          example: { id: "t1", status: "done", version: 1 },
        },
        mutationId: {
          type: "string",
          example: "0f8746a1-5a12-4dbd-a883-923db99be610",
        },
      },
    },
  })
  @Post("actions")
  async action(@Req() req: any, @Body() raw: unknown) {
    const v = parse(
      z.object({
        action: text,
        input: z.unknown(),
        mutationId: z.string().min(8).max(80),
      }),
      raw,
    );
    let input = v.input;
    if (v.action === "ticket.checkin") {
      const qr = parse(z.object({ qr: z.string().min(1).max(4000) }), v.input);
      try {
        const verified = this.jwt.verify(qr.qr);
        if (verified.purpose !== "entry") throw Error();
        input = { id: verified.ticketId };
      } catch {
        fail("Bilet imzası geçersiz veya süresi dolmuş.", 400);
      }
    }
    return domain.mutate(req.actor, v.action, input, v.mutationId);
  }
}
@Module({
  imports: [JwtModule.register({ secret })],
  controllers: [Api],
  providers: [AuthGuard],
})
class AppModule {}
async function bootstrap() {
  await pool.query(
    readFileSync(resolve(root, "apps/api/src/schema.sql"), "utf8"),
  );
  if (
    process.env.SEED_DEMO === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO !== "false")
  )
    await seed(pool);
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const express = await import("express");
  app.use(express.json({ limit: "1mb" }));
  app.enableCors({ origin: origins, credentials: true });
  app.use((req: any, res: any, next: any) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      req.headers.origin &&
      !origins.includes(req.headers.origin)
    )
      return res
        .status(403)
        .json({ message: "İstek kaynağı kabul edilmiyor." });
    next();
  });
  const io = new Server(app.getHttpServer(), {
    cors: { origin: origins, credentials: true },
    maxHttpBufferSize: 10000,
  });
  const jwt = app.get(JwtService);
  io.use((socket, next) => {
    try {
      const actor = jwt.verify(
        socket.handshake.auth.token || cookie(socket.handshake.headers.cookie),
      );
      if (actor.purpose !== "access") throw Error();
      socket.data.actor = actor;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    socket.join(socket.data.actor.orgId);
    const remaining = Math.max(0, socket.data.actor.exp * 1000 - Date.now());
    const timer = setTimeout(() => socket.disconnect(true), remaining);
    socket.on("disconnect", () => clearTimeout(timer));
  });
  domain.publish = (org) =>
    io.to(org).emit("refresh", { at: new Date().toISOString() });
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Stageflow Operations API")
        .setDescription(
          "Tenant-scoped operations, optimistic concurrency and idempotent mutations.",
        )
        .setVersion("0.1.0")
        .addBearerAuth()
        .build(),
    ),
  );
  await app.listen(
    Number(process.env.API_PORT || 9149),
    process.env.API_HOST || "127.0.0.1",
  );
  console.log("Stageflow API http://127.0.0.1:9149/api/health");
}
bootstrap().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
