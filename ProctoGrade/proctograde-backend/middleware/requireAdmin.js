const User = require("../models/User");

/**
 * Must run after `auth` middleware so `req.user.id` is set.
 */
module.exports = async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ msg: "Admin access required" });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};