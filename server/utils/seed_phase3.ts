/**
 * Phase 3 Seed Script
 */

import "dotenv/config";
import { nanoid } from "nanoid";
import bcryptjs from "bcryptjs";
import { getDb } from "../db.js";
import {
  users,
  marketers,
  cafeterias,
  cafeteriaStaff,
  sections,
  cafeteriaTables,
  menuCategories,
  menuItems,
  cafeteriaMarketerRelationships,
} from "../../drizzle/schema.js";
import { eq, and, or } from "drizzle-orm";

const SALT_ROUNDS = 10;
const COMMON_PASSWORD = "password123";

async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

const OWNER = {
  email: "owner@phase3.com",
  name: "Phase3 Owner",
  role: "owner" as const,
};

const MARKETER = {
  email: "marketer1@cafeteria.com",
  name: "Phase3 Marketer",
  loginUsername: "marketer1@cafeteria.com",
  referenceCode: "1001",
};

const CAFETERIAS_DATA = [
  {
    name: "Cafeteria One",
    loginUsername: "admin1@cafeteria1.com",
    adminEmail: "admin1@cafeteria1.com",
    adminName: "Admin Cafeteria 1",
    referenceCode: "1001P01",
    location: "Building A, Floor 1",
  },
  {
    name: "Cafeteria Two",
    loginUsername: "admin2@cafeteria2.com",
    adminEmail: "admin2@cafeteria2.com",
    adminName: "Admin Cafeteria 2",
    referenceCode: "1001P02",
    location: "Building B, Floor 2",
  },
];

const STAFF_PER_CAFETERIA = [
  { username: "manager1_c{n}@test.com", name: "Manager 1 C{n}", role: "manager" as const, refSuffix: "M01" },
  { username: "waiter2_c{n}@test.com", name: "Waiter 2 C{n}", role: "waiter" as const, refSuffix: "W01" },
  { username: "waiter3_c{n}@test.com", name: "Waiter 3 C{n}", role: "waiter" as const, refSuffix: "W02" },
  { username: "chef4_c{n}@test.com", name: "Chef 4 C{n}", role: "chef" as const, refSuffix: "K01" },
  { username: "chef5_c{n}@test.com", name: "Chef 5 C{n}", role: "chef" as const, refSuffix: "K02" },
];

const SECTIONS_DATA = ["Main Hall C{n}", "Outdoor Terrace C{n}"];

const MENU_DATA = [
  { category: "Hot Drinks C{n}", items: ["Item Alpha", "Item Beta", "Item Gamma", "Item Delta"] },
  { category: "Cold Drinks C{n}", items: ["Item Alpha", "Item Beta", "Item Gamma", "Item Delta"] },
  { category: "Main Course C{n}", items: ["Item Alpha", "Item Beta", "Item Gamma", "Item Delta"] },
  { category: "Sandwiches C{n}", items: ["Item Alpha", "Item Beta", "Item Gamma", "Item Delta"] },
  { category: "Desserts C{n}", items: ["Item Alpha", "Item Beta", "Item Gamma", "Item Delta"] },
];

async function seedPhase3() {
  const db = await getDb();
  if (!db) process.exit(1);

  console.log("🌱 Starting Phase 3 seed...");
  const passwordHash = await hashPassword(COMMON_PASSWORD);

  // 1. Owner
  const existingOwner = await db.select().from(users).where(eq(users.email, OWNER.email));
  if (existingOwner.length === 0) {
    await db.insert(users).values({
      id: nanoid(),
      name: OWNER.name,
      email: OWNER.email,
      loginUsername: OWNER.email,
      passwordHash,
      role: OWNER.role,
      status: "active",
      createdAt: new Date(),
    });
  }

  // 2. Marketer
  const existingMarketer = await db.select().from(marketers).where(eq(marketers.referenceCode, MARKETER.referenceCode));
  let marketerId: string;
  if (existingMarketer.length === 0) {
    marketerId = nanoid();
    await db.insert(marketers).values({
      id: marketerId,
      name: MARKETER.name,
      email: MARKETER.email,
      loginUsername: MARKETER.loginUsername,
      passwordHash,
      referenceCode: MARKETER.referenceCode,
      status: "active",
      createdAt: new Date(),
    });
  } else {
    marketerId = existingMarketer[0].id;
    await db.update(marketers).set({ email: MARKETER.email, loginUsername: MARKETER.loginUsername }).where(eq(marketers.id, marketerId));
  }

  // 3. Cafeterias
  const cafeteriaIds: string[] = [];
  for (const cafeData of CAFETERIAS_DATA) {
    const existingCafe = await db.select().from(cafeterias).where(eq(cafeterias.referenceCode, cafeData.referenceCode));
    let cafeteriaId: string;
    if (existingCafe.length === 0) {
      cafeteriaId = nanoid();
      await db.insert(cafeterias).values({
        id: cafeteriaId,
        marketerId,
        name: cafeData.name,
        loginUsername: cafeData.loginUsername,
        passwordHash,
        referenceCode: cafeData.referenceCode,
        status: "active",
        createdAt: new Date(),
      });
    } else {
      cafeteriaId = existingCafe[0].id;
    }
    cafeteriaIds.push(cafeteriaId);

    // Link Marketer
    const existingRel = await db.select().from(cafeteriaMarketerRelationships).where(and(eq(cafeteriaMarketerRelationships.cafeteriaId, cafeteriaId), eq(cafeteriaMarketerRelationships.marketerId, marketerId)));
    if (existingRel.length === 0) {
      await db.insert(cafeteriaMarketerRelationships).values({ id: nanoid(), cafeteriaId, marketerId, status: "active", createdAt: new Date() });
    }

    // Admin
    const existingAdmin = await db.select().from(users).where(eq(users.email, cafeData.adminEmail));
    if (existingAdmin.length === 0) {
      await db.insert(users).values({
        id: nanoid(),
        cafeteriaId,
        name: cafeData.adminName,
        email: cafeData.adminEmail,
        loginUsername: cafeData.adminEmail,
        passwordHash,
        role: "cafeteria_admin",
        status: "active",
        createdAt: new Date(),
      });
    }
  }

  // 4. Staff
  for (let i = 0; i < cafeteriaIds.length; i++) {
    const cafeteriaId = cafeteriaIds[i];
    const cafeRows = await db.select().from(cafeterias).where(eq(cafeterias.id, cafeteriaId));
    const cafeRefCode = cafeRows[0].referenceCode;
    for (const staffDef of STAFF_PER_CAFETERIA) {
      const username = staffDef.username.replace(/{n}/g, String(i + 1));
      const refCode = `${cafeRefCode}${staffDef.refSuffix}`;
      const existingStaff = await db.select().from(cafeteriaStaff).where(eq(cafeteriaStaff.loginUsername, username));
      if (existingStaff.length === 0) {
        await db.insert(cafeteriaStaff).values({
          id: nanoid(),
          cafeteriaId,
          name: staffDef.name.replace(/{n}/g, String(i + 1)),
          loginUsername: username,
          passwordHash,
          role: staffDef.role,
          status: "active",
          canLogin: true,
          referenceCode: refCode,
          createdAt: new Date(),
        });
      }
    }
  }

  // 5. Sections & Tables
  for (let i = 0; i < cafeteriaIds.length; i++) {
    const cafeteriaId = cafeteriaIds[i];
    const cafeSecs: string[] = [];
    for (const secName of SECTIONS_DATA) {
      const name = secName.replace(/{n}/g, String(i + 1));
      const existingSec = await db.select().from(sections).where(and(eq(sections.cafeteriaId, cafeteriaId), eq(sections.name, name)));
      let secId: string;
      if (existingSec.length === 0) {
        secId = nanoid();
        await db.insert(sections).values({ id: secId, cafeteriaId, name, status: "active", createdAt: new Date() });
      } else {
        secId = existingSec[0].id;
      }
      cafeSecs.push(secId);
    }

    // AGGRESSIVE CLEANUP: Delete all tables with tableNumber 0 OR > 6 OR duplicates
    const existingTables = await db.select().from(cafeteriaTables).where(eq(cafeteriaTables.cafeteriaId, cafeteriaId));
    const keptTableNumbers = new Set();
    for (const table of existingTables) {
      if (table.tableNumber === 0 || table.tableNumber > 6 || keptTableNumbers.has(table.tableNumber)) {
        await db.delete(cafeteriaTables).where(eq(cafeteriaTables.id, table.id));
      } else {
        keptTableNumbers.add(table.tableNumber);
      }
    }

    for (let s = 0; s < cafeSecs.length; s++) {
      for (let t = 1; t <= 3; t++) {
        const tableNum = s * 3 + t;
        const existingTable = await db.select().from(cafeteriaTables).where(and(eq(cafeteriaTables.cafeteriaId, cafeteriaId), eq(cafeteriaTables.tableNumber, tableNum)));
        if (existingTable.length === 0) {
          await db.insert(cafeteriaTables).values({
            id: nanoid(),
            cafeteriaId,
            sectionId: cafeSecs[s],
            tableNumber: tableNum,
            capacity: 4,
            status: "free",
            qrCode: `QR-${cafeteriaId}-T${tableNum}`,
            createdAt: new Date(),
          });
        }
      }
    }
  }

  // 6. Menu
  for (let i = 0; i < cafeteriaIds.length; i++) {
    const cafeteriaId = cafeteriaIds[i];
    for (const menuDef of MENU_DATA) {
      const catName = menuDef.category.replace(/{n}/g, String(i + 1));
      const existingCat = await db.select().from(menuCategories).where(and(eq(menuCategories.cafeteriaId, cafeteriaId), eq(menuCategories.name, catName)));
      let categoryId: string;
      if (existingCat.length === 0) {
        categoryId = nanoid();
        await db.insert(menuCategories).values({ id: categoryId, cafeteriaId, name: catName, status: "active", createdAt: new Date() });
      } else {
        categoryId = existingCat[0].id;
      }
      for (const itemName of menuDef.items) {
        const fullItemName = `${itemName} - ${catName}`;
        const existingItem = await db.select().from(menuItems).where(and(eq(menuItems.categoryId, categoryId), eq(menuItems.name, fullItemName)));
        if (existingItem.length === 0) {
          await db.insert(menuItems).values({ id: nanoid(), categoryId, name: fullItemName, price: "10.00", status: "active", createdAt: new Date() });
        }
      }
    }
  }
  console.log("🎉 Phase 3 seed completed successfully!");
}

seedPhase3().catch(err => {
  console.error(err);
  process.exit(1);
});
