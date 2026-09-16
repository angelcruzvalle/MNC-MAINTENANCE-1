import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";
import { supabase } from "./src/supabase.js";

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (hidden) {
      rl.stdoutMuted = true;
      rl._writeToOutput = function (stringToWrite) {
        if (rl.stdoutMuted) rl.output.write("*");
        else rl.output.write(stringToWrite);
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
    .filter((f) =>
      f.toLowerCase().includes("maintforge") &&
      f.toLowerCase().includes("backup") &&
      f.toLowerCase().endsWith(".json")
    )
    .map((f) => path.join(downloads, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  return files[0] || null;
}

const backupPath = process.argv[2] || findBackupFile();

if (!backupPath || !fs.existsSync(backupPath)) {
  console.error("Could not find the MaintForge backup JSON in Downloads.");
  console.error("Make sure MaintForge_ncaState_BACKUP_RESTORE (1).json is in Downloads.");
  process.exit(1);
}

console.log("Using backup file:");
console.log(backupPath);

const raw = fs.readFileSync(backupPath, "utf8");
const restoredData = JSON.parse(raw);

const counts = {
  equipment: restoredData.equipment?.length || 0,
  workOrders: restoredData.workOrders?.length || 0,
  parts: restoredData.parts?.length || 0,
  facilities: restoredData.locations?.length || 0,
  pmSchedules: restoredData.pmSchedules?.length || 0,
  inspectionSchedules: restoredData.inspectionSchedules?.length || 0,
  fuelContainers: restoredData.fuelContainers?.length || 0,
};

console.log("Backup counts:");
console.log(counts);

if (counts.equipment === 0 && counts.workOrders === 0) {
  console.error("This backup looks empty. Stopping.");
  process.exit(1);
}

const email = await ask("MaintForge email: ");
const password = await ask("MaintForge password: ", true);

const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (loginError) {
  console.error("Login failed:");
  console.error(loginError.message);
  process.exit(1);
}

const userId = loginData.user.id;
console.log("Signed in as:");
console.log(userId);

restoredData.ownerUserId = userId;

const { data: oldRow, error: oldError } = await supabase
  .from("user_state")
  .select("*")
  .eq("user_id", userId)
  .maybeSingle();

if (oldError) {
  console.error("Could not read current cloud row:");
  console.error(oldError.message);
}

if (oldRow) {
  const safetyFile = `cloud-row-before-restore-${Date.now()}.json`;
  fs.writeFileSync(safetyFile, JSON.stringify(oldRow, null, 2));
  console.log("Saved safety backup of current cloud row:");
  console.log(safetyFile);
}

const { error: restoreError } = await supabase
  .from("user_state")
  .upsert(
    {
      user_id: userId,
      data: restoredData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

if (restoreError) {
  console.error("Restore failed:");
  console.error(restoreError.message);
  process.exit(1);
}

console.log("");
console.log("RESTORE COMPLETED SUCCESSFULLY.");
console.log("Refresh MaintForge now.");
