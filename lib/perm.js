export function has(user, perm) {
  return !!user?.permissions?.includes(perm);
}
