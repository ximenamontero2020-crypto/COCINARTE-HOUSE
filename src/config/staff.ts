export const STAFF_EMAILS = [
  'ximenamontero2020@gmail.com',
] as const;

export function isStaffEmail(email: string | undefined): boolean {
  return Boolean(email && STAFF_EMAILS.includes(email.trim().toLowerCase() as (typeof STAFF_EMAILS)[number]));
}
