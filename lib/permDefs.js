// lib/permDefs.js
// Central list of all permissions your app understands.
// Update this as your app grows.
export const PERMISSIONS = [
  // Centers
  { key: "view_centers", label: "View centers", group: "Centers" },
  { key: "add_center", label: "Add center", group: "Centers" },
  { key: "edit_center", label: "Edit center", group: "Centers" },
  { key: "delete_center", label: "Delete center", group: "Centers" },

  // Areas & People
  { key: "view_areas", label: "View areas", group: "Areas & People" },
  { key: "add_area", label: "Add area", group: "Areas & People" },
  { key: "edit_area", label: "Edit area", group: "Areas & People" },
  { key: "delete_area", label: "Delete area", group: "Areas & People" },

  { key: "view_people", label: "View people", group: "Areas & People" },
  { key: "add_people", label: "Add people", group: "Areas & People" },
  { key: "edit_people", label: "Edit people", group: "Areas & People" },
  { key: "delete_people", label: "Delete people", group: "Areas & People" },

  // Users & Roles
  { key: "manage_users", label: "Manage users", group: "Administration" },
  { key: "manage_roles", label: "Manage roles", group: "Administration" },
];

// Grouped view for UI
export function groupPermissions(perms = PERMISSIONS) {
  const byGroup = {};
  for (const p of perms) {
    if (!byGroup[p.group]) byGroup[p.group] = [];
    byGroup[p.group].push(p);
  }
  return byGroup;
}
