/**
 * Supabase Admin 클라이언트 (서버 전용)
 * RLS를 우회하여 announcement_sources, grant_announcements 등에 insert/update 가능.
 * BIZINFO_API_KEY 등과 마찬가지로 클라이언트에 노출되지 않도록 .env.local에만 설정.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }) : null;
