const jwt = require("jsonwebtoken");

// Memverifikasi JWT dari header Authorization: Bearer <token>
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid atau sudah kedaluwarsa." });
  }
};

// Membatasi akses berdasarkan role, mis: checkRole("admin", "bendahara")
exports.checkRole = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.userRole)) {
    return res.status(403).json({ message: "Anda tidak memiliki akses ke sumber daya ini." });
  }
  next();
};