const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  // Token from Authorization: Bearer <token> OR x-auth-token
  let token = null;

  const authHeader = req.header("Authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    token = parts.length === 2 ? parts[1] : parts[0];
  } else if (req.header("x-auth-token")) {
    token = req.header("x-auth-token");
  }

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Tum token is tarah sign kar rahi ho: { id: user._id }
    req.user = { id: decoded.id };
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ msg: "Token is not valid" });
  }
};
