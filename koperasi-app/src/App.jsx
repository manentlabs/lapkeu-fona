import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PengaturanProvider } from "./context/PengaturanContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";

import AdminHome from "./pages/admin/AdminHome";
import AnggotaPage from "./pages/admin/AnggotaPage";
import UserPage from "./pages/admin/UserPage";
import AkunPage from "./pages/admin/AkunPage";
import ReferensiPage from "./pages/admin/ReferensiPage";
import PersentaseShuPage from "./pages/admin/PersentaseShuPage";
import PengaturanPage from "./pages/admin/PengaturanPage";
import JenisSimpananPage from "./pages/admin/JenisSimpananPage";
import JenisTabunganPage from "./pages/admin/JenisTabunganPage";
import JenisPiutangPage from "./pages/admin/JenisPiutangPage";
import JenisPendapatanPage from "./pages/admin/JenisPendapatanPage";

import BendaharaHomePage from "./pages/bendahara/BendaharaHomePage";
import SaldoAwalPage from "./pages/bendahara/SaldoAwalPage";
import SimpananAwalPage from "./pages/bendahara/SimpananAwalPage";
import TabunganAwalPage from "./pages/bendahara/TabunganAwalPage";
import PiutangAwalPage from "./pages/bendahara/PiutangAwalPage";
import TransaksiFormPage from "./pages/bendahara/TransaksiFormPage";
import TransaksiIndexPage from "./pages/bendahara/TransaksiIndexPage"; 
import KalkulatorPajakPage from "./pages/bendahara/KalkulatorPajakPage";
import NeracaPage from "./pages/bendahara/NeracaPage";
import ArusKasPage from "./pages/bendahara/ArusKasPage";
import LaporanPhuPage from "./pages/bendahara/LaporanPHUPage";
import PerubahanModalPage from "./pages/bendahara/PerubahanModalPage";
import CatatanKeuanganPage from "./pages/bendahara/CatatanKeuanganPage";
import AnalisaKeuanganPage from "./pages/bendahara/AnalisaKeuanganPage";
import AlokasiSHUPage from "./pages/bendahara/AlokasiSHUPage";
import RencanaAnggaranPage from "./pages/bendahara/RencanaAnggaranPage";
import BukuBesarPage from "./pages/bendahara/BukuBesarPage";
import BukuBesarPersediaanPage from "./pages/bendahara/BukuBesarPersediaanPage";
import BukuBesarHPPPage from "./pages/bendahara/BukuBesarHPPPage";
import SimpananPage from "./pages/bendahara/SimpananPage";
import RekapSimpananAnggotaPage from "./pages/bendahara/RekapSimpananAnggotaPage";
import TabunganPage from "./pages/bendahara/TabunganPage";
import RekapTabunganAnggotaPage from "./pages/bendahara/RekapTabunganAnggotaPage";
import PiutangPage from "./pages/bendahara/PiutangPage";
import RekapPiutangAnggotaPage from "./pages/bendahara/RekapPiutangAnggotaPage";
import RekapKontribusiPage from "./pages/bendahara/RekapKontribusiPage";
import DanaShuPage from "./pages/bendahara/DanaSHUPage";
import VerifikasiPinjamanPage from "./pages/bendahara/VerifikasiPinjamanPage";
import PotonganGajiPage from "./pages/bendahara/PotonganGajiPage";

import TokoHome from "./pages/toko/TokoHome";
import PenjualanPage from "./pages/toko/PenjualanPage";
import PembelianPage from "./pages/toko/PembelianPage";
import StokPage from "./pages/toko/StokPage";

import AnggotaHomePage from "./pages/anggota/AnggotaHomePage";
import AnggotaTransaksiPage from "./pages/anggota/AnggotaTransaksiPage";
import AnggotaSimpananPage from "./pages/anggota/AnggotaSimpananPage";
import AnggotaTabunganPage from "./pages/anggota/AnggotaTabunganPage";
import AnggotaPiutangPage from "./pages/anggota/AnggotaPiutangPage";
import AnggotaPinjamanPage from "./pages/anggota/AnggotaPinjamanPage";
import AnggotaCetakKartuPage from "./pages/anggota/AnggotaCetakKartuPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PengaturanProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/dashboard/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminHome />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/anggota"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AnggotaPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/akun"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AkunPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/referensi"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ReferensiPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/persentase-shu"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <PersentaseShuPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/user"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <UserPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/pengaturan"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <PengaturanPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/pengaturan/jenis-simpanan"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <JenisSimpananPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/pengaturan/jenis-tabungan"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <JenisTabunganPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/pengaturan/jenis-piutang"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <JenisPiutangPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/pengaturan/jenis-pendapatan"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <JenisPendapatanPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara"
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <BendaharaHomePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara/saldo-awal"
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <SaldoAwalPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara/simpanan-awal"
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <SimpananAwalPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara/tabungan-awal"
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <TabunganAwalPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara/piutang-awal"
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <PiutangAwalPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara/transaksi"
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <TransaksiIndexPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/bendahara/transaksi/tambah"
              element={
                <ProtectedRoute allowedRoles={["admin", "bendahara"]}>
                  <TransaksiFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/bendahara/transaksi/edit/:id"
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <TransaksiFormPage />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard/bendahara/kalkulator-pajak" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <KalkulatorPajakPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/neraca" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <NeracaPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/arus-kas" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <ArusKasPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/phu" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <LaporanPhuPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/phu/:unit" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <LaporanPhuPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/perubahan-modal" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <PerubahanModalPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/catatan-keuangan" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <CatatanKeuanganPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/analisa-keuangan" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <AnalisaKeuanganPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/alokasi-shu" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <AlokasiSHUPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/laporan/rencana-anggaran" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <RencanaAnggaranPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/buku-besar" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <BukuBesarPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/buku-besar/persediaan" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <BukuBesarPersediaanPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/buku-besar/hpp" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <BukuBesarHPPPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/simpanan" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <SimpananPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/simpanan/anggota" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <RekapSimpananAnggotaPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/tabungan" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <TabunganPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/tabungan/anggota" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <RekapTabunganAnggotaPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/piutang" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <PiutangPage />
                </ProtectedRoute>
              } 
            />

            <Route path="/dashboard/bendahara/piutang/anggota" 
              element={
                <ProtectedRoute allowedRoles={["bendahara"]}>
                  <RekapPiutangAnggotaPage />
                </ProtectedRoute>
              } 
            />

            <Route
              path="/dashboard/bendahara/rekap-kontribusi"
              element={
                <ProtectedRoute allowedRoles={["bendahara", "admin"]}>
                  <RekapKontribusiPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara/dana-shu/:dana"
              element={
                <ProtectedRoute allowedRoles={["bendahara", "admin"]}>
                  <DanaShuPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara/verifikasi"
              element={
                <ProtectedRoute allowedRoles={["bendahara", "admin"]}>
                  <VerifikasiPinjamanPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/bendahara/potongan-gaji"
              element={
                <ProtectedRoute allowedRoles={["bendahara", "admin"]}>
                  <PotonganGajiPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/toko"
              element={
                <ProtectedRoute allowedRoles={["toko"]}>
                  <TokoHome />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/toko/penjualan"
              element={
                <ProtectedRoute allowedRoles={["toko"]}>
                  <PenjualanPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/toko/pembelian"
              element={
                <ProtectedRoute allowedRoles={["toko"]}>
                  <PembelianPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/toko/stok"
              element={
                <ProtectedRoute allowedRoles={["toko"]}>
                  <StokPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/anggota-koperasi"
              element={
                <ProtectedRoute allowedRoles={["anggota"]}>
                  <AnggotaHomePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/anggota-koperasi/transaksi"
              element={
                <ProtectedRoute allowedRoles={["anggota"]}>
                  <AnggotaTransaksiPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/anggota-koperasi/simpanan"
              element={
                <ProtectedRoute allowedRoles={["anggota"]}>
                  <AnggotaSimpananPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/anggota-koperasi/tabungan"
              element={
                <ProtectedRoute allowedRoles={["anggota"]}>
                  <AnggotaTabunganPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/anggota-koperasi/piutang"
              element={
                <ProtectedRoute allowedRoles={["anggota"]}>
                  <AnggotaPiutangPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/anggota-koperasi/pinjaman"
              element={
                <ProtectedRoute allowedRoles={["anggota"]}>
                  <AnggotaPinjamanPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/anggota-koperasi/cetak-kartu"
              element={
                <ProtectedRoute allowedRoles={["anggota"]}>
                  <AnggotaCetakKartuPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </PengaturanProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
