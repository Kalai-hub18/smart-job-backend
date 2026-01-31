const db = require("../config/db.config");
const path = require('path');

/* ===============================
   UPDATE APPLICATION STATUS
================================ */
exports.updateApplicationStatus = (req, res) => {
  const { status } = req.body;
  const applicationId = req.params.id;

  if (!["Applied", "Shortlisted", "Rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  db.query(
    "UPDATE applications SET status = ? WHERE id = ?",
    [status, applicationId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Application not found" });
      }
      res.json({ message: "Status updated successfully" });
    }
  );
};

/* ===============================
   GET APPLICATIONS (RECRUITER)
================================ */
exports.getApplicationsForRecruiter = (req, res) => {
  const recruiterId = req.user.id;

  const sortColumnMap = {
    applied_at: "a.applied_at",
    candidate_name: "u.name",
    email: "u.email",
    job_title: "j.title",
    status: "a.status",
  };

  const {
    page = 1,
    limit = 10,
    sortBy = "applied_at",
    order = "DESC",
    status,
    candidate,
    jobTitle,
    candidateEmail,
    appliedFrom,
    appliedTo,
    export: exportAll,
  } = req.query;

  const offset = (page - 1) * limit;

  // support multi-column sorting: comma-separated sortBy and order
  const sortKeys = String(sortBy || "").split(',').map(s => s.trim()).filter(Boolean);
  const orderKeys = String(order || "").split(',').map(o => o.trim().toUpperCase());

  const orderClauses = sortKeys.length
    ? sortKeys.map((s, idx) => {
        const col = sortColumnMap[s] || sortColumnMap['applied_at'];
        const ord = orderKeys[idx] === 'ASC' ? 'ASC' : 'DESC';
        return `${col} ${ord}`;
      }).join(', ')
    : `${sortColumnMap['applied_at']} DESC`;

  let baseQuery = `
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    JOIN users u ON a.user_id = u.id
    WHERE j.posted_by = ?
  `;

  const params = [recruiterId];

  if (status) {
    baseQuery += " AND a.status = ?";
    params.push(status);
  }

  if (candidate) {
    baseQuery += " AND u.name LIKE ?";
    params.push(`%${candidate}%`);
  }

  if (candidateEmail) {
    baseQuery += " AND u.email LIKE ?";
    params.push(`%${candidateEmail}%`);
  }

  if (jobTitle) {
    baseQuery += " AND j.title LIKE ?";
    params.push(`%${jobTitle}%`);
  }

  if (appliedFrom) {
    baseQuery += " AND a.applied_at >= ?";
    params.push(appliedFrom);
  }

  if (appliedTo) {
    baseQuery += " AND a.applied_at <= ?";
    params.push(appliedTo);
  }

  // If export flag is set, return all matching rows (no pagination)
  if (String(exportAll) === '1' || String(exportAll) === 'true') {
    const exportQuery = `
      SELECT 
        a.id,
        u.name AS candidate_name,
        u.email,
        j.title AS job_title,
        a.status,
        a.applied_at,
        CONCAT('http://localhost:5000/', a.resume) AS resume_url
      ${baseQuery}
      ORDER BY ${orderClauses}
    `;

    db.query(exportQuery, params, (err, results) => {
      if (err) return res.status(500).json({ error: err });
      return res.json({ total: results.length, data: results });
    });
  } else {
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;

    db.query(countQuery, params, (err, countResult) => {
      if (err) return res.status(500).json({ error: err });

      const total = countResult[0].total;

      const dataQuery = `
        SELECT 
          a.id,
          u.name AS candidate_name,
          u.email,
          j.title AS job_title,
          a.status,
          a.applied_at,
          CONCAT('http://localhost:5000/', a.resume) AS resume_url
        ${baseQuery}
        ORDER BY ${orderClauses}
        LIMIT ? OFFSET ?
      `;

      db.query(
        dataQuery,
        [...params, Number(limit), Number(offset)],
        (err, results) => {
          if (err) return res.status(500).json({ error: err });

          res.json({
            page: Number(page),
            limit: Number(limit),
            total,
            data: results,
          });
        }
      );
    });
  }
};

exports.getApplicationsForCandidate = (req, res) => {
  const userId = req.user.id;

  const q = `SELECT a.id, j.title AS job_title, a.status, a.applied_at, CONCAT('http://localhost:5000/', a.resume) AS resume_url
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE a.user_id = ?
    ORDER BY a.applied_at DESC`;

  db.query(q, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ data: rows });
  });
};


exports.getResume = (req, res) => {
  const applicationId = req.params.id;
  const recruiterId = req.user.id;

  const q = `SELECT a.resume FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = ? AND j.posted_by = ?`;
  db.query(q, [applicationId, recruiterId], (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Resume not found' });

    const resumePath = rows[0].resume;
    if (!resumePath) return res.status(404).json({ message: 'No resume available' });

    const absolute = path.resolve(resumePath);
    const filename = path.basename(resumePath);

    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(absolute, (err) => {
      if (err) return res.status(500).json({ error: err });
    });
  });
};
