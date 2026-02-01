const mysql = require("mysql2");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL;

if (!DATABASE_URL) {
  console.error("❌ No database URL found");
  process.exit(1);
}

const db = mysql.createPool(DATABASE_URL);

db.query("SELECT DATABASE() AS db", (err, rows) => {
  if (err) console.error("❌ DB error:", err.message);
  else console.log("✅ Connected to DB:", rows[0].db);
});

module.exports = db;
