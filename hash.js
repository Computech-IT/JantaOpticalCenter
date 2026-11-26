const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");

const [, , username, plainPassword] = process.argv;
if (!username || !plainPassword || plainPassword.length < 8) {
  console.error("Usage: node hash.js <username> <newPassword (min 8 chars)>");
  process.exit(1);
}

const dbPath = path.join(__dirname, "data", "products.db");
const db = new sqlite3.Database(dbPath);

bcrypt.hash(plainPassword.trim(), 12, (err, hash) => {
  if (err) throw err;
  db.run(
    "UPDATE admins SET password_hash = ? WHERE LOWER(username) = ?",
    [hash, username.trim().toLowerCase()],
    function (dbErr) {
      if (dbErr) {
        console.error("Error updating password:", dbErr);
      } else if (this.changes === 0) {
        console.log("No admin found with that username.");
      } else {
        console.log(`Password updated securely for '${username}'.`);
      }
      db.close();
    }
  );
});
