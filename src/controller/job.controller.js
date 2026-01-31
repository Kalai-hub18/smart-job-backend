const db = require("../config/db.config");
exports.createJob = (req, res) => {
  const {
    title,
    description,
    location,
    skills,
    experience,
    company_name,
    company_logo,
  } = req.body;

  if (!title || !description || !company_name) {
    return res.status(400).json({ message: "Title, description and company name are required" });
  }

  const posted_by = req.user.id;

  const query = `INSERT INTO jobs (title, description, location, skills, experience, company_name, company_logo, posted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(query, [title, description, location, skills, experience, company_name, company_logo || null, posted_by], (err, result) => {
    if (err) {
      console.error('createJob error:', err);
      return res.status(500).json({ message: "Server error" });
    }
    res.status(201).json({ message: "Job created successfully", id: result.insertId });
  });
};

exports.getRecruiterJobs = (req, res) => {
  const recruiterId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const countQ = `SELECT COUNT(*) as total FROM jobs WHERE posted_by = ?`;
  db.query(countQ, [recruiterId], (err, countRes) => {
    if (err) return res.status(500).json({ error: err });
    const total = countRes[0].total;

    const q = `SELECT id, title, location, skills, experience, company_name, created_at FROM jobs WHERE posted_by = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    db.query(q, [recruiterId, Number(limit), Number(offset)], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ page, limit, total, data: results });
    });
  });
};

exports.deleteJob = (req, res) => {
  const jobId = req.params.id;
  const recruiterId = req.user.id;

  const q = `DELETE FROM jobs WHERE id = ? AND posted_by = ?`;
  db.query(q, [jobId, recruiterId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Job not found or not owned by you' });
    res.json({ message: 'Job deleted' });
  });
};

    exports.getJobs = (req, res) => {
  const idsParam = req.query.ids || "";
  if (idsParam) {
    const ids = idsParam.split(",").map(s => Number(s)).filter(Boolean);
    if (ids.length === 0) return res.json({ data: [] });
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT id, title, location, skills, experience, company_name, created_at FROM jobs WHERE id IN (${placeholders})`;
    return db.query(query, ids, (err, results) => {
      if (err) return res.status(500).json({ error: err });
      return res.json({ data: results });
    });
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 5;
  const title = req.query.title || "";
  const location = req.query.location || "";
  const skills = req.query.skills || "";
  const sortBy = req.query.sortBy || "created_at";
  const order = (req.query.order || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

  const offset = (page - 1) * limit;

  let whereClauses = [];
  let params = [];

  if (title) {
    whereClauses.push("(jobs.title LIKE ? OR jobs.company_name LIKE ?)");
    params.push(`%${title}%`, `%${title}%`);
  }

  if (location) {
    whereClauses.push("jobs.location = ?");
    params.push(location);
  }

  if (skills) {
    // support comma separated skills (matches any)
    const skillParts = skills.split(",").map(s => s.trim()).filter(Boolean);
    if (skillParts.length) {
      const skillConditions = skillParts.map(() => "jobs.skills LIKE ?").join(" OR ");
      whereClauses.push(`(${skillConditions})`);
      skillParts.forEach(s => params.push(`%${s}%`));
    }
  }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countQuery = `SELECT COUNT(*) as total FROM jobs ${whereSQL}`;

  db.query(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err });

    const total = countResult[0].total;

    // restrict sort column to a safe whitelist to avoid SQL injection
    const allowedSort = {
      created_at: 'jobs.created_at',
      title: 'jobs.title',
      company_name: 'jobs.company_name',
      location: 'jobs.location'
    };

    const sortColumn = allowedSort[sortBy] || 'jobs.created_at';

    const dataQuery = `
      SELECT 
        jobs.id,
        jobs.title,
        jobs.location,
        jobs.skills,
        jobs.experience,
        jobs.company_name,
        jobs.created_at
      FROM jobs
      ${whereSQL}
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?
    `;

    db.query(dataQuery, [...params, Number(limit), Number(offset)], (err, results) => {
      if (err) return res.status(500).json({ error: err });

      res.json({ page, limit, total, data: results });
    });
  });
};

exports.getJobById = (req, res) => {
  const jobId = req.params.id;

const query = `
  SELECT 
    jobs.*,
    users.name AS recruiter_name
  FROM jobs
  LEFT JOIN users ON jobs.posted_by = users.id
  WHERE jobs.id = ?
`;


  db.query(query, [jobId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err });
    }

    if (result.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json(result[0]);
  });
};

// related jobs by location or overlapping skills
exports.getRelatedJobs = (req, res) => {
  const jobId = req.params.id;

  db.query("SELECT location, skills FROM jobs WHERE id = ?", [jobId], (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Job not found' });

    const { location, skills } = rows[0];
    const skillParts = (skills || '').split(',').map(s => s.trim()).filter(Boolean);

    let where = 'WHERE jobs.id <> ?';
    const params = [jobId];

    if (location) {
      where += ' AND jobs.location = ?';
      params.push(location);
    }

    if (skillParts.length) {
      const skillConditions = skillParts.map(() => 'jobs.skills LIKE ?').join(' OR ');
      where += ` AND (${skillConditions})`;
      skillParts.forEach(s => params.push(`%${s}%`));
    }

    const query = `SELECT id, title, company_name, location, skills, created_at FROM jobs ${where} ORDER BY created_at DESC LIMIT 5`;

    db.query(query, params, (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ data: results });
    });
  });
};

// Get distinct locations for filters
exports.getLocations = (req, res) => {
  const query = `SELECT DISTINCT location FROM jobs WHERE location IS NOT NULL AND location <> '' ORDER BY location`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    const locations = results.map((r) => r.location);
    res.json({ data: locations });
  });
};

// Get distinct skills from comma-separated skills column
exports.getSkills = (req, res) => {
  const query = `SELECT skills FROM jobs WHERE skills IS NOT NULL AND skills <> ''`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });

    const set = new Set();
    results.forEach((row) => {
      row.skills.split(",").map(s=>s.trim()).filter(Boolean).forEach(s=>set.add(s));
    });

    res.json({ data: Array.from(set).sort() });
  });
};

// apply job 

exports.applyJob = (req, res) => {
  const jobId = req.params.id;
  const userId = req.user.id;
  const resumePath = req.file ? req.file.path : null;

  if (!resumePath) {
    return res
      .status(400)
      .json({ message: "Resume is required" });
  }

  // check if already applied
  db.query("SELECT id FROM applications WHERE job_id = ? AND user_id = ?", [jobId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    if (rows && rows.length) {
      return res.status(400).json({ message: "Already applied" });
    }

    const query = `
      INSERT INTO applications (job_id, user_id, resume)
      VALUES (?, ?, ?)
    `;

    db.query(query, [jobId, userId, resumePath], (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res
            .status(400)
            .json({ message: "Already applied" });
        }
        return res.status(500).json({ error: err });
      }

      res
        .status(201)
        .json({ message: "Job applied successfully" });
    });
  });
};

exports.isApplied = (req, res) => {
  const jobId = req.params.id;
  const userId = req.user.id;

  db.query("SELECT id FROM applications WHERE job_id = ? AND user_id = ?", [jobId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ applied: Array.isArray(rows) && rows.length > 0 });
  });
};

exports.viewApplications = (req, res) => {
  const recruiterId = req.user.id;

  const query = `
    SELECT 
      applications.id AS application_id,
      jobs.title AS job_title,
      users.name AS candidate_name,
      users.email AS candidate_email,
      applications.applied_at
    FROM applications
    JOIN jobs ON applications.job_id = jobs.id
    JOIN users ON applications.user_id = users.id
    WHERE jobs.posted_by = ?
    ORDER BY applications.applied_at DESC
  `;

  db.query(query, [recruiterId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err });
    }

    res.json(results);
  });
};

/* ===============================
   SAVE / UNSAVE JOBS (CANDIDATE)
================================ */
exports.saveJob = (req, res) => {
  const userId = req.user.id;
  const jobId = req.params.id;

  const query = `INSERT INTO saved_jobs (user_id, job_id) VALUES (?, ?)`;
  db.query(query, [userId, jobId], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(200).json({ message: 'Already saved' });
      }
      return res.status(500).json({ error: err });
    }

    res.status(201).json({ message: 'Job saved' });
  });
};

exports.unsaveJob = (req, res) => {
  const userId = req.user.id;
  const jobId = req.params.id;

  const query = `DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?`;
  db.query(query, [userId, jobId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Job removed from saved list' });
  });
};

exports.getSavedJobs = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT j.* FROM jobs j
    JOIN saved_jobs s ON s.job_id = j.id
    WHERE s.user_id = ?
    ORDER BY s.saved_at DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ data: results });
  });
};

// migrate saved job ids from localStorage to DB (body: { jobIds: [1,2,3] })
exports.migrateSavedJobs = (req, res) => {
  const userId = req.user.id;
  const jobIds = Array.isArray(req.body.jobIds) ? req.body.jobIds : [];

  if (jobIds.length === 0) {
    return res.status(400).json({ message: 'No jobIds provided' });
  }

  // build multi-row insert with IGNORE duplicate
  const values = jobIds.map(() => '(?, ?)').join(',');
  const params = [];
  jobIds.forEach((jobId) => {
    params.push(userId, jobId);
  });

  const query = `INSERT IGNORE INTO saved_jobs (user_id, job_id) VALUES ${values}`;

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Migrated saved jobs', inserted: result.affectedRows });
  });
};


