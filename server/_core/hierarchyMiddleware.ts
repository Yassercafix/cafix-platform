import { TRPCError } from "@trpc/server";
import { eq, and, or } from "drizzle-orm";
import { getDb } from "../db.js";
import { marketers, cafeterias } from "../../drizzle/schema.js";

/**
 * Hierarchy Visibility Rules (Per Specification)
 *
 * Each marketer can see ONLY:
 * - Their direct parent (if exists)
 * - Their direct children
 *
 * No access to:
 * - Grandchildren
 * - Siblings
 * - Other branches
 * - Ancestors beyond direct parent
 */

export interface HierarchyCheckParams {
  userId: string;
  userRole: string;
  targetMarketerCode?: string;
  targetCafeteriaCode?: string;
}

/**
 * Get the direct parent marketer code for a given marketer
 */
export async function getDirectParent(
  marketerCode: string
): Promise<string | null> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const marketer = await db
    .select()
    .from(marketers)
    .where(eq(marketers.referenceCode, marketerCode))
    .limit(1);

  if (marketer.length === 0) return null;

  if (marketer[0].parentId) {
    const parent = await db
      .select()
      .from(marketers)
      .where(eq(marketers.id, marketer[0].parentId))
      .limit(1);

    if (parent.length > 0) {
      return parent[0].referenceCode;
    }
  }

  return null;
}

/**
 * Get all direct children of a marketer
 */
export async function getDirectChildren(
  marketerCode: string
): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const parent = await db
    .select()
    .from(marketers)
    .where(eq(marketers.referenceCode, marketerCode))
    .limit(1);

  if (parent.length === 0) return [];

  const children = await db
    .select()
    .from(marketers)
    .where(eq(marketers.parentId, parent[0].id));

  return children.map((c: any) => c.referenceCode).filter((c: any) => c !== null) as string[];
}

/**
 * Get all direct cafeterias under a marketer
 */
export async function getDirectCafeterias(
  marketerCode: string
): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const marketer = await db
    .select()
    .from(marketers)
    .where(eq(marketers.referenceCode, marketerCode))
    .limit(1);

  if (marketer.length === 0) return [];

  const cafeterias_list = await db
    .select()
    .from(cafeterias)
    .where(eq(cafeterias.marketerId, marketer[0].id));

  return cafeterias_list
    .map((c: any) => c.referenceCode)
    .filter((c: any) => c !== null) as string[];
}

/**
 * Check if a marketer can access another marketer
 * Returns true if:
 * - They are the same marketer
 * - One is the direct parent of the other
 * - One is a direct child of the other
 */
export async function canMarketerAccessMarketer(
  sourceMarketerCode: string,
  targetMarketerCode: string
): Promise<boolean> {
  // Same marketer
  if (sourceMarketerCode === targetMarketerCode) return true;

  // Check if target is direct parent
  const targetParent = await getDirectParent(targetMarketerCode);
  if (targetParent === sourceMarketerCode) return true;

  // Check if target is direct child
  const sourceChildren = await getDirectChildren(sourceMarketerCode);
  if (sourceChildren.includes(targetMarketerCode)) return true;

  return false;
}

/**
 * Check if a marketer can access a cafeteria
 * Returns true if:
 * - The cafeteria is directly under the marketer
 * - The cafeteria is under a direct child marketer
 */
export async function canMarketerAccessCafeteria(
  marketerCode: string,
  cafeteriaCode: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  // Get the cafeteria
  const cafeteria = await db
    .select()
    .from(cafeterias)
    .where(eq(cafeterias.referenceCode, cafeteriaCode))
    .limit(1);

  if (cafeteria.length === 0) return false;

  // Get the marketer
  const marketer = await db
    .select()
    .from(marketers)
    .where(eq(marketers.referenceCode, marketerCode))
    .limit(1);

  if (marketer.length === 0) return false;

  // Check if cafeteria is directly under this marketer
  if (cafeteria[0].marketerId === marketer[0].id) return true;

  // Check if cafeteria is under a direct child marketer
  const directChildren = await getDirectChildren(marketerCode);
  for (const childCode of directChildren) {
    const child = await db
      .select()
      .from(marketers)
      .where(eq(marketers.referenceCode, childCode))
      .limit(1);

    if (child.length > 0 && cafeteria[0].marketerId === child[0].id) {
      return true;
    }
  }

  return false;
}

/**
 * Enforce hierarchy visibility in a marketer procedure
 * Throws error if user cannot access the target
 */
export async function enforceMarketerHierarchyAccess(
  userMarketerCode: string,
  targetMarketerCode: string
): Promise<void> {
  const canAccess = await canMarketerAccessMarketer(userMarketerCode, targetMarketerCode);

  if (!canAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have access to marketer ${targetMarketerCode}. You can only access your direct parent or direct children.`,
    });
  }
}

/**
 * Enforce hierarchy visibility for cafeteria access
 */
export async function enforceMarketerCafeteriaAccess(
  userMarketerCode: string,
  cafeteriaCode: string
): Promise<void> {
  const canAccess = await canMarketerAccessCafeteria(userMarketerCode, cafeteriaCode);

  if (!canAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have access to cafeteria ${cafeteriaCode}. You can only access cafeterias directly under you or your direct children.`,
    });
  }
}
