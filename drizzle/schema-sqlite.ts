import {
  sqliteTable,
  text,
  integer,
  real,
  numeric,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// Helper for boolean in SQLite (0 or 1)
const boolean = (name: string) => integer(name, { mode: 'boolean' });

// ============================================================================
// 1. USERS TABLE
// ============================================================================
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginUsername: text("loginUsername").unique(),
  passwordHash: text("passwordHash"),
  loginMethod: text("loginMethod").default("email"),
  role: text("role").default("cafeteria_admin").notNull(),
  preferredLanguage: text("preferred_language").default("en"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  cafeteriaId: text("cafeteriaId"),
  referenceCode: text("referenceCode"),
  marketerId: text("marketerId"),
});

// ============================================================================
// 2. MARKETERS TABLE
// ============================================================================
export const marketers = sqliteTable("marketers", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  email: text("email"),
  loginUsername: text("loginUsername").unique(),
  passwordHash: text("passwordHash"),
  parentId: text("parentId"),
  referenceCode: text("referenceCode").unique(),
  isAdminFrozen: boolean("isAdminFrozen").default(false),
  status: text("status").default("active"),
  country: text("country"),
  currency: text("currency"),
  currencyOverrideBy: text("currencyOverrideBy"),
  language: text("language").default("en"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================================================
// 3. CAFETERIAS TABLE
// ============================================================================
export const cafeterias = sqliteTable("cafeterias", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  marketerId: text("marketerId").notNull(),
  name: text("name").notNull(),
  location: text("location"),
  loginUsername: text("loginUsername").unique(),
  passwordHash: text("passwordHash"),
  pointsBalance: text("pointsBalance").default("0"),
  graceMode: boolean("graceMode").default(false),
  referenceCode: text("referenceCode").unique(),
  country: text("country"),
  currency: text("currency"),
  currencyOverrideBy: text("currencyOverrideBy"),
  language: text("language").default("en"),
  freeOperationEndDate: integer("freeOperationEndDate", { mode: 'timestamp' }),
  subscriptionPlan: text("subscriptionPlan").default("starter"),
  subscriptionStatus: text("subscriptionStatus").default("active"),
  phone: text("phone"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  taxRate: text("tax_rate").default("0.00"),
  serviceCharge: text("service_charge").default("0.00"),
  autoLogoutMinutes: integer("auto_logout_minutes").default(120),
  isAdminFrozen: boolean("isAdminFrozen").default(false),
  status: text("status").default("active"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================================================
// 5. RECHARGE REQUESTS TABLE
// ============================================================================
export const rechargeRequests = sqliteTable("rechargeRequests", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  cafeteriaId: text("cafeteriaId").notNull(),
  amount: text("amount").notNull(),
  imageUrl: text("imageUrl"),
  status: text("status").default("pending"),
  processedAt: integer("processedAt", { mode: 'timestamp' }),
  processedBy: text("processedBy"),
  notes: text("notes"),
  paymentMethod: text("payment_method"),
  commissionCalculated: boolean("commissionCalculated").default(false),
  commissionDistributionId: text("commissionDistributionId"),
  pointsAddedToBalance: text("pointsAddedToBalance").default("0"),
  paidAmount: text("paidAmount"),
  paidCurrency: text("paidCurrency"),
  exchangeRateToUsd: text("exchangeRateToUsd"),
  pointsMultiplier: text("pointsMultiplier"),
  country: text("country"),
  currency: text("currency"),
  language: text("language"),
  attachmentUrls: text("attachmentUrls"), // Store as JSON string
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================================================
// 10. MENU CATEGORIES TABLE
// ============================================================================
export const menuCategories = sqliteTable("menuCategories", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  cafeteriaId: text("cafeteriaId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("displayOrder").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================================================
// 11. MENU ITEMS TABLE
// ============================================================================
export const menuItems = sqliteTable("menuItems", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  categoryId: text("categoryId").notNull(),
  cafeteriaId: text("cafeteriaId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: text("price").notNull(),
  imageUrl: text("imageUrl"),
  isAvailable: boolean("isAvailable").default(true),
  displayOrder: integer("displayOrder").default(0),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================================================
// 12. ORDERS TABLE
// ============================================================================
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  cafeteriaId: text("cafeteriaId").notNull(),
  tableId: text("tableId"),
  waiterId: text("waiterId"),
  status: text("status").default("pending").notNull(),
  totalAmount: text("totalAmount").notNull(),
  pointsDeducted: text("pointsDeducted").default("0"),
  paidAt: integer("paidAt", { mode: 'timestamp' }),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================================================
// 13. ORDER ITEMS TABLE
// ============================================================================
export const orderItems = sqliteTable("orderItems", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  orderId: text("orderId").notNull(),
  menuItemId: text("menuItemId").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: text("unitPrice").notNull(),
  totalPrice: text("totalPrice").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================================================
// 15. CAFETERIA TABLES
// ============================================================================
export const cafeteriaTables = sqliteTable("cafeteriaTables", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  cafeteriaId: text("cafeteriaId").notNull(),
  sectionId: text("sectionId"),
  name: text("name").notNull(),
  referenceCode: text("referenceCode").unique(),
  status: text("status").default("free"),
  capacity: integer("capacity").default(4),
  qrCodeUrl: text("qrCodeUrl"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================================================
// 16. CAFETERIA STAFF TABLE
// ============================================================================
export const cafeteriaStaff = sqliteTable("cafeteriaStaff", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  cafeteriaId: text("cafeteriaId").notNull(),
  userId: text("userId"),
  name: text("name").notNull(),
  email: text("email"),
  loginUsername: text("loginUsername").unique(),
  passwordHash: text("passwordHash"),
  role: text("role").notNull(),
  referenceCode: text("referenceCode").unique(),
  status: text("status").default("active"),
  canLogin: boolean("canLogin").default(true),
  loginPermissionGrantedAt: integer("loginPermissionGrantedAt", { mode: 'timestamp' }),
  loginPermissionGrantedBy: text("loginPermissionGrantedBy"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Add other tables as needed for testing...
// For now, these are the core ones for the scenarios.

export const sections = sqliteTable("sections", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  cafeteriaId: text("cafeteriaId").notNull(),
  name: text("name").notNull(),
  displayOrder: integer("displayOrder").default(0),
});

export const ledgerEntries = sqliteTable("ledgerEntries", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  entityId: text("entityId").notNull(),
  entityType: text("entityType").notNull(),
  type: text("type").notNull(),
  amount: text("amount").notNull(),
  description: text("description"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const marketerBalances = sqliteTable("marketerBalances", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  marketerId: text("marketerId").notNull().unique(),
  pendingBalance: text("pendingBalance").default("0"),
  availableBalance: text("availableBalance").default("0"),
  totalWithdrawn: text("totalWithdrawn").default("0"),
  lastUpdated: integer("lastUpdated", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const commissionDistributions = sqliteTable("commissionDistributions", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  rechargeRequestId: text("rechargeRequestId").notNull(),
  marketerId: text("marketerId").notNull(),
  commissionAmount: text("commissionAmount").notNull(),
  status: text("status").default("pending"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const withdrawalRequests = sqliteTable("withdrawalRequests", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  marketerId: text("marketerId").notNull(),
  amount: text("amount").notNull(),
  status: text("status").default("pending"),
  requestedAt: integer("requestedAt", { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const systemConfigs = sqliteTable("systemConfigs", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const staffSectionAssignments = sqliteTable("staffSectionAssignments", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  staffId: text("staffId").notNull(),
  sectionId: text("sectionId").notNull(),
});

export const staffCategoryAssignments = sqliteTable("staffCategoryAssignments", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  staffId: text("staffId").notNull(),
  categoryId: text("categoryId").notNull(),
});
