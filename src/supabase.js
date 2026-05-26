import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zpknlntapdeqmvtxwmqx.supabase.co";
const supabaseAnonKey = "sb_publishable_L4bMVaIWZvYRZ1UWS2iQMA_8NUyhuqE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);