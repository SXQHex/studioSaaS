/** Only centers the actor can manage, never merely teach at. */
export function managedCenters<
  T extends { id: string; organization_id: string },
>(
  centers: T[],
  assignments: Array<{
    role: string;
    scopeType: string;
    scopeId: string | null;
  }>,
): T[] {
  if (
    assignments.some((a) => a.role === "appowner" && a.scopeType === "platform")
  )
    return centers;
  const ownedOrganizations = new Set(
    assignments
      .filter((a) => a.role === "owner" && a.scopeType === "organization")
      .map((a) => a.scopeId),
  );
  const managedIds = new Set(
    assignments
      .filter((a) => a.role === "admin" && a.scopeType === "center")
      .map((a) => a.scopeId),
  );
  return centers.filter(
    (center) =>
      ownedOrganizations.has(center.organization_id) ||
      managedIds.has(center.id),
  );
}
