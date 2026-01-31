const mysql = require("mysql2");
require("dotenv").config();


const db = mysql.createConnection(process.env.DATABASE_URL);
  // host: process.env.DB_HOST,
  // user: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,
  // database: process.env.DB_NAME,


db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ MySQL Database Connected");

    // Ensure saved_jobs table exists
    const createSavedJobs = `
      CREATE TABLE IF NOT EXISTS saved_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        job_id INT NOT NULL,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_saved (user_id, job_id),
        INDEX (user_id),
        INDEX (job_id),
        CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_saved_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    db.query(createSavedJobs, (err) => {
      if (err) console.error('Error creating saved_jobs table:', err);
    });

    // Ensure unique index on applications (job_id, user_id) to prevent duplicate applications
    const checkIndex = `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'applications' AND INDEX_NAME = 'unique_application'`;
    db.query(checkIndex, [process.env.DB_NAME], (err, rows) => {
      if (err) {
        console.error('Error checking applications index:', err);
      } else if (rows[0].cnt === 0) {
        const alter = `ALTER TABLE applications ADD UNIQUE KEY unique_application (job_id, user_id)`;
        db.query(alter, (err) => {
          if (err) {
            // Might fail if table doesn't exist; that's fine
            console.warn('Could not add unique index to applications:', err.message);
          }
        });
      }
    });

    // Ensure company_about and company_website columns exist in jobs table
    const checkCompanyCols = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'jobs' AND COLUMN_NAME IN ('company_about','company_website')`;
    db.query(checkCompanyCols, [process.env.DB_NAME], (err, rows) => {
      if (err) return console.error('Error checking jobs columns:', err);

      const cols = rows.map(r => r.COLUMN_NAME);
      if (!cols.includes('company_about')) {
        db.query(`ALTER TABLE jobs ADD COLUMN company_about TEXT NULL`, (err) => {
          if (err) console.warn('Could not add company_about:', err.message);
        });
      }
      if (!cols.includes('company_website')) {
        db.query(`ALTER TABLE jobs ADD COLUMN company_website VARCHAR(255) NULL`, (err) => {
          if (err) console.warn('Could not add company_website:', err.message);
        });
      }
    });

    // Ensure users.role can accept recruiter/employer values (fix enum truncation)
    const checkRole = `SHOW COLUMNS FROM users LIKE 'role'`;
    db.query(checkRole, (err, rows) => {
      if (err) return console.warn('Could not check users.role column:', err.message);
      if (!rows || rows.length === 0) return;

      const type = rows[0].Type || '';
      // if enum and doesn't contain 'recruiter' or 'employer', try altering to enum with both
      if (type.startsWith('enum(') && !/recruiter/i.test(type)) {
        const alter = `ALTER TABLE users MODIFY role ENUM('candidate','recruiter','employer') NOT NULL DEFAULT 'candidate'`;
        db.query(alter, (err) => {
          if (err) console.warn('Could not update users.role enum:', err.message);
          else console.log('✅ Updated users.role enum to include recruiter/employer');
        });
      }

      // if role is some too-small varchar, enlarge it
      if (type.startsWith('varchar') && !/varchar\(32\)/i.test(type)) {
        const alterV = `ALTER TABLE users MODIFY role VARCHAR(32) NOT NULL DEFAULT 'candidate'`;
        db.query(alterV, (err) => {
          if (err) console.warn('Could not expand users.role varchar:', err.message);
          else console.log('✅ Expanded users.role to VARCHAR(32)');
        });
      }
    });
  }
});

module.exports = db;
