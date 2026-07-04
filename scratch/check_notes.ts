import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Read from .env.local
const envContent = fs.readFileSync("../.env.local", "utf8");
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1];

if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl.trim(), supabaseKey.trim());
  supabase.from("orders").select("notes").limit(1).then(res => {
    console.log(JSON.stringify(res, null, 2));
  }).catch(e => console.error(e));
}
