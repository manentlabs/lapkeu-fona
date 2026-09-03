export const ROLES = {
  admin: {
    label: "Admin",
    path: "/dashboard/admin",
    menu: [
      { label: "Dashboard", path: "/dashboard/admin", icon: "LayoutDashboard" },
      { label: "Manajemen Anggota", path: "/dashboard/admin/anggota", icon: "IdCard" },
      { label: "Manajemen User", path: "/dashboard/admin/user", icon: "Users" },
      { label: "Bagan Akun", path: "/dashboard/admin/akun", icon: "BookOpen" },
      { label: "Referensi", path: "/dashboard/admin/referensi", icon: "Layers" },
      { label: "Persentase SHU", path: "/dashboard/admin/persentase-shu", icon: "Percent" },
      { label: "Pengaturan Website", path: "/dashboard/admin/pengaturan", icon: "Settings" },
    ],
  },

  bendahara: {
    label: "Bendahara",
    path: "/dashboard/bendahara",
    menu: [
      { type: "link", label: "Dashboard", path: "/dashboard/bendahara", icon: "LayoutDashboard" },
      { type: "link", label: "Transaksi", path: "/dashboard/bendahara/transaksi", icon: "Wallet" },
      { type: "link", label: "Kalkulator Pajak", path: "/dashboard/bendahara/kalkulator-pajak", icon: "Calculator" },

      {
        type: "group",
        label: "Pinjaman",
        icon: "HandCoins",
        children: [
          { label: "Verifikasi Pinjaman", path: "/dashboard/bendahara/verifikasi", icon: "ClipboardCheck" },        
          { label: "Potongan Gaji", path: "/dashboard/bendahara/potongan-gaji", icon: "Wallet" },
          ],
      },
      
      {
        type: "group",
        label: "Simpanan",
        icon: "PiggyBank",
        children: [
          { label: "Rekap Simpanan", path: "/dashboard/bendahara/simpanan", icon: "PiggyBank" },
          { label: "Simpanan Per Anggota", path: "/dashboard/bendahara/simpanan/anggota", icon: "Users" },
          { label: "Rekap Tabungan", path: "/dashboard/bendahara/tabungan", icon: "Landmark" },
          { label: "Tabungan Per Anggota", path: "/dashboard/bendahara/tabungan/anggota", icon: "User" },
        ],
      },

      {
        type: "group",
        label: "Piutang",
        icon: "Banknote",
        children: [
          { label: "Rekap Piutang", path: "/dashboard/bendahara/piutang", icon: "Banknote" },
          { label: "Piutang Per Anggota", path: "/dashboard/bendahara/piutang/anggota", icon: "UserCircle" },
        ],
      },

      {
        type: "group",
        label: "Kontribusi",
        icon: "Users",
        children: [],
      },

      {
        type: "group",
        label: "Dana SHU",
        icon: "PieChart",
        children: [],
      },

      {
        type: "group",
        label: "Buku Besar",
        icon: "BookOpen",
        children: [
          { label: "Buku Besar Umum", path: "/dashboard/bendahara/buku-besar", icon: "BookOpen" },
          { label: "Buku Besar Persediaan", path: "/dashboard/bendahara/buku-besar/persediaan", icon: "Package" },
          { label: "Buku Besar HPP", path: "/dashboard/bendahara/buku-besar/hpp", icon: "Coins" },
        ],
      },
      
      {
        type: "group",
        label: "Laporan",
        icon: "FileBarChart",
        children: [
          { label: "Neraca", path: "/dashboard/bendahara/laporan/neraca", icon: "FileText" },
          { label: "Arus Kas", path: "/dashboard/bendahara/laporan/arus-kas", icon: "ArrowRightLeft" },
          {
            type: "group",
            label: "Perhitungan Hasil Usaha",
            icon: "PieChart",
            children: [
              { label: "Komprehensif", path: "/dashboard/bendahara/laporan/phu", icon: "FilePieChart" },
            ],
          },
          { label: "Perubahan Modal", path: "/dashboard/bendahara/laporan/perubahan-modal", icon: "ArrowUpDown" },
          { label: "Catatan Atas Laporan Keuangan", path: "/dashboard/bendahara/laporan/catatan-keuangan", icon: "FilePenLine" },
          { label: "Analisa Kinerja Keuangan", path: "/dashboard/bendahara/laporan/analisa-keuangan", icon: "ChartBar" },
          { label: "Alokasi SHU", path: "/dashboard/bendahara/laporan/alokasi-shu", icon: "CircleDollarSign" },
          { label: "Realisasi Anggaran", path: "/dashboard/bendahara/laporan/rencana-anggaran", icon: "Target" },
        ],
      },

      {
        type: "group",
        label: "Saldo Awal",
        icon: "Landmark",
        children: [
          { label: "Akun Awal", path: "/dashboard/bendahara/saldo-awal", icon: "BookOpen" },
          { label: "Simpanan Awal", path: "/dashboard/bendahara/simpanan-awal", icon: "PiggyBank" },
          { label: "Tabungan Awal", path: "/dashboard/bendahara/tabungan-awal", icon: "Landmark" },
          { label: "Piutang Awal", path: "/dashboard/bendahara/piutang-awal", icon: "Banknote" },
        ],
      },
    ],
  },

  ketua: {
    label: "Ketua",
    path: "/dashboard/ketua",
    menu: [
      { label: "Beranda", path: "/dashboard/ketua", icon: "LayoutDashboard" },
      { label: "Persetujuan Pinjaman", path: "/dashboard/ketua/persetujuan", icon: "ThumbsUp" },
      { label: "Laporan Koperasi", path: "/dashboard/ketua/laporan", icon: "FileBarChart" },
    ],
  },

  pengawas: {
    label: "Pengawas",
    path: "/dashboard/pengawas",
    menu: [
      { label: "Beranda", path: "/dashboard/pengawas", icon: "LayoutDashboard" },
      { label: "Audit Keuangan", path: "/dashboard/pengawas/audit", icon: "ClipboardCheck" },
      { label: "Catatan Pengawasan", path: "/dashboard/pengawas/catatan", icon: "NotebookPen" },
    ],
  },

  anggota: {
    label: "Anggota",
    path: "/dashboard/anggota-koperasi",
    menu: [
      {
        type: "link",
        label: "Dashboard",
        path: "/dashboard/anggota-koperasi",
        icon: "LayoutDashboard",
      },
      {
        type: "link",
        label: "Transaksi",
        path: "/dashboard/anggota-koperasi/transaksi",
        icon: "Wallet",
      },
      {
        type: "group",
        label: "Simpanan",
        icon: "PiggyBank",
        children: [
          {
            type: "link",
            label: "Simpanan Akhir",
            path: "/dashboard/anggota-koperasi/simpanan",
            icon: "PiggyBank",
          },
          {
            type: "link",
            label: "Tabungan",
            path: "/dashboard/anggota-koperasi/tabungan",
            icon: "Landmark",
          },
          {
            type: "link",
            label: "Piutang",
            path: "/dashboard/anggota-koperasi/piutang",
            icon: "Banknote",
          },
        ],
      },
      {
        type: "link",
        label: "Pinjaman",
        path: "/dashboard/anggota-koperasi/pinjaman",
        icon: "HandCoins",
      },
      {
        type: "link",
        label: "Cetak Kartu Anggota",
        path: "/dashboard/anggota-koperasi/cetak-kartu",
        icon: "IdCard",
      },
    ],
  },

  toko: {
    label: "Toko",
    path: "/dashboard/toko",
    menu: [
      { label: "Dashboard", path: "/dashboard/toko", icon: "LayoutDashboard" },
      { label: "Penjualan", path: "/dashboard/toko/penjualan", icon: "ShoppingCart" },
      { label: "Pembelian", path: "/dashboard/toko/pembelian", icon: "Truck" },
      { label: "Stok Barang", path: "/dashboard/toko/stok", icon: "Package" },
      
    ],
  },
};

export function dashboardPathForRole(role) {
  return ROLES[role]?.path || "/login";
}