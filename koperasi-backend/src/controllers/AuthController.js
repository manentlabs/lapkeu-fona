const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "7d";

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role.name },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: "refresh" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role.name,
    last_login: user.last_login,
    is_active: user.is_active,
  };
}

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(422).json({ message: "Username dan kata sandi wajib diisi." });
    }

    const user = await User.findOne({
      where: { username },
      include: [{ model: Role, as: "role" }],
    });

    if (!user) {
      return res.status(401).json({ message: "Username atau kata sandi salah." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Username atau kata sandi salah." });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "Akun Anda belum aktif. Hubungi administrator." });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    user.last_login = new Date();
    user.is_online = true;
    await user.save();

    return res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "bearer",
      user: serializeUser(user),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

// GET /api/auth/me  (butuh AuthMiddleware)
exports.me = async (req, res) => {
  const user = await User.findByPk(req.userId, {
    include: [{ model: Role, as: "role" }],
  });

  if (!user) {
    return res.status(404).json({ message: "Pengguna tidak ditemukan." });
  }

  return res.json({ user: serializeUser(user) });
};

// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(401).json({ message: "Refresh token tidak ditemukan." });
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);

    const user = await User.findByPk(payload.sub, {
      include: [{ model: Role, as: "role" }],
    });

    if (!user) {
      return res.status(401).json({ message: "Sesi tidak valid." });
    }

    const accessToken = signAccessToken(user);

    return res.json({
      access_token: accessToken,
      token_type: "bearer",
      user: serializeUser(user),
    });
  } catch (err) {
    return res.status(401).json({ message: "Sesi telah berakhir, silakan masuk kembali." });
  }
};

// POST /api/auth/logout  (butuh AuthMiddleware)
exports.logout = async (req, res) => {
  const user = await User.findByPk(req.userId);

  if (user) {
    user.is_online = false;
    await user.save();
  }

  return res.json({ message: "Berhasil keluar." });
};