/**
 * Client/Application permission projection.
 * Server remains the authority; this only prevents obvious UI/offline attempts
 * when userPermissions were loaded from fetchAllData.
 */
import { err, ok, type Result } from "../domain/result.ts";

export type PermissionId = string;

export function assertLocalPermission(
  userPermissions: string[] | undefined | null,
  permission: PermissionId,
): Result<true> {
  // Empty/undefined = not yet loaded or pre-seed catalog → allow offline enqueue;
  // server will still enforce on sync.
  if (!userPermissions || userPermissions.length === 0) return ok(true);
  if (userPermissions.includes(permission)) return ok(true);
  return err("PERMISSION", `ليس لديك صلاحية: ${permission}`);
}
