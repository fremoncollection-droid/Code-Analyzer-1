import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, locationsTable, categoriesTable, shelvesTable, inventoryTable } from "@workspace/db";
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
    await db.insert(categoriesTable).values([
      { name: "Women's Wear", color: "#EC4899", description: "Ladies clothing, dresses, tops & skirts" },
      { name: "Men's Wear", color: "#3B82F6", description: "Gents clothing, shirts, trousers & suits" },
      { name: "Kids Wear", color: "#F59E0B", description: "Children's clothing for boys and girls" },
      { name: "Accessories", color: "#8B5CF6", description: "Bags, belts, scarves & fashion accessories" },
    ]).onConflictDoNothing();

    const cats = await db.select().from(categoriesTable).limit(4);
    const catIds = cats.map(c => c.id);

    // Shelves
    await db.insert(shelvesTable).values({ name: "W1", zone: "Women's Section", capacity: 80 }).returning().onConflictDoNothing();
    await db.insert(shelvesTable).values({ name: "W2", zone: "Women's Section", capacity: 80 }).returning().onConflictDoNothing();
    await db.insert(shelvesTable).values({ name: "M1", zone: "Men's Section", capacity: 80 }).returning().onConflictDoNothing();
    await db.insert(shelvesTable).values({ name: "K1", zone: "Kids Section", capacity: 60 }).returning().onConflictDoNothing();
    await db.insert(shelvesTable).values({ name: "A1", zone: "Accessories Display", capacity: 40 }).returning().onConflictDoNothing();

    // Inventory — Women's Wear
    if (loc1Id) {
      await db.insert(inventoryTable).values([
        { name: "Women's Evening Gown", sku: "WW-GOW-001", price: "380.00", cost: "180.00", wholesalePrice1: "310.00", wholesalePrice2: "280.00", quantity: 20, minQuantity: 4, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Ladies Floral Midi Dress", sku: "WW-FLO-002", price: "165.00", cost: "75.00", wholesalePrice1: "135.00", wholesalePrice2: "120.00", quantity: 35, minQuantity: 8, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Women's Palazzo Pants", sku: "WW-PAL-003", price: "110.00", cost: "50.00", wholesalePrice1: "88.00", wholesalePrice2: "80.00", quantity: 45, minQuantity: 10, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Ladies Office Blouse", sku: "WW-BLO-004", price: "85.00", cost: "38.00", wholesalePrice1: "68.00", wholesalePrice2: "62.00", quantity: 50, minQuantity: 10, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Women's Ankara Skirt Set", sku: "WW-ANK-005", price: "220.00", cost: "100.00", wholesalePrice1: "178.00", wholesalePrice2: "165.00", quantity: 30, minQuantity: 6, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        { name: "Ladies Casual T-Shirt", sku: "WW-TEE-006", price: "55.00", cost: "22.00", wholesalePrice1: "42.00", wholesalePrice2: "38.00", quantity: 80, minQuantity: 15, locationId: loc1Id, categoryId: catIds[0], unit: "piece" },
        // Men's Wear
        { name: "Men's Slim Fit Suit", sku: "MW-SUT-007", price: "650.00", cost: "320.00", wholesalePrice1: "530.00", wholesalePrice2: "490.00", quantity: 15, minQuantity: 3, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Men's Polo Shirt", sku: "MW-POL-008", price: "95.00", cost: "42.00", wholesalePrice1: "75.00", wholesalePrice2: "68.00", quantity: 60, minQuantity: 12, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Men's Chinos Trousers", sku: "MW-CHN-009", price: "130.00", cost: "58.00", wholesalePrice1: "105.00", wholesalePrice2: "95.00", quantity: 50, minQuantity: 10, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Men's Kaftan (Embroidered)", sku: "MW-KAF-010", price: "185.00", cost: "85.00", wholesalePrice1: "148.00", wholesalePrice2: "138.00", quantity: 25, minQuantity: 5, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        { name: "Men's Casual Linen Shirt", sku: "MW-LIN-011", price: "115.00", cost: "50.00", wholesalePrice1: "92.00", wholesalePrice2: "84.00", quantity: 45, minQuantity: 8, locationId: loc1Id, categoryId: catIds[1], unit: "piece" },
        // Kids Wear
        { name: "Girls' Sunday Dress", sku: "KW-GSD-012", price: "95.00", cost: "42.00", wholesalePrice1: "75.00", wholesalePrice2: "68.00", quantity: 40, minQuantity: 8, locationId: loc1Id, categoryId: catIds[2], unit: "piece" },
        { name: "Boys' School Uniform Set", sku: "KW-BSU-013", price: "120.00", cost: "55.00", wholesalePrice1: "96.00", wholesalePrice2: "88.00", quantity: 50, minQuantity: 10, locationId: loc1Id, categoryId: catIds[2], unit: "set" },
        { name: "Kids Denim Jeans", sku: "KW-DNM-014", price: "75.00", cost: "32.00", wholesalePrice1: "60.00", wholesalePrice2: "55.00", quantity: 60, minQuantity: 12, locationId: loc1Id, categoryId: catIds[2], unit: "piece" },
        { name: "Baby Romper Set (3-piece)", sku: "KW-ROM-015", price: "65.00", cost: "28.00", wholesalePrice1: "52.00", wholesalePrice2: "48.00", quantity: 55, minQuantity: 12, locationId: loc1Id, categoryId: catIds[2], unit: "set" },
        { name: "Kids Ankara Outfit", sku: "KW-ANK-016", price: "110.00", cost: "48.00", wholesalePrice1: "88.00", wholesalePrice2: "80.00", quantity: 35, minQuantity: 8, locationId: loc1Id, categoryId: catIds[2], unit: "piece" },
        // Accessories
        { name: "Ladies Leather Handbag", sku: "AC-HBG-017", price: "195.00", cost: "90.00", wholesalePrice1: "155.00", wholesalePrice2: "142.00", quantity: 30, minQuantity: 5, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
        { name: "Women's Silk Headscarf", sku: "AC-SCF-018", price: "55.00", cost: "22.00", wholesalePrice1: "42.00", wholesalePrice2: "38.00", quantity: 70, minQuantity: 15, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
        { name: "Men's Leather Belt", sku: "AC-BLT-019", price: "75.00", cost: "32.00", wholesalePrice1: "60.00", wholesalePrice2: "55.00", quantity: 50, minQuantity: 10, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
        { name: "Fashion Sunglasses", sku: "AC-SGL-020", price: "85.00", cost: "35.00", wholesalePrice1: "68.00", wholesalePrice2: "62.00", quantity: 45, minQuantity: 10, locationId: loc1Id, categoryId: catIds[3], unit: "piece" },
      ]).onConflictDoUpdate({
        target: inventoryTable.sku,
        set: { updatedAt: new Date() }
      });
    }

    logger.info("Seed data created");
    res.json({ status: "seeded" });
  } catch (err) {
    logger.error({ err }, "Seed failed");
    res.status(500).json({ status: "error", error: String(err) });
  }
});

export default router;
