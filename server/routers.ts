import { COOKIE_NAME } from "@shared/const";
import { and, asc, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { rentalInvoices, rentalRooms } from "../drizzle/schema";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "กรุณาเลือกรอบบิลให้ถูกต้อง");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "กรุณาระบุวันครบกำหนดให้ถูกต้อง");
const roomFields = {
  roomNumber: z.string().trim().min(1).max(40),
  tenantName: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(32).default(""),
  rentAmount: z.number().finite().min(0).max(999999999),
  waterRate: z.number().finite().min(0).max(999999).default(0),
  electricRate: z.number().finite().min(0).max(999999).default(0),
  status: z.enum(["occupied", "vacant", "archived"]).default("occupied"),
};
const roomInput = z.object(roomFields);
const extraInput = z.array(
  z.object({
    label: z.string().trim().min(1).max(80),
    amount: z.number().finite().min(-99999999).max(99999999),
  }),
).max(8);

function requireDatabase() {
  return getDb().then(db => {
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ฐานข้อมูลยังไม่พร้อมใช้งาน" });
    }
    return db;
  });
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  rentals: router({
    summary: protectedProcedure.input(z.object({ period: periodSchema })).query(async ({ ctx, input }) => {
      const db = await requireDatabase();
      const [rooms, invoices] = await Promise.all([
        db.select().from(rentalRooms).where(eq(rentalRooms.ownerId, ctx.user.id)).orderBy(asc(rentalRooms.roomNumber)),
        db.select().from(rentalInvoices)
          .where(and(eq(rentalInvoices.ownerId, ctx.user.id), eq(rentalInvoices.period, input.period)))
          .orderBy(desc(rentalInvoices.issuedAt)),
      ]);
      const occupied = rooms.filter(room => room.status === "occupied");
      const rentExpected = occupied.reduce((sum, room) => sum + Number(room.rentAmount), 0);
      const billed = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
      const paid = invoices.filter(invoice => invoice.status === "paid")
        .reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
      return {
        roomCount: rooms.filter(room => room.status !== "archived").length,
        occupiedCount: occupied.length,
        vacantCount: rooms.filter(room => room.status === "vacant").length,
        rentExpected: money(rentExpected),
        billed: money(billed),
        paid: money(paid),
        unpaid: money(billed - paid),
        invoiceCount: invoices.length,
        rooms,
        invoices,
      };
    }),
    rooms: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const db = await requireDatabase();
        return db.select().from(rentalRooms)
          .where(eq(rentalRooms.ownerId, ctx.user.id))
          .orderBy(asc(rentalRooms.roomNumber));
      }),
      create: protectedProcedure.input(roomInput).mutation(async ({ ctx, input }) => {
        const db = await requireDatabase();
        if (input.status === "occupied" && !input.tenantName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุชื่อผู้เช่าสำหรับห้องที่มีผู้เช่า" });
        }
        const [duplicate] = await db.select({ id: rentalRooms.id }).from(rentalRooms)
          .where(and(eq(rentalRooms.ownerId, ctx.user.id), eq(rentalRooms.roomNumber, input.roomNumber)))
          .limit(1);
        if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "มีเลขห้องนี้อยู่แล้ว" });
        const result = await db.insert(rentalRooms).values({
          ...input,
          ownerId: ctx.user.id,
          rentAmount: String(money(input.rentAmount)),
          waterRate: String(input.waterRate),
          electricRate: String(input.electricRate),
        });
        return { id: Number(result[0].insertId) };
      }),
      update: protectedProcedure.input(z.object({ id: z.number().int().positive(), ...roomFields })).mutation(async ({ ctx, input }) => {
        const db = await requireDatabase();
        if (input.status === "occupied" && !input.tenantName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุชื่อผู้เช่าสำหรับห้องที่มีผู้เช่า" });
        }
        const [duplicate] = await db.select({ id: rentalRooms.id }).from(rentalRooms)
          .where(and(eq(rentalRooms.ownerId, ctx.user.id), eq(rentalRooms.roomNumber, input.roomNumber)))
          .limit(1);
        if (duplicate && duplicate.id !== input.id) {
          throw new TRPCError({ code: "CONFLICT", message: "มีเลขห้องนี้อยู่แล้ว" });
        }
        const { id, ...values } = input;
        const [ownedRoom] = await db.select({ id: rentalRooms.id }).from(rentalRooms)
          .where(and(eq(rentalRooms.ownerId, ctx.user.id), eq(rentalRooms.id, id)))
          .limit(1);
        if (!ownedRoom) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบห้องนี้" });
        await db.update(rentalRooms).set({
          ...values,
          rentAmount: String(money(values.rentAmount)),
          waterRate: String(values.waterRate),
          electricRate: String(values.electricRate),
        })
          .where(and(eq(rentalRooms.ownerId, ctx.user.id), eq(rentalRooms.id, id)));
        return { success: true };
      }),
      setStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["occupied", "vacant", "archived"]) })).mutation(async ({ ctx, input }) => {
        const db = await requireDatabase();
        const [ownedRoom] = await db.select({ id: rentalRooms.id, tenantName: rentalRooms.tenantName }).from(rentalRooms)
          .where(and(eq(rentalRooms.ownerId, ctx.user.id), eq(rentalRooms.id, input.id)))
          .limit(1);
        if (!ownedRoom) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบห้องนี้" });
        if (input.status === "occupied" && !ownedRoom.tenantName.trim()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาบันทึกชื่อผู้เช่าก่อนเปลี่ยนสถานะห้อง" });
        }
        await db.update(rentalRooms).set({ status: input.status })
          .where(and(eq(rentalRooms.ownerId, ctx.user.id), eq(rentalRooms.id, input.id)));
        return { success: true };
      }),
    }),
    invoices: router({
      list: protectedProcedure.input(z.object({
        roomId: z.number().int().positive().optional(),
        period: periodSchema.optional(),
      }).default({})).query(async ({ ctx, input }) => {
        const db = await requireDatabase();
        const conditions = [eq(rentalInvoices.ownerId, ctx.user.id)];
        if (input.roomId) conditions.push(eq(rentalInvoices.roomId, input.roomId));
        if (input.period) conditions.push(eq(rentalInvoices.period, input.period));
        return db.select({
          id: rentalInvoices.id,
          ownerId: rentalInvoices.ownerId,
          roomId: rentalInvoices.roomId,
          roomNumber: rentalInvoices.roomNumber,
          tenantName: rentalInvoices.tenantName,
          phone: rentalInvoices.phone,
          period: rentalInvoices.period,
          dueDate: rentalInvoices.dueDate,
          rentAmount: rentalInvoices.rentAmount,
          waterPrevious: rentalInvoices.waterPrevious,
          waterCurrent: rentalInvoices.waterCurrent,
          waterUnits: rentalInvoices.waterUnits,
          waterRate: rentalInvoices.waterRate,
          waterAmount: rentalInvoices.waterAmount,
          electricPrevious: rentalInvoices.electricPrevious,
          electricCurrent: rentalInvoices.electricCurrent,
          electricUnits: rentalInvoices.electricUnits,
          electricRate: rentalInvoices.electricRate,
          electricAmount: rentalInvoices.electricAmount,
          extras: rentalInvoices.extras,
          totalAmount: rentalInvoices.totalAmount,
          note: rentalInvoices.note,
          status: rentalInvoices.status,
          issuedAt: rentalInvoices.issuedAt,
        }).from(rentalInvoices)
          .where(and(...conditions))
          .orderBy(desc(rentalInvoices.period), desc(rentalInvoices.issuedAt));
      }),
      create: protectedProcedure.input(z.object({
        roomId: z.number().int().positive(),
        period: periodSchema,
        dueDate: dateSchema,
        waterPrevious: z.number().finite().min(0).max(999999999),
        waterCurrent: z.number().finite().min(0).max(999999999),
        electricPrevious: z.number().finite().min(0).max(999999999),
        electricCurrent: z.number().finite().min(0).max(999999999),
        extras: extraInput,
        note: z.string().trim().max(500).default(""),
      })).mutation(async ({ ctx, input }) => {
        const db = await requireDatabase();
        const [room] = await db.select().from(rentalRooms)
          .where(and(eq(rentalRooms.id, input.roomId), eq(rentalRooms.ownerId, ctx.user.id)))
          .limit(1);
        if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบห้องนี้" });
        if (room.status !== "occupied") throw new TRPCError({ code: "BAD_REQUEST", message: "ออกบิลได้เฉพาะห้องที่มีผู้เช่า" });
        const [existing] = await db.select({ id: rentalInvoices.id }).from(rentalInvoices)
          .where(and(eq(rentalInvoices.ownerId, ctx.user.id), eq(rentalInvoices.roomId, room.id), eq(rentalInvoices.period, input.period)))
          .limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "ห้องนี้มีบิลในรอบดังกล่าวแล้ว" });
        if (input.waterCurrent < input.waterPrevious || input.electricCurrent < input.electricPrevious) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเลขมิเตอร์ก่อนหน้า" });
        }
        const waterUnits = input.waterCurrent - input.waterPrevious;
        const electricUnits = input.electricCurrent - input.electricPrevious;
        const waterRate = Number(room.waterRate);
        const electricRate = Number(room.electricRate);
        const waterAmount = money(waterUnits * waterRate);
        const electricAmount = money(electricUnits * electricRate);
        const extrasAmount = input.extras.reduce((sum, item) => sum + item.amount, 0);
        const totalAmount = money(Number(room.rentAmount) + waterAmount + electricAmount + extrasAmount);
        if (totalAmount < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "ยอดรวมบิลต้องไม่น้อยกว่าศูนย์" });
        try {
          const result = await db.insert(rentalInvoices).values({
            ownerId: ctx.user.id,
            roomId: room.id,
            roomNumber: room.roomNumber,
            tenantName: room.tenantName,
            phone: room.phone,
            period: input.period,
            dueDate: input.dueDate,
            rentAmount: String(money(Number(room.rentAmount))),
            waterPrevious: String(input.waterPrevious),
            waterCurrent: String(input.waterCurrent),
            waterUnits: String(waterUnits),
            waterRate: String(waterRate),
            waterAmount: String(waterAmount),
            electricPrevious: String(input.electricPrevious),
            electricCurrent: String(input.electricCurrent),
            electricUnits: String(electricUnits),
            electricRate: String(electricRate),
            electricAmount: String(electricAmount),
            extras: input.extras.map(item => ({ label: item.label, amount: money(item.amount) })),
            totalAmount: String(totalAmount),
            note: input.note,
          });
          return { id: Number(result[0].insertId), totalAmount };
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
            throw new TRPCError({ code: "CONFLICT", message: "ห้องนี้มีบิลในรอบดังกล่าวแล้ว" });
          }
          throw error;
        }
      }),
      setStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["paid", "unpaid"]) })).mutation(async ({ ctx, input }) => {
        const db = await requireDatabase();
        const [ownedInvoice] = await db.select({ id: rentalInvoices.id }).from(rentalInvoices)
          .where(and(eq(rentalInvoices.ownerId, ctx.user.id), eq(rentalInvoices.id, input.id)))
          .limit(1);
        if (!ownedInvoice) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบบิลนี้" });
        await db.update(rentalInvoices).set({ status: input.status })
          .where(and(eq(rentalInvoices.ownerId, ctx.user.id), eq(rentalInvoices.id, input.id)));
        return { success: true };
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
