// TYPECHECK STAND-IN for a Lovable host's auto-generated src/integrations/supabase/client.ts, so the adapter
// template in integration/ is checked against the real supabase-js types. Not used at runtime.
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient("http://127.0.0.1:54321", "local-anon");
