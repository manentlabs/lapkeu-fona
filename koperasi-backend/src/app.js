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
const userRoutes = require("./routes/userRoute");
const roleRoutes = require("./routes/roleRoute");
const pengaturanRoutes = require("./routes/PengaturanRoute");
const jenisSimpananRoute = require("./routes/JenisSimpananRoute");
const jenisTabunganRoute = require("./routes/JenisTabunganRoute");
const jenisPiutangRoute = require("./routes/JenisPiutangRoute");
const jenisPendapatanRoute = require("./routes/JenisPendapatanRoute");
const pinjamanRoutes = require("./routes/PinjamanRoute");
const potonganGajiRoutes = require("./routes/PotonganGajiRoute");

const bendaharaRoutes = require('./routes/BendaharaRoute');
const saldoAwalRoutes = require("./routes/SaldoAwalRoute");
const simpananAwalRoutes = require("./routes/SimpananAwalRoute");
const tabunganAwalRoutes = require("./routes/TabunganAwalRoute");
const piutangAwalRoutes = require("./routes/PiutangAwalRoute");
const transaksiRoutes = require("./routes/TransaksiRoute");
const persediaanRoutes = require("./routes/PersediaanRoute");

// ─── Import Dashboard Anggota (terpisah) ──────────────
const anggotaDashboardRoutes = require('./routes/AnggotaDashboardRoute');

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
const PenjualanDetail = require('./models/PenjualanDetail');
const JenisSimpanan = require("./models/JenisSimpanan");
const JenisTabungan = require("./models/JenisTabungan");
const JenisPiutang = require("./models/JenisPiutang");
const JenisPendapatan = require("./models/JenisPendapatan");
const PotonganGaji = require("./models/PotonganGaji");

// ─── Inisialisasi App ───────────────────────────────────
const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", "public", "uploads")));

// ─── Definisi Relasi ─────────────────────────────────────
// User & Role
User.belongsTo(Role, { foreignKey: "role_id", as: "role" });
Role.hasMany(User, { foreignKey: "role_id" });

// User & Anggota
User.belongsTo(Anggota, { foreignKey: "anggota_id", as: "anggota" });
Anggota.hasOne(User, { foreignKey: "anggota_id", as: "user" });

// Anggota & Transaksi & Pinjaman
Anggota.hasMany(Transaksi, { foreignKey: "anggota_id", as: "transaksiList" });
Anggota.hasMany(Pinjaman, { foreignKey: "anggota_id", as: "pinjamanList" });
Transaksi.belongsTo(Anggota, { foreignKey: "anggota_id", as: "anggotaDetail" });
Pinjaman.belongsTo(Anggota, { foreignKey: "anggota_id", as: "anggota" });

// ─── Relasi SimpananAwal ────────────────────────────────
SimpananAwal.belongsTo(Anggota, { foreignKey: "anggota_id", as: "anggota" });
Anggota.hasMany(SimpananAwal, { foreignKey: "anggota_id", as: "simpananAwalList" });

SimpananAwal.belongsTo(JenisSimpanan, { foreignKey: "jenis_simpanan_id", as: "jenis_simpanan" });
JenisSimpanan.hasMany(SimpananAwal, { foreignKey: "jenis_simpanan_id", as: "simpananAwalList" });

// ─── Relasi TabunganAwal ────────────────────────────────
TabunganAwal.belongsTo(Anggota, { foreignKey: "anggota_id", as: "anggota" });
Anggota.hasMany(TabunganAwal, { foreignKey: "anggota_id", as: "tabunganAwalList" });

TabunganAwal.belongsTo(JenisTabungan, { foreignKey: "jenis_tabungan_id", as: "jenis_tabungan" });
JenisTabungan.hasMany(TabunganAwal, { foreignKey: "jenis_tabungan_id", as: "tabunganAwalList" });

// ─── Relasi PiutangAwal ──────────────────────────────────
PiutangAwal.belongsTo(Anggota, { foreignKey: "anggota_id", as: "anggota" });
Anggota.hasMany(PiutangAwal, { foreignKey: "anggota_id", as: "piutangAwalList" });

PiutangAwal.belongsTo(JenisPiutang, { foreignKey: "jenis_piutang_id", as: "jenis_piutang" });
JenisPiutang.hasMany(PiutangAwal, { foreignKey: "jenis_piutang_id", as: "piutangAwalList" });

// ─── Relasi lainnya ─────────────────────────────────────
// Transaksi & Jurnal
Transaksi.hasMany(Jurnal, { foreignKey: "transaksi_id", as: "jurnalList" });
Jurnal.belongsTo(Transaksi, { foreignKey: "transaksi_id", as: "transaksi" });

// Jurnal & Akun
Jurnal.belongsTo(Akun, { foreignKey: "akun_id", as: "akun" });
Akun.hasMany(Jurnal, { foreignKey: "akun_id", as: "jurnalList" });

// Transaksi & Akun
Transaksi.belongsTo(Akun, { foreignKey: "akun_id", as: "akunData" });
Transaksi.belongsTo(Akun, { foreignKey: "akun_debet_id", as: "akunDebet" });
Transaksi.belongsTo(Akun, { foreignKey: "akun_kredit_id", as: "akunKredit" });

// KodeReferensi & Akun
KodeReferensi.belongsTo(Akun, { foreignKey: "akun_debet_id", as: "akunDebet" });
KodeReferensi.belongsTo(Akun, { foreignKey: "akun_kredit_id", as: "akunKredit" });
KodeReferensi.hasMany(Transaksi, { foreignKey: "kode_referensi_id", as: "transaksiList" });
Transaksi.belongsTo(KodeReferensi, { foreignKey: "kode_referensi_id", as: "referensi" });

// Transaksi & User
Transaksi.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(Transaksi, { foreignKey: "user_id", as: "transaksiList" });

// Persediaan
BukuPersediaan.belongsTo(Transaksi, { foreignKey: 'transaksi_pembelian_id', as: 'transaksiPembelian' });
BukuPersediaan.belongsTo(Transaksi, { foreignKey: 'transaksi_penjualan_id', as: 'transaksiPenjualan' });
Transaksi.hasMany(BukuPersediaan, { foreignKey: 'transaksi_pembelian_id', as: 'pembelianBarang' });
Transaksi.hasMany(BukuPersediaan, { foreignKey: 'transaksi_penjualan_id', as: 'penjualanBarang' });

PenjualanDetail.belongsTo(Transaksi, { foreignKey: 'transaksi_id', as: 'transaksi' });
PenjualanDetail.belongsTo(BukuPersediaan, { foreignKey: 'barang_id', as: 'barang' });
Transaksi.hasMany(PenjualanDetail, { foreignKey: 'transaksi_id', as: 'penjualanDetail' });
BukuPersediaan.hasMany(PenjualanDetail, { foreignKey: 'barang_id', as: 'penjualanDetail' });

// ─── Relasi Transaksi ke Master Jenis ──────────────────
Transaksi.belongsTo(JenisSimpanan, { foreignKey: 'jenis_simpanan_id', as: 'jenisSimpanan' });
Transaksi.belongsTo(JenisTabungan, { foreignKey: 'jenis_tabungan_id', as: 'jenisTabungan' });
Transaksi.belongsTo(JenisPiutang, { foreignKey: 'jenis_piutang_id', as: 'jenisPiutang' });
Transaksi.belongsTo(JenisPendapatan, { foreignKey: 'jenis_pendapatan_id', as: 'jenisPendapatan' });

// ─── Relasi PotonganGaji ────────────────────────────────
PotonganGaji.belongsTo(Anggota, { foreignKey: "anggota_id", as: "anggota" });
Anggota.hasMany(PotonganGaji, { foreignKey: "anggota_id", as: "potonganGajiList" });

// ─── Routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/wilayah", wilayahRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/anggota", anggotaRoutes);  // ✅ Manajemen anggota (CRUD)
app.use("/api/akun", akunRoutes);
app.use("/api/referensi", kodeReferensiRoutes);
app.use("/api/persentase-shu", persentaseShuRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/pengaturan", pengaturanRoutes);
app.use("/api/pengaturan/jenis-simpanan", jenisSimpananRoute);
app.use("/api/pengaturan/jenis-tabungan", jenisTabunganRoute);
app.use("/api/pengaturan/jenis-piutang", jenisPiutangRoute);
app.use("/api/pengaturan/jenis-pendapatan", jenisPendapatanRoute);

app.use("/api/saldo-awal", saldoAwalRoutes);
app.use("/api/simpanan-awal", simpananAwalRoutes);
app.use("/api/tabungan-awal", tabunganAwalRoutes);
app.use("/api/piutang-awal", piutangAwalRoutes);
app.use("/api/transaksi", transaksiRoutes);
app.use('/api/bendahara', bendaharaRoutes);
app.use("/api/pinjaman", pinjamanRoutes);
app.use("/api/persediaan", persediaanRoutes);
app.use("/api/potongan-gaji", potonganGajiRoutes);

// ─── Dashboard Anggota (khusus untuk role anggota) ─────
app.use("/api/anggota-koperasi", anggotaDashboardRoutes);

// ─── Health Check ────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server koperasi berjalan dengan baik 🚀",
  });
});

// ─── 404 Handler ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
});

// ─── Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Terjadi kesalahan pada server",
    error: err.message,
  });
});

module.exports = app;