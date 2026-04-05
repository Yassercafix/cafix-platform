/**
 * Staff Reference Code Generator
 *
 * FORMAT RULES
 * ─────────────────────────────────────────────────────────────────────────────
 * Staff codes are derived from the cafeteria's own referenceCode, NOT random.
 *
 * Pattern: {cafeteriaReferenceCode}{roleLetter}{nn}
 *
 *   Waiter         → {cafeteriaReferenceCode}W01, W02, W03 …
 *   Chef           → {cafeteriaReferenceCode}K01, K02, K03 …
 *   Manager        → {cafeteriaReferenceCode}M01, M02, M03 …
 *   Cafeteria Admin → {cafeteriaReferenceCode}A01, A02, A03 …
 *
 * Rules:
 *  - Sequential numbering per cafeteria per role (01, 02, 03 …)
 *  - Always 2 digits (zero-padded)
 *  - Must be unique (enforced at DB level via unique constraint)
 *  - Deterministic — no randomness involved
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { and, eq, like, sql } from "drizzle-orm";
import { getDb } from "../db.js";
import { cafeterias, cafeteriaStaff } from "../../drizzle/schema.js";

// ─── Role letter mapping ──────────────────────────────────────────────────────

export const STAFF_ROLE_LETTER: Record<string, string> = {
  waiter: "W",
  chef: "K",
  manager: "M",
  cafeteria_admin: "A",
};

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generates the next staff reference code for the given cafeteria and role.
 *
 * Steps:
 *  1. Fetch the cafeteria's referenceCode from the DB.
 *  2. Determine the role letter (W / K / M / A).
 *  3. Count existing staff in that cafeteria with the same role letter prefix.
 *  4. Return `{cafeteriaReferenceCode}{roleLetter}{nn}` where nn = count + 1.
 *
 * @param cafeteriaId  The cafeteria's primary key (UUID / nanoid).
 * @param role         One of: "waiter" | "chef" | "manager" | "cafeteria_admin".
 * @returns            e.g. "1001P01W03"
 * @throws             If the cafeteria is not found, role is invalid, or limit exceeded.
 */
/**
 * Generates the next staff reference code for the given cafeteria and role.
 *
 * RACE CONDITION PROTECTION:
 * This function MUST be called within a DB transaction that holds a lock
 * on the cafeteria row to prevent duplicate codes under high concurrency.
 */
export async function generateStaffReferenceCode(
  tx: any,
  cafeteriaId: string,
  role: string
): Promise<string> {
  // 1. Fetch cafeteria referenceCode and LOCK the row
  // We use a dummy update or a select for update to serialize generation for this cafeteria
  const cafeteriaResult = await tx
    .select({ referenceCode: cafeterias.referenceCode })
    .from(cafeterias)
    .where(eq(cafeterias.id, cafeteriaId))
    .for("update"); // Row-level lock

  if (cafeteriaResult.length === 0) {
    throw new Error(`Cafeteria not found: ${cafeteriaId}`);
  }

  const cafeteriaRefCode = cafeteriaResult[0].referenceCode;
  if (!cafeteriaRefCode) {
    throw new Error(`Cafeteria ${cafeteriaId} has no referenceCode assigned`);
  }

  // 2. Determine role letter
  const roleLetter = STAFF_ROLE_LETTER[role];
  if (!roleLetter) {
    throw new Error(`Unknown staff role: ${role}`);
  }

  // 3. Build prefix and find existing staff codes with this prefix
  const prefix = `${cafeteriaRefCode}${roleLetter}`;
  const expectedLength = prefix.length + 2;

  const existingCodes = await tx
    .select({ referenceCode: cafeteriaStaff.referenceCode })
    .from(cafeteriaStaff)
    .where(
      and(
        eq(cafeteriaStaff.cafeteriaId, cafeteriaId),
        like(cafeteriaStaff.referenceCode, `${prefix}__`),
        sql`LENGTH(${cafeteriaStaff.referenceCode}) = ${expectedLength}`
      )
    );

  // 4. Find the highest existing suffix and increment
  let maxSuffix = 0;
  for (const row of existingCodes) {
    if (!row.referenceCode) continue;
    const suffix = row.referenceCode.substring(prefix.length);
    if (/^\d{2}$/.test(suffix)) {
      const n = parseInt(suffix, 10);
      if (n > maxSuffix) maxSuffix = n;
    }
  }

  const nextSuffix = maxSuffix + 1;
  if (nextSuffix > 99) {
    throw new Error(
      `Maximum 99 staff members of role "${role}" reached for cafeteria ${cafeteriaId}`
    );
  }

  return `${prefix}${String(nextSuffix).padStart(2, "0")}`;
}
