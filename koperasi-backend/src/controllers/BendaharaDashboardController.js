// src/controllers/BendaharaDashboardController.js
const { Op, literal, Sequelize } = require("sequelize");
const sequelize = require("../config/database");
const Akun = require("../models/Akun");
const Jurnal = require("../models/Jurnal");
const Transaksi = require("../models/Transaksi");
const Anggota = require("../models/Anggota");
const Pinjaman = require("../models/Pinjaman");
const User = require("../models/User");

exports.index = async (req, res) => {
  try {
    // ---------- 1. Hitung saldo per akun (dari saldo_awal + jurnal) ----------
    const saldoAkunQuery = `
      SELECT
        a.id,
        a.kode_akun,
        a.nama_akun,
        a.tipe_akun,
        a.saldo_awal,
        COALESCE(SUM(j.debet), 0) AS total_debet,
        COALESCE(SUM(j.kredit), 0) AS total_kredit
      FROM akun a
      LEFT JOIN jurnal j ON a.id = j.akun_id
      GROUP BY a.id
    `;
    const saldoAkun = await sequelize.query(saldoAkunQuery, {
      type: Sequelize.QueryTypes.SELECT,
    });

    // Fungsi menghitung saldo berdasarkan tipe akun
    const hitungSaldo = (row) => {
      const { tipe_akun, saldo_awal, total_debet, total_kredit } = row;
      const debet = parseFloat(total_debet) || 0;
      const kredit = parseFloat(total_kredit) || 0;
      const awal = parseFloat(saldo_awal) || 0;

      if (tipe_akun === "aset" || tipe_akun === "beban") {
        return awal + debet - kredit;
      } else if (tipe_akun === "kewajiban" || tipe_akun === "modal" || tipe_akun === "pendapatan") {
        return awal + kredit - debet;
      }
      return 0;
    };

    let totalAset = 0,
      totalKewajiban = 0,
      totalModal = 0;
    let pendapatanPeriod = 0,
      bebanPeriod = 0;

    saldoAkun.forEach((row) => {
      const saldo = hitungSaldo(row);
      const tipe = row.tipe_akun;
      const debet = parseFloat(row.total_debet) || 0;
      const kredit = parseFloat(row.total_kredit) || 0;

      if (tipe === "aset") totalAset += saldo;
      else if (tipe === "kewajiban") totalKewajiban += saldo;
      else if (tipe === "modal") totalModal += saldo;
      else if (tipe === "pendapatan") {
        pendapatanPeriod += kredit;
      } else if (tipe === "beban") {
        bebanPeriod += debet;
      }
    });

    // ---------- 2. Data Anggota ----------
    const totalAnggota = await Anggota.count();
    const anggotaAktif = await Anggota.count({ where: { status: "aktif" } });
    const anggotaNonaktif = await Anggota.count({ where: { status: "nonaktif" } });

    // ---------- 3. Data Pinjaman ----------
    const totalPinjaman = await Pinjaman.count();
    const pinjamanAktif = await Pinjaman.count({ where: { status: "aktif" } });
    const pinjamanLunas = await Pinjaman.count({ where: { status: "lunas" } });
    const totalPlafon = (await Pinjaman.sum("plafon")) || 0;
    const totalPiutangAktif = (await Pinjaman.sum("plafon", { where: { status: "aktif" } })) || 0;

    // ---------- 4. Data Simpanan (dari akun) ----------
    const simpananPokok = saldoAkun.find((row) => row.kode_akun === "3110");
    const simpananWajib = saldoAkun.find((row) => row.kode_akun === "3120");
    const simpananSukarela = saldoAkun.find((row) => row.kode_akun === "2101");

    const totalSimpananPokok = simpananPokok ? hitungSaldo(simpananPokok) : 0;
    const totalSimpananWajib = simpananWajib ? hitungSaldo(simpananWajib) : 0;
    const totalSimpananSukarela = simpananSukarela ? hitungSaldo(simpananSukarela) : 0;
    const totalSimpanan = totalSimpananPokok + totalSimpananWajib + totalSimpananSukarela;

    // ---------- 5. Data Transaksi Terbaru (5 terakhir) ----------
    const transaksiTerbaru = await Transaksi.findAll({
      attributes: ["id", "no_transaksi", "tanggal", "deskripsi", "jumlah", "created_at"],
      include: [
        {
          model: User,
          as: "user", // sudah benar di app.js
          attributes: ["name"],
        },
        {
          model: Anggota,
          as: "anggotaDetail", // ⬅️ PERBAIKAN: sesuaikan dengan definisi di app.js
          attributes: ["nama"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 5,
    });

    // ---------- 6. Data Grafik ----------
    const komposisiKeuangan = [
      { label: "Aset", value: totalAset },
      { label: "Kewajiban", value: totalKewajiban },
      { label: "Modal", value: totalModal },
    ];

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trenPendapatanBeban = await Jurnal.findAll({
      attributes: [
        [sequelize.fn("DATE_FORMAT", sequelize.col("tanggal"), "%Y-%m"), "bulan"],
        [
          sequelize.literal(`
            SUM(CASE WHEN akun.tipe_akun = 'pendapatan' THEN kredit ELSE 0 END)
          `),
          "pendapatan",
        ],
        [
          sequelize.literal(`
            SUM(CASE WHEN akun.tipe_akun = 'beban' THEN debet ELSE 0 END)
          `),
          "beban",
        ],
      ],
      include: [
        {
          model: Akun,
          as: "akun", // sudah benar di app.js
          attributes: [],
        },
      ],
      where: {
        tanggal: { [Op.gte]: sixMonthsAgo },
      },
      group: [sequelize.fn("DATE_FORMAT", sequelize.col("tanggal"), "%Y-%m")],
      order: [[literal("bulan"), "ASC"]],
      raw: true,
    });

    const statusPinjaman = await Pinjaman.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "jumlah"],
      ],
      group: ["status"],
      raw: true,
    });

    // ---------- 7. Kirim Response ----------
    return res.json({
      totalAset,
      totalKewajiban,
      totalModal,
      pendapatan: pendapatanPeriod,
      beban: bebanPeriod,
      labaRugi: pendapatanPeriod - bebanPeriod,
      totalSimpanan,
      totalSimpananPokok,
      totalSimpananWajib,
      totalSimpananSukarela,
      totalPinjaman,
      pinjamanAktif,
      pinjamanLunas,
      totalPlafon,
      totalPiutangAktif,
      totalAnggota,
      anggotaAktif,
      anggotaNonaktif,
      transaksiTerbaru: transaksiTerbaru.map((t) => ({
        id: t.id,
        no_transaksi: t.no_transaksi,
        tanggal: t.tanggal,
        deskripsi: t.deskripsi,
        jumlah: t.jumlah,
        user: t.user ? t.user.name : null,
        anggota: t.anggotaDetail ? t.anggotaDetail.nama : null, // ⬅️ perhatikan aksesnya
      })),
      grafik: {
        komposisiKeuangan,
        trenPendapatanBeban: trenPendapatanBeban.map((item) => ({
          bulan: item.bulan,
          pendapatan: parseFloat(item.pendapatan) || 0,
          beban: parseFloat(item.beban) || 0,
        })),
        statusPinjaman: statusPinjaman.map((item) => ({
          label: item.status === "aktif" ? "Aktif" : "Lunas",
          value: parseInt(item.jumlah),
        })),
      },
    });
  } catch (error) {
    console.error("Error pada dashboard bendahara:", error);
    // Pastikan response selalu JSON
    return res.status(500).json({
      message: "Gagal mengambil data dashboard bendahara.",
      error: error.message, // untuk debugging (hapus di production)
    });
  }
};