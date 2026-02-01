const mysql = require("mysql2");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const db = mysql.createPool(process.env.DATABASE_URL);

// test connection
db.query("SELECT DATABASE() AS db", (err, rows) => {
  if (err) {
    console.error("❌ DB connection failed:", err.message);
  } else {
    console.log("✅ Connected to DB:", rows[0].db);
  }
});

module.exports = db;
