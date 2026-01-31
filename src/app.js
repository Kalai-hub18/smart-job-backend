const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./config/db.config");

const authRoutes = require("./routes/auth.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Smart Job Portal API running");
});

const { verifyToken } = require("./middleware/auth.middleware");

app.get("/api/protected", verifyToken, (req, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user,
  });
});
const jobRoutes = require("./routes/job.routes");

app.use("/api/jobs", jobRoutes);
app.use("/uploads", express.static("uploads"));
const applicationRoutes = require("./routes/application.routes");
app.use("/api/applications", applicationRoutes);



module.exports = app;
