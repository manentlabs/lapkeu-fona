// src/controllers/AdminDashboardController.js
const Anggota = require("../models/Anggota");
const Akun = require("../models/Akun");
const User = require("../models/User");
const KodeReferensi = require("../models/KodeReferensi");
const PersentaseShu = require("../models/PersentaseShu");
const sequelize = require("../config/database");
const { Op } = require("sequelize");

exports.index = async (req, res) => {
  try {
    // Anggota
    const totalAnggota = await Anggota.count();
    const anggotaAktif = await Anggota.count({ where: { status: "aktif" } });
    const anggotaNonaktif = await Anggota.count({ where: { status: "nonaktif" } });

    // Akun
    const totalAkun = await Akun.count();
    const totalAkunInduk = await Akun.count({ where: { parent_id: null } });
    const totalAkunSub = await Akun.count({ where: { parent_id: { [Op.ne]: null } } });

    // User
    const totalUser = await User.count();
    const userAktif = await User.count({ where: { is_active: true } });
    const userNonaktif = await User.count({ where: { is_active: false } });

    // Kode Referensi
    const totalReferensi = await KodeReferensi.count();

    // Persentase SHU
    const totalPersentaseShu = await PersentaseShu.count();

    // Data grafik: sebaran anggota per kecamatan (top 5)
    const anggotaPerKecamatan = await Anggota.findAll({
      attributes: [
        "kecamatan",
        [sequelize.fn("COUNT", sequelize.col("id")), "jumlah"],
      ],
      where: { kecamatan: { [Op.ne]: null } },
      group: ["kecamatan"],
      order: [[sequelize.literal("jumlah"), "DESC"]],
      limit: 5,
      raw: true,
    });

    return res.json({
      totalAnggota,
      anggotaAktif,
      anggotaNonaktif,
      totalAkun,
      totalAkunInduk,
      totalAkunSub,
      totalUser,
      userAktif,
      userNonaktif,
      totalReferensi,
      totalPersentaseShu,
      grafik: {
        anggotaPerKecamatan: anggotaPerKecamatan.map((item) => ({
          label: item.kecamatan || "Tidak Diketahui",
          value: parseInt(item.jumlah),
        })),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal mengambil data dashboard." });
  }
};