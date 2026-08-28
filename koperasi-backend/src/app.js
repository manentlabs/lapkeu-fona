const express = require("express");
const cors = require("cors");
const path = require("path");

// ─── Import Routes ──────────────────────────────────────
const authRoutes = require("./routes/AuthRoute");
const wilayahRoutes = require("./routes/WilayahRoute");
const adminDashboardRoutes = require("./routes/AdminDashboardRoute");
const anggotaRoutes = require("./routes/AnggotaRoute");
const akunRoutes = require("./routes/AkunRoute");
const kodeReferensiRoutes = require("./routes/KodeReferensiRoute");
const persentaseShuRoutes = require("./routes/PersentaseShuRoute");
const userRoutes = require("./routes/UserRoute");
const roleRoutes = require("./routes/RoleRoute");
const pengaturanRoutes = require("./routes/PengaturanRoute");
const jenisSimpananRoute = require("./routes/JenisSimpananRoute");
const jenisTabunganRoute = require("./routes/JenisTabunganRoute");
const jenisPiutangRoute = require("./routes/JenisPiutangRoute");
const jenisPendapatanRoute = require("./routes/JenisPendapatanRoute");
const pinjamanRoutes = require("./routes/PinjamanRoute");
const potonganGajiRoutes = require("./routes/PotonganGajiRoute");

const bendaharaRoutes = require("./routes/BendaharaRoute");
const saldoAwalRoutes = require("./routes/SaldoAwalRoute");
const simpananAwalRoutes = require("./routes/SimpananAwalRoute");
const tabunganAwalRoutes = require("./routes/TabunganAwalRoute");
const piutangAwalRoutes = require("./routes/PiutangAwalRoute");
const transaksiRoutes = require("./routes/TransaksiRoute");
const persediaanRoutes = require("./routes/PersediaanRoute");

// ─── Import Dashboard Anggota ───────────────────────────
const anggotaDashboardRoutes = require("./routes/AnggotaDashboardRoute");

// ─── Import Models ──────────────────────────────────────
const User = require("./models/User");
const Role = require("./models/Role");
const Anggota = require("./models/Anggota");
const Akun = require("./models/Akun");
const KodeReferensi = require("./models/KodeReferensi");
const Transaksi = require("./models/Transaksi");
const Jurnal = require("./models/Jurnal");
const Pinjaman = require("./models/Pinjaman");
const PengaturanWebsite = require("./models/PengaturanWebsite");
const SimpananAwal = require("./models/SimpananAwal");
const TabunganAwal = require("./models/TabunganAwal");
const PiutangAwal = require("./models/PiutangAwal");
const BukuPersediaan = require("./models/BukuPersediaan");
const PenjualanDetail = require("./models/PenjualanDetail");
const JenisSimpanan = require("./models/JenisSimpanan");
const JenisTabungan = require("./models/JenisTabungan");
const JenisPiutang = require("./models/JenisPiutang");
const JenisPendapatan = require("./models/JenisPendapatan");
const PotonganGaji = require("./models/PotonganGaji");

// ─── Inisialisasi App ───────────────────────────────────
const app = express();

// ============================================================
// CORS
// ============================================================

// Domain frontend production
const allowedOrigins = [
  "http://lapkeu-fona.site",
  "https://lapkeu-fona.site",
  "http://www.lapkeu-fona.site",
  "https://www.lapkeu-fona.site",

  // Development
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Request tanpa Origin, misalnya Postman/server-side
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("⚠️ Origin ditolak CORS:", origin);

      return callback(new Error("Origin tidak diizinkan oleh CORS"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  })
);

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================================
// STATIC FILES
// ============================================================

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "..", "public", "uploads")
  )
);

// ============================================================
// DEFINISI RELASI
// ============================================================

// ─── User & Role ─────────────────────────────────────────
User.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

Role.hasMany(User, {
  foreignKey: "role_id",
});

// ─── User & Anggota ──────────────────────────────────────
User.belongsTo(Anggota, {
  foreignKey: "anggota_id",
  as: "anggota",
});

Anggota.hasOne(User, {
  foreignKey: "anggota_id",
  as: "user",
});

// ─── Anggota & Transaksi & Pinjaman ──────────────────────
Anggota.hasMany(Transaksi, {
  foreignKey: "anggota_id",
  as: "transaksiList",
});

Anggota.hasMany(Pinjaman, {
  foreignKey: "anggota_id",
  as: "pinjamanList",
});

Transaksi.belongsTo(Anggota, {
  foreignKey: "anggota_id",
  as: "anggotaDetail",
});

Pinjaman.belongsTo(Anggota, {
  foreignKey: "anggota_id",
  as: "anggota",
});

// ============================================================
// RELASI SIMPANAN AWAL
// ============================================================

SimpananAwal.belongsTo(Anggota, {
  foreignKey: "anggota_id",
  as: "anggota",
});

Anggota.hasMany(SimpananAwal, {
  foreignKey: "anggota_id",
  as: "simpananAwalList",
});

SimpananAwal.belongsTo(JenisSimpanan, {
  foreignKey: "jenis_simpanan_id",
  as: "jenis_simpanan",
});

JenisSimpanan.hasMany(SimpananAwal, {
  foreignKey: "jenis_simpanan_id",
  as: "simpananAwalList",
});

// ============================================================
// RELASI TABUNGAN AWAL
// ============================================================

TabunganAwal.belongsTo(Anggota, {
  foreignKey: "anggota_id",
  as: "anggota",
});

Anggota.hasMany(TabunganAwal, {
  foreignKey: "anggota_id",
  as: "tabunganAwalList",
});

TabunganAwal.belongsTo(JenisTabungan, {
  foreignKey: "jenis_tabungan_id",
  as: "jenis_tabungan",
});

JenisTabungan.hasMany(TabunganAwal, {
  foreignKey: "jenis_tabungan_id",
  as: "tabunganAwalList",
});

// ============================================================
// RELASI PIUTANG AWAL
// ============================================================

PiutangAwal.belongsTo(Anggota, {
  foreignKey: "anggota_id",
  as: "anggota",
});

Anggota.hasMany(PiutangAwal, {
  foreignKey: "anggota_id",
  as: "piutangAwalList",
});

PiutangAwal.belongsTo(JenisPiutang, {
  foreignKey: "jenis_piutang_id",
  as: "jenis_piutang",
});

JenisPiutang.hasMany(PiutangAwal, {
  foreignKey: "jenis_piutang_id",
  as: "piutangAwalList",
});

// ============================================================
// RELASI TRANSAKSI & JURNAL
// ============================================================

Transaksi.hasMany(Jurnal, {
  foreignKey: "transaksi_id",
  as: "jurnalList",
});

Jurnal.belongsTo(Transaksi, {
  foreignKey: "transaksi_id",
  as: "transaksi",
});

// ============================================================
// RELASI JURNAL & AKUN
// ============================================================

Jurnal.belongsTo(Akun, {
  foreignKey: "akun_id",
  as: "akun",
});

Akun.hasMany(Jurnal, {
  foreignKey: "akun_id",
  as: "jurnalList",
});

// ============================================================
// RELASI TRANSAKSI & AKUN
// ============================================================

Transaksi.belongsTo(Akun, {
  foreignKey: "akun_id",
  as: "akunData",
});

Transaksi.belongsTo(Akun, {
  foreignKey: "akun_debet_id",
  as: "akunDebet",
});

Transaksi.belongsTo(Akun, {
  foreignKey: "akun_kredit_id",
  as: "akunKredit",
});

// ============================================================
// RELASI KODE REFERENSI & AKUN
// ============================================================

KodeReferensi.belongsTo(Akun, {
  foreignKey: "akun_debet_id",
  as: "akunDebet",
});

KodeReferensi.belongsTo(Akun, {
  foreignKey: "akun_kredit_id",
  as: "akunKredit",
});

KodeReferensi.hasMany(Transaksi, {
  foreignKey: "kode_referensi_id",
  as: "transaksiList",
});

Transaksi.belongsTo(KodeReferensi, {
  foreignKey: "kode_referensi_id",
  as: "referensi",
});

// ============================================================
// RELASI TRANSAKSI & USER
// ============================================================

Transaksi.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

User.hasMany(Transaksi, {
  foreignKey: "user_id",
  as: "transaksiList",
});

// ============================================================
// RELASI PERSEDIAAN
// ============================================================

BukuPersediaan.belongsTo(Transaksi, {
  foreignKey: "transaksi_pembelian_id",
  as: "transaksiPembelian",
});

BukuPersediaan.belongsTo(Transaksi, {
  foreignKey: "transaksi_penjualan_id",
  as: "transaksiPenjualan",
});

Transaksi.hasMany(BukuPersediaan, {
  foreignKey: "transaksi_pembelian_id",
  as: "pembelianBarang",
});

Transaksi.hasMany(BukuPersediaan, {
  foreignKey: "transaksi_penjualan_id",
  as: "penjualanBarang",
});

PenjualanDetail.belongsTo(Transaksi, {
  foreignKey: "transaksi_id",
  as: "transaksi",
});

PenjualanDetail.belongsTo(BukuPersediaan, {
  foreignKey: "barang_id",
  as: "barang",
});

Transaksi.hasMany(PenjualanDetail, {
  foreignKey: "transaksi_id",
  as: "penjualanDetail",
});

BukuPersediaan.hasMany(PenjualanDetail, {
  foreignKey: "barang_id",
  as: "penjualanDetail",
});

// ============================================================
// RELASI TRANSAKSI KE MASTER JENIS
// ============================================================

Transaksi.belongsTo(JenisSimpanan, {
  foreignKey: "jenis_simpanan_id",
  as: "jenisSimpanan",
});

Transaksi.belongsTo(JenisTabungan, {
  foreignKey: "jenis_tabungan_id",
  as: "jenisTabungan",
});

Transaksi.belongsTo(JenisPiutang, {
  foreignKey: "jenis_piutang_id",
  as: "jenisPiutang",
});

Transaksi.belongsTo(JenisPendapatan, {
  foreignKey: "jenis_pendapatan_id",
  as: "jenisPendapatan",
});

// ============================================================
// RELASI POTONGAN GAJI
// ============================================================

PotonganGaji.belongsTo(Anggota, {
  foreignKey: "anggota_id",
  as: "anggota",
});

Anggota.hasMany(PotonganGaji, {
  foreignKey: "anggota_id",
  as: "potonganGajiList",
});

// ============================================================
// ROUTES
// ============================================================

app.use("/api/auth", authRoutes);

app.use("/api/wilayah", wilayahRoutes);

app.use("/api/admin/dashboard", adminDashboardRoutes);

app.use("/api/anggota", anggotaRoutes);

app.use("/api/akun", akunRoutes);

app.use("/api/referensi", kodeReferensiRoutes);

app.use("/api/persentase-shu", persentaseShuRoutes);

app.use("/api/users", userRoutes);

app.use("/api/roles", roleRoutes);

app.use("/api/pengaturan", pengaturanRoutes);

app.use(
  "/api/pengaturan/jenis-simpanan",
  jenisSimpananRoute
);

app.use(
  "/api/pengaturan/jenis-tabungan",
  jenisTabunganRoute
);

app.use(
  "/api/pengaturan/jenis-piutang",
  jenisPiutangRoute
);

app.use(
  "/api/pengaturan/jenis-pendapatan",
  jenisPendapatanRoute
);

app.use("/api/saldo-awal", saldoAwalRoutes);

app.use("/api/simpanan-awal", simpananAwalRoutes);

app.use("/api/tabungan-awal", tabunganAwalRoutes);

app.use("/api/piutang-awal", piutangAwalRoutes);

app.use("/api/transaksi", transaksiRoutes);

app.use("/api/bendahara", bendaharaRoutes);

app.use("/api/pinjaman", pinjamanRoutes);

app.use("/api/persediaan", persediaanRoutes);

app.use("/api/potongan-gaji", potonganGajiRoutes);

// ============================================================
// DASHBOARD ANGGOTA
// ============================================================

app.use(
  "/api/anggota-koperasi",
  anggotaDashboardRoutes
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server koperasi berjalan dengan baik 🚀",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// 404 HANDLER (khusus untuk /api yang tidak ditemukan)
// ============================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    message: "Endpoint tidak ditemukan",
    path: req.originalUrl,
  });
});

// ============================================================
// SERVE FRONTEND (hasil build Vite)
// ============================================================

app.use(express.static(path.join(__dirname, "..", "public")));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error("❌ ERROR SERVER:");
  console.error(err.stack);

  res.status(500).json({
    message: "Terjadi kesalahan pada server",
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});

// ============================================================
// EXPORT APP
// ============================================================

module.exports = app;