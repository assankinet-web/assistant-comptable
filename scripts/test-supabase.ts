import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { supabase } = await import("../lib/supabase");

  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .limit(1);

  if (error) {
    console.error("SUPABASE ERROR:", error);
    process.exit(1);
  }

  console.log("SUPABASE OK:", data);
}

main();
