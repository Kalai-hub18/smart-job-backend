
const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10
});

db.query("SELECT DATABASE() AS db", (err, rows) => {
  if (!err) console.log("✅ Connected to DB:", rows[0].db);
});

module.exports = db;
