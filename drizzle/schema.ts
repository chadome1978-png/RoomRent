import {
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const rentalRooms = mysqlTable(
  "rental_rooms",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roomNumber: varchar("roomNumber", { length: 40 }).notNull(),
    tenantName: varchar("tenantName", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull().default(""),
    rentAmount: decimal("rentAmount", { precision: 12, scale: 2 }).notNull(),
    waterRate: decimal("waterRate", { precision: 12, scale: 3 }).notNull().default("0"),
    electricRate: decimal("electricRate", { precision: 12, scale: 3 }).notNull().default("0"),
    status: mysqlEnum("status", ["occupied", "vacant", "archived"])
      .notNull()
      .default("occupied"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("rental_rooms_owner_number_unique").on(table.ownerId, table.roomNumber),
    index("rental_rooms_owner_status_idx").on(table.ownerId, table.status),
  ],
);

export const rentalInvoices = mysqlTable(
  "rental_invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roomId: int("roomId")
      .notNull()
      .references(() => rentalRooms.id, { onDelete: "restrict" }),
    roomNumber: varchar("roomNumber", { length: 40 }).notNull().default(""),
    tenantName: varchar("tenantName", { length: 160 }).notNull().default(""),
    phone: varchar("phone", { length: 32 }).notNull().default(""),
    period: varchar("period", { length: 7 }).notNull(),
    dueDate: varchar("dueDate", { length: 10 }).notNull(),
    rentAmount: decimal("rentAmount", { precision: 12, scale: 2 }).notNull(),
    waterPrevious: decimal("waterPrevious", { precision: 12, scale: 3 }).notNull(),
    waterCurrent: decimal("waterCurrent", { precision: 12, scale: 3 }).notNull(),
    waterUnits: decimal("waterUnits", { precision: 12, scale: 3 }).notNull(),
    waterRate: decimal("waterRate", { precision: 12, scale: 3 }).notNull(),
    waterAmount: decimal("waterAmount", { precision: 12, scale: 2 }).notNull(),
    electricPrevious: decimal("electricPrevious", { precision: 12, scale: 3 }).notNull(),
    electricCurrent: decimal("electricCurrent", { precision: 12, scale: 3 }).notNull(),
    electricUnits: decimal("electricUnits", { precision: 12, scale: 3 }).notNull(),
    electricRate: decimal("electricRate", { precision: 12, scale: 3 }).notNull(),
    electricAmount: decimal("electricAmount", { precision: 12, scale: 2 }).notNull(),
    extras: json("extras").$type<Array<{ label: string; amount: number }>>().notNull(),
    totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
    note: varchar("note", { length: 500 }).notNull().default(""),
    status: mysqlEnum("status", ["unpaid", "paid"]).notNull().default("unpaid"),
    issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("rental_invoices_owner_room_period_unique").on(
      table.ownerId,
      table.roomId,
      table.period,
    ),
    index("rental_invoices_owner_period_idx").on(table.ownerId, table.period),
    index("rental_invoices_room_idx").on(table.roomId),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type RentalRoom = typeof rentalRooms.$inferSelect;
export type RentalInvoice = typeof rentalInvoices.$inferSelect;
