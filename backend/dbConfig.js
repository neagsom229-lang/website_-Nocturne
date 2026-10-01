export function getSslConfig(databaseUrl) {
  return databaseUrl.hostname.endsWith('.pooler.supabase.com')
    ? { rejectUnauthorized: false }
    : undefined;
}
