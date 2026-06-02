import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, locationsTable, categoriesTable, inventoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.post("/", async (_req, res) => {
  try {
    // Locations
    const [loc1] = await db.insert(locationsTable).values({ name: "MirrorTech - Accra Central", address: "123 High Street, Accra", phone: "+233201234567" }).returning().onConflictDoNothing() as any;
    const [loc2] = await db.insert(locationsTable).values({ name: "MirrorTech - Kumasi Branch", address: "45 Market Circle, Kumasi", phone: "+233244567890" }).returning().onConflictDoNothing() as any;

    const locs = await db.select().from(locationsTable).limit(2);
    const loc1Id = locs[0]?.id;
    const loc2Id = locs[1]?.id ?? locs[0]?.id;

    // Admin user
    const passwordHash = await bcrypt.hash("admin123", 10);
    const pinHash = await bcrypt.hash("1234", 10);
    await db.insert(usersTable).values({ username: "admin", email: "admin@mirrortech.gh", passwordHash, pinHash, role: "admin" }).onConflictDoUpdate({
      target: usersTable.username,
      set: { passwordHash, pinHash, role: "admin", updatedAt: new Date() }
    });
    await db.insert(usersTable).values({ username: "cashier1", email: "cashier1@mirrortech.gh", passwordHash: await bcrypt.hash("cash123", 10), pinHash: await bcrypt.hash("1234", 10), role: "cashier", locationId: loc1Id, station: "Counter 1" }).onConflictDoUpdate({
      target: usersTable.username,
      set: { passwordHash: await bcrypt.hash("cash123", 10), pinHash: await bcrypt.hash("1234", 10), role: "cashier", locationId: loc1Id, station: "Counter 1", updatedAt: new Date() }
    });
    await db.insert(usersTable).values({ username: "cashier2", email: "cashier2@mirrortech.gh", passwordHash: await bcrypt.hash("cash123", 10), pinHash: await bcrypt.hash("4321", 10), role: "cashier", locationId: loc2Id, station: "Counter 2" }).onConflictDoUpdate({
      target: usersTable.username,
      set: { passwordHash: await bcrypt.hash("cash123", 10), pinHash: await bcrypt.hash("4321", 10), role: "cashier", locationId: loc2Id, station: "Counter 2", updatedAt: new Date() }
    });
    await db.insert(usersTable).values({ username: "manager1", email: "manager@mirrortech.gh", passwordHash: await bcrypt.hash("mgr123", 10), pinHash: await bcrypt.hash("5678", 10), role: "manager", locationId: loc1Id }).onConflictDoUpdate({
      target: usersTable.username,
      set: { passwordHash: await bcrypt.hash("mgr123", 10), pinHash: await bcrypt.hash("5678", 10), role: "manager", locationId: loc1Id, updatedAt: new Date() }
    });
    // Wholesale customers
    await db.insert(usersTable).values({ username: "Acme Trading", email: "acme@example.com", passwordHash: await bcrypt.hash("wholesale1", 10), pinHash: await bcrypt.hash("0000", 10), role: "customer", customerType: "wholesale", wholesaleTier: 1, locationId: loc1Id }).onConflictDoUpdate({
      target: usersTable.username,
      set: { passwordHash: await bcrypt.hash("wholesale1", 10), pinHash: await bcrypt.hash("0000", 10), role: "customer", customerType: "wholesale", wholesaleTier: 1, locationId: loc1Id, updatedAt: new Date() }
    });
    await db.insert(usersTable).values({ username: "Global Mart", email: "global@example.com", passwordHash: await bcrypt.hash("wholesale2", 10), pinHash: await bcrypt.hash("0000", 10), role: "customer", customerType: "wholesale", wholesaleTier: 2, locationId: loc1Id }).onConflictDoUpdate({
      target: usersTable.username,
      set: { passwordHash: await bcrypt.hash("wholesale2", 10), pinHash: await bcrypt.hash("0000", 10), role: "customer", customerType: "wholesale", wholesaleTier: 2, locationId: loc1Id, updatedAt: new Date() }
    });

    // Categories
    const [catElec] = await db.insert(categoriesTable).values({ name: "Electronics", description: "Electronic devices and accessories" }).returning().onConflictDoNothing() as any;
    const [catFashion] = await db.insert(categoriesTable).values({ name: "Fashion & Clothing", description: "Apparel and accessories" }).returning().onConflictDoNothing() as any;
    const [catFood] = await db.insert(categoriesTable).values({ name: "Food & Beverages", description: "Consumables" }).returning().onConflictDoNothing() as any;
    const [catHome] = await db.insert(categoriesTable).values({ name: "Home & Living", description: "Household items" }).returning().onConflictDoNothing() as any;

    const cats = await db.select().from(categoriesTable).limit(4);
    const catIds = cats.map(c => c.id);

    // Inventory
    if (loc1Id) {
      await db.insert(inventoryTable).values([
        { name: "Samsung Galaxy A55", sku: "SAM-A55-001", price: "1850.00", cost: "1500.00", wholesalePrice1: "1650.00", wholesalePrice2: "1550.00", quantity: 25, minQuantity: 5, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "iPhone 15 Case", sku: "IPH-CASE-002", price: "45.00", cost: "20.00", wholesalePrice1: "35.00", wholesalePrice2: "30.00", quantity: 100, minQuantity: 20, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Wireless Earbuds", sku: "EAR-WL-003", price: "180.00", cost: "90.00", wholesalePrice1: "150.00", wholesalePrice2: "135.00", quantity: 40, minQuantity: 10, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Men's Polo Shirt", sku: "POL-M-004", price: "75.00", cost: "35.00", wholesalePrice1: "60.00", wholesalePrice2: "55.00", quantity: 60, minQuantity: 10, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Ladies Handbag", sku: "BAG-L-005", price: "120.00", cost: "60.00", wholesalePrice1: "100.00", wholesalePrice2: "90.00", quantity: 30, minQuantity: 5, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Malta Drink 330ml", sku: "MALT-330-006", price: "4.50", cost: "2.50", wholesalePrice1: "3.50", quantity: 3, minQuantity: 48, locationId: loc1Id, categoryId: catIds[2], unit: "can" },
        { name: "Bottled Water 500ml", sku: "WAT-500-007", price: "2.00", cost: "0.80", wholesalePrice1: "1.50", quantity: 200, minQuantity: 50, locationId: loc1Id, categoryId: catIds[2], unit: "bottle" },
        { name: "Rice (5kg)", sku: "RICE-5KG-008", price: "55.00", cost: "40.00", wholesalePrice1: "48.00", wholesalePrice2: "45.00", quantity: 80, minQuantity: 20, locationId: loc1Id, categoryId: catIds[2], unit: "bag" },
        { name: "Electric Kettle", sku: "KTL-EL-009", price: "95.00", cost: "55.00", wholesalePrice1: "80.00", wholesalePrice2: "75.00", quantity: 15, minQuantity: 3, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
        { name: "Ceiling Fan 52\"", sku: "FAN-52-010", price: "280.00", cost: "180.00", wholesalePrice1: "250.00", wholesalePrice2: "230.00", quantity: 8, minQuantity: 2, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
      ]).onConflictDoUpdate({
        target: inventoryTable.sku,
        set: { updatedAt: new Date() }
      });

      // Update wholesale prices for existing items
      for (const item of [
        { sku: "SAM-A55-001", wholesalePrice1: "1650.00", wholesalePrice2: "1550.00" },
        { sku: "IPH-CASE-002", wholesalePrice1: "35.00", wholesalePrice2: "30.00" },
        { sku: "EAR-WL-003", wholesalePrice1: "150.00", wholesalePrice2: "135.00" },
        { sku: "POL-M-004", wholesalePrice1: "60.00", wholesalePrice2: "55.00" },
        { sku: "BAG-L-005", wholesalePrice1: "100.00", wholesalePrice2: "90.00" },
        { sku: "MALT-330-006", wholesalePrice1: "3.50", wholesalePrice2: null },
        { sku: "WAT-500-007", wholesalePrice1: "1.50", wholesalePrice2: null },
        { sku: "RICE-5KG-008", wholesalePrice1: "48.00", wholesalePrice2: "45.00" },
        { sku: "KTL-EL-009", wholesalePrice1: "80.00", wholesalePrice2: "75.00" },
        { sku: "FAN-52-010", wholesalePrice1: "250.00", wholesalePrice2: "230.00" },
      ]) {
        await db.update(inventoryTable).set({
          wholesalePrice1: item.wholesalePrice1,
          wholesalePrice2: item.wholesalePrice2,
        }).where(eq(inventoryTable.sku, item.sku));
      }
    }

    logger.info("Seed data created");
    res.json({ status: "seeded" });
  } catch (err) {
    logger.error({ err }, "Seed failed");
    res.status(500).json({ status: "error", error: String(err) });
  }
});

export default router;
