/**
 * Identity Audit Script
 * Checks the current state of all login-capable users in the DB
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "./db.js";
import { users, marketers, cafeterias, cafeteriaStaff } from "../drizzle/schema.js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function main() {
  console.log("=== IDENTITY AUDIT ===\n");

  const db = await getDb();
  if (!db) {
    console.error("DB connection failed");
    process.exit(1);
  }
  console.log("✅ DB connected\n");

  // Check users table
  const allUsers = await db.select().from(users);
  console.log(`USERS TABLE (${allUsers.length} rows):`);
  allUsers.forEach(u => {
    console.log(`  - ${u.email || u.loginUsername} | role=${u.role} | openId=${u.openId} | hasPassword=${!!u.passwordHash}`);
  });

  // Check marketers table
  const allMarketers = await db.select().from(marketers);
  console.log(`\nMARKETERS TABLE (${allMarketers.length} rows):`);
  allMarketers.forEach(m => {
    console.log(`  - ${m.email || m.loginUsername} | ref=${m.referenceCode} | hasPassword=${!!m.passwordHash} | parentId=${m.parentId || 'none'}`);
  });

  // Check cafeterias table
  const allCafeterias = await db.select().from(cafeterias);
  console.log(`\nCAFETERIAS TABLE (${allCafeterias.length} rows):`);
  allCafeterias.forEach(c => {
    console.log(`  - ${c.loginUsername} | ref=${c.referenceCode} | hasPassword=${!!c.passwordHash} | marketerId=${c.marketerId}`);
  });

  // Check cafeteriaStaff table
  const allStaff = await db.select().from(cafeteriaStaff);
  console.log(`\nCAFETERIA STAFF TABLE (${allStaff.length} rows):`);
  allStaff.forEach(s => {
    console.log(`  - ${s.loginUsername} | role=${s.role} | hasPassword=${!!s.passwordHash} | canLogin=${s.canLogin} | cafeteriaId=${s.cafeteriaId}`);
  });

  // Check Supabase Auth users
  if (supabaseUrl && supabaseServiceKey) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: authUsers, error } = await supabase.auth.admin.listUsers({ perPage: 100 });
    if (error) {
      console.log(`\nSUPABASE AUTH: Error - ${error.message}`);
    } else {
      console.log(`\nSUPABASE AUTH USERS (${authUsers.users.length} accounts):`);
      authUsers.users.forEach(u => {
        console.log(`  - ${u.email} | id=${u.id} | confirmed=${u.email_confirmed_at ? 'yes' : 'no'}`);
      });
    }
  } else {
    console.log("\nSUPABASE AUTH: Not configured");
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
