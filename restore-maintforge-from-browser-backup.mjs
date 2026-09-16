import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import { createClient } from "@supabase/supabase-js";

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (hidden) {
      rl.stdoutMuted = true;
      const originalWrite = rl._writeToOutput;
      rl._writeToOutput = function (stringToWrite) {
        if (rl.stdoutMuted) rl.output.write("*");
        else originalWrite.call(rl, stringToWrite);
      };
    }

    rl.question(question, (answer) => {
      rl.close();
      console.log("");
      resolve(answer.trim());
    });
  });
}

function findBackupFile() {
  const downloads = path.join(os.homedir(), "Downloads");
  const files = fs.readdirSync(downloads)
    .filter((f) => f.toLowerCase().includes("maintforge") && f.toLowerCase().endsWith(".json"))
    .map((f) => path.join(downloads, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  return files[0] || null;
}

function readSupabaseConfig() {
  const candidates = [
    path.join(process.cwd(), "src", "supabase.js"),
    path.join(process.cwd(), "src", "supabase.jsx"),
    path.join(process.cwd(), "supabase.js"),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const txt = fs.readFileSync(file, "utf8");

    const url =
      txt.match(/VITE_SUPABASE_URL[^|]*\|\|\s*["'`](https:\/\/[^"'`]+)["'`]/)?.[1] ||
      txt.match(/SUPABASE_URL[^|]*\|\|\s*["'`](https:\/\/[^"'`]+)["'`]/)?.[1] ||
      txt.match(/["'`](https:\/\/[^"'`]+\.supabase\.co)["'`]/)?.[1];

    const anon =
      txt.match(/VITE_SUPABASE_ANON_KEY[^|]*\|\|\s*["'`]([^"'`]+)["'`]/)?.[1] ||
      txt.match(/SUPABASE_ANON_KEY[^|]*\|\|\s*["'`]([^"'`]+)["'`]/)?.[1] ||
      txt.match(/["'`](eyJ[^"'`]+)["'`]/)?.[1];

    if (url && anon) return { url, anon };
  }

  throw new Error("Could not find Supabase URL/key in src/supabase.js");
}

const backupPath = process.argv[2] || findBackupFile();

if (!backupPath || !fs.existsSync(backupPath)) {
  console.error("Could not find MaintForge backup JSON in Downloads.");
  process.exit(1);
}

console.log("Using backup file:");
console.log(backupPath);

const raw = fs.readFileSync(backupPath, "utf8");
const data = JSON.parse(raw);

console.log("Backup counts:");
console.log({
  equipment: data.equipment?.length || 0,
  workOrders: data.workOrders?.length || 0,
  parts: data.parts?.length || 0,
  facilities: data.locations?.length || 0,
  pmSchedules: data.pmSchedules?.length || 0,
  inspectionSchedules: data.inspectionSchedules?.length || 0,
  fuelContainers: data.fuelContainers?.length || 0,
});

if ((data.equipment?.length || 0) === 0 && (data.workOrders?.length || 0) === 0) {
  throw new Error("Backup looks empty. Stopping.");
}

const { url, anon } = readSupabaseConfig();
const supabase = createClient(url, anon);

const email = await ask("MaintForge email: ");
const password = await ask("MaintForge password: ", true);

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (authError) throw authError;

const userId = authData.user.id;
console.log("Signed in as:", userId);

data.ownerUserId = userId;

const { data: oldRow } = await supabase
  .from("user_state")
  .select("*")
  .eq("user_id", userId)
  .maybeSingle();

if (oldRow) {
  const backupName = `cloud-row-before-restore-${Date.now()}.json`;
  fs.writeFileSync(backupName, JSON.stringify(oldRow, null, 2));
  console.log("Saved current cloud row backup:", backupName);
}

const { error: upsertError } = await supabase
  .from("user_state")
  .upsert({
    user_id: userId,
    data,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

if (upsertError) throw upsertError;

console.log("");
console.log("RESTORE COMPLETED SUCCESSFULLY.");
console.log("Refresh MaintForge now.");
