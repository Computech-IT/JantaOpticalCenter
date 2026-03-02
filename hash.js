const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const path = require("path");

// Path to your SQLite DB
const dbPath = path.join(__dirname, "data", "products.db");
const db = new sqlite3.Database(dbPath);

// Replace these with your admin credentials
const username = "admin";       // existing admin username
const plainPassword = "admin123"; // current plain password

bcrypt.hash(plainPassword, 10, (err, hash) => {
    if (err) throw err;

    db.run("UPDATE admins SET password_hash=? WHERE username=?", [hash, username], function (err) {
        if (err) {
            console.error("Error updating password:", err);
        } else if (this.changes === 0) {
            console.log("No admin found with that username.");
        } else {
            console.log("Admin password hashed and updated successfully!");
        }
        db.close();
    });
});