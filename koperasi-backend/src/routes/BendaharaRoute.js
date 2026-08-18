const express = require('express');
const router = express.Router();
const BendaharaDashboardController = require('../controllers/BendaharaDashboardController');
const neracaController = require('../controllers/NeracaController');
const arusKasController = require('../controllers/ArusKasController');
const unitUsahaController = require('../controllers/UnitUsahaController');
const laporanPhuController = require('../controllers/LaporanPhuController');
const perubahanModalController = require('../controllers/PerubahanModalController');
const catatanKeuanganController = require('../controllers/CatatanKeuanganController');
const analisaKeuanganController = require('../controllers/AnalisaKeuanganController');
const alokasiSHUController = require('../controllers/AlokasiSHUController');
const rencanaAnggaranController = require('../controllers/RencanaAnggaranController');
const bukuBesarController = require('../controllers/BukuBesarController');
const bukuBesarPersediaanController = require('../controllers/BukuBesarPersediaanController');
const bukuBesarHPPController = require('../controllers/BukuBesarHPPController');
const simpananController = require('../controllers/SimpananController');
const rekapSimpananAnggotaController = require('../controllers/RekapSimpananAnggotaController');
const tabunganController = require('../controllers/TabunganController');
const rekapTabunganAnggotaController = require('../controllers/RekapTabunganAnggotaController');
const piutangController = require('../controllers/PiutangController');
const rekapPiutangAnggotaController = require('../controllers/RekapPiutangAnggotaController');
const rekapKontribusiController = require('../controllers/RekapKontribusiController');
const danaShuController = require('../controllers/DanaShuController');

const JenisSimpananController = require('../controllers/JenisSimpananController');
const JenisTabunganController = require('../controllers/JenisTabunganController');
const JenisPiutangController = require('../controllers/JenisPiutangController');
const JenisPendapatanController = require('../controllers/JenisPendapatanController');

const { verifyToken, checkRole } = require('../middlewares/AuthMiddleware');

router.use(verifyToken);
router.use(checkRole('bendahara', 'admin'));

// ─── Dashboard (Ringkasan Utama) ─────────────────────────────
router.get('/dashboard', BendaharaDashboardController.index);

// ─── Neraca ────────────────────────────────────────────────────
router.get('/neraca', neracaController.index.bind(neracaController));
router.get('/neraca/export', neracaController.export.bind(neracaController));

router.get('/arus-kas', arusKasController.index.bind(arusKasController));
router.get('/arus-kas/export', arusKasController.export.bind(arusKasController));

router.get("/units", unitUsahaController.index.bind(unitUsahaController));

// ─── PHU ──────────────────────────────────────────────────────
router.get('/phu', laporanPhuController.index.bind(laporanPhuController));
router.get('/phu/export', laporanPhuController.export.bind(laporanPhuController));

router.get('/perubahan-modal', perubahanModalController.index.bind(perubahanModalController));
router.get('/perubahan-modal/export', perubahanModalController.export.bind(perubahanModalController));

router.get('/catatan-keuangan', catatanKeuanganController.index.bind(catatanKeuanganController));
router.get('/catatan-keuangan/export', catatanKeuanganController.export.bind(catatanKeuanganController));

router.get('/analisa-keuangan', analisaKeuanganController.index.bind(analisaKeuanganController));
router.get('/analisa-keuangan/export', analisaKeuanganController.export.bind(analisaKeuanganController));

// ─── Alokasi SHU ─────────────────────────────────────────────
router.get('/alokasi-shu', alokasiSHUController.index.bind(alokasiSHUController));
router.get('/alokasi-shu/export', alokasiSHUController.export.bind(alokasiSHUController));

// CRUD Alokasi Persentase (jasa)
router.get('/alokasi-shu/persentase', alokasiSHUController.getAlokasiPersentase.bind(alokasiSHUController));
router.post('/alokasi-shu/persentase', alokasiSHUController.storeAlokasiPersentase.bind(alokasiSHUController));
router.put('/alokasi-shu/persentase/:id', alokasiSHUController.updateAlokasiPersentase.bind(alokasiSHUController));
router.delete('/alokasi-shu/persentase/:id', alokasiSHUController.destroyAlokasiPersentase.bind(alokasiSHUController));

// ─── Rencana Anggaran ──────────────────────────────────────
router.get('/rencana-anggaran', rencanaAnggaranController.index.bind(rencanaAnggaranController));
router.post('/rencana-anggaran', rencanaAnggaranController.store.bind(rencanaAnggaranController));
router.get('/rencana-anggaran/export', rencanaAnggaranController.export.bind(rencanaAnggaranController));

// ─── Buku Besar ──────────────────────────────────────────────
router.get('/buku-besar', bukuBesarController.index.bind(bukuBesarController));
router.get('/buku-besar/export', bukuBesarController.export.bind(bukuBesarController));

// ─── Buku Besar Persediaan ───────────────────────────────────
router.get('/buku-besar-persediaan', bukuBesarPersediaanController.index.bind(bukuBesarPersediaanController));
router.get('/buku-besar-persediaan/export', bukuBesarPersediaanController.export.bind(bukuBesarPersediaanController));

// ─── Buku Besar HPP ──────────────────────────────────────────
router.get('/buku-besar-hpp', bukuBesarHPPController.index.bind(bukuBesarHPPController));
router.get('/buku-besar-hpp/export', bukuBesarHPPController.export.bind(bukuBesarHPPController));

// ─── Simpanan ────────────────────────────────────────────────
router.get('/simpanan', simpananController.index.bind(simpananController));
router.get('/simpanan/export', simpananController.export.bind(simpananController));

// ─── Rekap Simpanan Anggota ──────────────────────────────────
router.get('/rekap-simpanan-anggota', rekapSimpananAnggotaController.index.bind(rekapSimpananAnggotaController));
router.get('/rekap-simpanan-anggota/export', rekapSimpananAnggotaController.export.bind(rekapSimpananAnggotaController));

// ─── Tabungan ────────────────────────────────────────────────
router.get('/tabungan', tabunganController.index.bind(tabunganController));
router.get('/tabungan/export', tabunganController.export.bind(tabunganController));

// ─── Rekap Tabungan Anggota ──────────────────────────────────
router.get('/rekap-tabungan-anggota', rekapTabunganAnggotaController.index.bind(rekapTabunganAnggotaController));
router.get('/rekap-tabungan-anggota/export', rekapTabunganAnggotaController.export.bind(rekapTabunganAnggotaController));

// ─── Piutang ──────────────────────────────────────────────────
router.get('/piutang', piutangController.index.bind(piutangController));
router.get('/piutang/export', piutangController.export.bind(piutangController));

// ─── Rekap Piutang Anggota ────────────────────────────────────
router.get('/rekap-piutang-anggota', rekapPiutangAnggotaController.index.bind(rekapPiutangAnggotaController));
router.get('/rekap-piutang-anggota/export', rekapPiutangAnggotaController.export.bind(rekapPiutangAnggotaController));

// ─── Rekap Kontribusi Anggota ────────────────────────────────
router.get('/rekap-kontribusi', rekapKontribusiController.index.bind(rekapKontribusiController));
router.get('/rekap-kontribusi/export', rekapKontribusiController.export.bind(rekapKontribusiController));

// ─── Dana SHU ──────────────────────────────────────────────
router.get('/dana-shu', danaShuController.index.bind(danaShuController));
router.post('/dana-shu', danaShuController.store.bind(danaShuController));
router.put('/dana-shu/:persentase_shu_id/:id', danaShuController.update.bind(danaShuController));
router.delete('/dana-shu/:persentase_shu_id/:id', danaShuController.destroy.bind(danaShuController));
router.get('/dana-shu/export', danaShuController.export.bind(danaShuController));

// ─── Endpoint untuk mengambil daftar jenis (aktif) ──────────
router.get('/jenis-simpanan', JenisSimpananController.index.bind(JenisSimpananController));
router.get('/jenis-tabungan', JenisTabunganController.index.bind(JenisTabunganController));
router.get('/jenis-piutang', JenisPiutangController.index.bind(JenisPiutangController));
router.get('/jenis-pendapatan', JenisPendapatanController.index.bind(JenisPendapatanController));

module.exports = router;