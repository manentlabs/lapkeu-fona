// src/pages/bendahara/RekapKontribusiPage.jsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "react-router-dom";

import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";

import {
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
  FileText,
  Wallet,
  CalendarDays,
  UserRound,
  HandCoins,
  RefreshCw,
  AlertCircle,
  ReceiptText,
} from "lucide-react";

// ============================================================
// HELPER
// ============================================================

const formatRupiah = (value) => {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
};

const formatTanggal = (date) => {
  if (!date) return "-";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "-";
  }

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ============================================================
// COMPONENT
// ============================================================

export default function RekapKontribusiPage() {
  const [searchParams, setSearchParams] =
    useSearchParams();

  // ==========================================================
  // URL PARAMETER
  // ==========================================================

  const jenisPendapatanId =
    searchParams.get("jenis_pendapatan_id") || "";

  // ==========================================================
  // STATE
  // ==========================================================

  const [loading, setLoading] =
    useState(false);

  const [loadingNama, setLoadingNama] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  // Master jenis pendapatan
  const [jenisPendapatan, setJenisPendapatan] =
    useState([]);

  // Daftar anggota autocomplete
  const [namaAnggota, setNamaAnggota] =
    useState([]);

  // Anggota terpilih
  const [selectedAnggota, setSelectedAnggota] =
    useState(null);

  // Input nama anggota
  const [namaInput, setNamaInput] =
    useState("");

  // Search transaksi
  const [search, setSearch] =
    useState("");

  // Tanggal
  const [tanggalMulai, setTanggalMulai] =
    useState("");

  const [tanggalSelesai, setTanggalSelesai] =
    useState("");

  // Data transaksi
  const [transaksi, setTransaksi] =
    useState([]);

  // Detail per jenis
  const [detailPerJenis, setDetailPerJenis] =
    useState([]);

  // Grand total
  const [grandTotal, setGrandTotal] =
    useState({
      total: 0,
    });

  // Saldo awal
  const [saldoAwal, setSaldoAwal] =
    useState(0);

  // Statistik
  const [totalHariIni, setTotalHariIni] =
    useState(0);

  const [totalBulanIni, setTotalBulanIni] =
    useState(0);

  const [
    totalNominalBulanIni,
    setTotalNominalBulanIni,
  ] = useState(0);

  // Pagination
  const [page, setPage] =
    useState(1);

  const [perPage, setPerPage] =
    useState(10);

  const [totalPages, setTotalPages] =
    useState(1);

  const [totalTransaksi, setTotalTransaksi] =
    useState(0);

  // ==========================================================
  // JENIS TERPILIH
  // ==========================================================

  const jenisTerpilih = useMemo(() => {
    if (!jenisPendapatanId) {
      return null;
    }

    return jenisPendapatan.find(
      (item) =>
        Number(item.id) ===
        Number(jenisPendapatanId)
    );
  }, [
    jenisPendapatan,
    jenisPendapatanId,
  ]);

  // ==========================================================
  // FETCH MASTER JENIS PENDAPATAN
  // ==========================================================

  const fetchJenisPendapatan =
    useCallback(async () => {
      try {
        const res = await api.get(
          "/bendahara/jenis-pendapatan"
        );

        const data = Array.isArray(
          res.data?.data
        )
          ? res.data.data
          : [];

        setJenisPendapatan(data);
      } catch (err) {
        console.error(
          "Gagal mengambil jenis pendapatan:",
          err
        );

        setJenisPendapatan([]);

        setError(
          "Gagal mengambil daftar jenis kontribusi."
        );
      }
    }, []);

  // ==========================================================
  // FETCH DAFTAR NAMA
  // ==========================================================

  const fetchNamaAnggota =
    useCallback(async (searchValue = "") => {
      try {
        setLoadingNama(true);

        const params = {};

        if (searchValue) {
          params.search = searchValue;
        }

        const res = await api.get(
          "/bendahara/rekap-kontribusi",
          {
            params,
          }
        );

        setNamaAnggota(
          Array.isArray(
            res.data?.namaAnggota
          )
            ? res.data.namaAnggota
            : []
        );
      } catch (err) {
        console.error(
          "Gagal mengambil nama anggota:",
          err
        );

        setNamaAnggota([]);
      } finally {
        setLoadingNama(false);
      }
    }, []);

  // ==========================================================
  // FETCH DATA REKAP
  // ==========================================================

  const fetchData = useCallback(
    async () => {
      if (!namaInput.trim()) {
        setSelectedAnggota(null);
        setTransaksi([]);
        setDetailPerJenis([]);
        setGrandTotal({ total: 0 });
        setSaldoAwal(0);
        setTotalHariIni(0);
        setTotalBulanIni(0);
        setTotalNominalBulanIni(0);
        setTotalPages(1);
        setTotalTransaksi(0);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setSuccessMessage("");

        const params = {
          nama_anggota:
            namaInput.trim(),

          page,

          per_page: perPage,
        };

        if (jenisPendapatanId) {
          params.jenis_pendapatan_id =
            jenisPendapatanId;
        }

        if (tanggalMulai) {
          params.tanggal_mulai =
            tanggalMulai;
        }

        if (tanggalSelesai) {
          params.tanggal_selesai =
            tanggalSelesai;
        }

        if (search.trim()) {
          params.search =
            search.trim();
        }

        const res = await api.get(
          "/bendahara/rekap-kontribusi",
          {
            params,
          }
        );

        if (!res.data?.success) {
          throw new Error(
            res.data?.message ||
              "Gagal mengambil data kontribusi."
          );
        }

        setSelectedAnggota(
          res.data.selectedAnggota ||
            null
        );

        setNamaAnggota(
          Array.isArray(
            res.data.namaAnggota
          )
            ? res.data.namaAnggota
            : []
        );

        setTransaksi(
          Array.isArray(
            res.data.transaksi
          )
            ? res.data.transaksi
            : []
        );

        setDetailPerJenis(
          Array.isArray(
            res.data.detailPerJenis
          )
            ? res.data.detailPerJenis
            : []
        );

        setGrandTotal(
          res.data.grandTotal || {
            total: 0,
          }
        );

        setSaldoAwal(
          Number(
            res.data.saldoAwal || 0
          )
        );

        setTotalHariIni(
          Number(
            res.data.totalHariIni || 0
          )
        );

        setTotalBulanIni(
          Number(
            res.data.totalBulanIni || 0
          )
        );

        setTotalNominalBulanIni(
          Number(
            res.data.totalNominalBulanIni ||
              0
          )
        );

        setTotalPages(
          Number(
            res.data.totalPages || 1
          )
        );

        setTotalTransaksi(
          Number(
            res.data.totalTransaksi ||
              0
          )
        );
      } catch (err) {
        console.error(
          "Gagal mengambil data kontribusi:",
          err
        );

        setSelectedAnggota(null);
        setTransaksi([]);
        setDetailPerJenis([]);
        setGrandTotal({
          total: 0,
        });

        if (
          err.response?.status === 404
        ) {
          setError(
            err.response?.data?.message ||
              "Anggota tidak ditemukan."
          );
        } else {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Gagal mengambil data kontribusi."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [
      namaInput,
      jenisPendapatanId,
      tanggalMulai,
      tanggalSelesai,
      search,
      page,
      perPage,
    ]
  );

  // ==========================================================
  // INITIAL FETCH
  // ==========================================================

  useEffect(() => {
    fetchJenisPendapatan();
    fetchNamaAnggota("");
  }, [
    fetchJenisPendapatan,
    fetchNamaAnggota,
  ]);

  // ==========================================================
  // FETCH DATA KETIKA FILTER BERUBAH
  // ==========================================================

  useEffect(() => {
    if (!namaInput.trim()) {
      return;
    }

    fetchData();
  }, [
    fetchData,
  ]);

  // ==========================================================
  // RESET PAGE SAAT FILTER BERUBAH
  // ==========================================================

  useEffect(() => {
    setPage(1);
  }, [
    jenisPendapatanId,
    tanggalMulai,
    tanggalSelesai,
    search,
  ]);

  // ==========================================================
  // SEARCH NAMA
  // ==========================================================

  const handleNamaSearch = async (
    value
  ) => {
    setNamaInput(value);

    setPage(1);

    if (!value.trim()) {
      setSelectedAnggota(null);
      setNamaAnggota([]);
      setTransaksi([]);
      setDetailPerJenis([]);
      setGrandTotal({
        total: 0,
      });

      fetchNamaAnggota("");
      return;
    }

    await fetchNamaAnggota(value);
  };

  // ==========================================================
  // PILIH ANGGOTA
  // ==========================================================

  const handleSelectAnggota = (
    nama
  ) => {
    setNamaInput(nama);

    setNamaAnggota([]);

    setPage(1);
  };

  // ==========================================================
  // CLEAR FILTER
  // ==========================================================

  const handleReset = () => {
    setNamaInput("");

    setSelectedAnggota(null);

    setSearch("");

    setTanggalMulai("");

    setTanggalSelesai("");

    setPage(1);

    setError("");

    setSuccessMessage("");

    setTransaksi([]);

    setDetailPerJenis([]);

    setGrandTotal({
      total: 0,
    });

    setSaldoAwal(0);

    setTotalHariIni(0);

    setTotalBulanIni(0);

    setTotalNominalBulanIni(0);

    fetchNamaAnggota("");
  };

  // ==========================================================
  // GANTI JENIS MELALUI URL
  // ==========================================================

  const handleJenisChange = (
    event
  ) => {
    const value =
      event.target.value;

    if (value) {
      setSearchParams({
        jenis_pendapatan_id:
          value,
      });
    } else {
      setSearchParams({});
    }

    setPage(1);
  };

  // ==========================================================
  // EXPORT
  // ==========================================================

  const handleExport = async (
    type
  ) => {
    if (!namaInput.trim()) {
      setError(
        "Pilih nama anggota terlebih dahulu."
      );
      return;
    }

    try {
      setError("");
      setSuccessMessage("");

      const params = {
        nama_anggota:
          namaInput.trim(),

        export: type,
      };

      if (jenisPendapatanId) {
        params.jenis_pendapatan_id =
          jenisPendapatanId;
      }

      if (tanggalMulai) {
        params.tanggal_mulai =
          tanggalMulai;
      }

      if (tanggalSelesai) {
        params.tanggal_selesai =
          tanggalSelesai;
      }

      if (search.trim()) {
        params.search =
          search.trim();
      }

      const response =
        await api.get(
          "/bendahara/rekap-kontribusi/export",
          {
            params,
            responseType: "blob",
          }
        );

      const blob =
        new Blob(
          [response.data],
          {
            type:
              type === "excel"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/pdf",
          }
        );

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      const safeName =
        (
          namaInput || "anggota"
        )
          .replace(
            /[^a-z0-9]/gi,
            "-"
          )
          .toLowerCase();

      link.download =
        `kontribusi-${safeName}.${type === "excel" ? "xlsx" : "pdf"}`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );

      setSuccessMessage(
        `File ${type.toUpperCase()} berhasil dibuat.`
      );
    } catch (err) {
      console.error(
        "Gagal export:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Gagal mengekspor laporan."
      );
    }
  };

  // ==========================================================
  // DATA KARTU
  // ==========================================================

  const totalKontribusi =
    Number(
      grandTotal?.total || 0
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

          <div>
            <div className="flex items-center gap-2">
              <HandCoins className="h-6 w-6 text-blue-600" />

              <h1 className="text-2xl font-bold text-gray-800">
                Rekap Kontribusi Anggota
              </h1>
            </div>

            <p className="mt-1 text-sm text-gray-500">
              Rekap transaksi kontribusi
              anggota berdasarkan jenis
              pendapatan.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={
              loading ||
              !namaInput.trim()
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh
          </button>
        </div>

        {/* ====================================================
            JENIS KONTRIBUSI
        ==================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

          <div clazssName="mb-3 flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-blue-600" />

            <h2 className="font-semibold text-gray-800">
              Jenis Kontribusi
            </h2>
          </div>

          <select
            value={
              jenisPendapatanId
            }
            onChange={
              handleJenisChange
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">
              Semua Jenis Kontribusi
            </option>

            {jenisPendapatan.map(
              (jenis) => (
                <option
                  key={jenis.id}
                  value={jenis.id}
                >
                  {jenis.nama}
                </option>
              )
            )}
          </select>

          {jenisTerpilih && (
            <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Menampilkan:
              <span className="ml-1 font-semibold">
                {jenisTerpilih.nama}
              </span>
            </div>
          )}
        </div>

        {/* ====================================================
            FILTER
        ==================================================== */}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

          <div className="mb-4 flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" />

            <h2 className="font-semibold text-gray-800">
              Filter Rekap
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">

            {/* Nama Anggota */}

            <div className="relative lg:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Nama Anggota
              </label>

              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  type="text"
                  value={namaInput}
                  onChange={(e) =>
                    handleNamaSearch(
                      e.target.value
                    )
                  }
                  placeholder="Ketik nama anggota..."
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                {loadingNama && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
                )}

                {namaInput &&
                  !loadingNama && (
                    <button
                      type="button"
                      onClick={() =>
                        handleNamaSearch(
                          ""
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
              </div>

              {/* Autocomplete */}

              {namaInput &&
                namaAnggota.length >
                  0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">

                    {namaAnggota.map(
                      (nama, index) => (
                        <button
                          type="button"
                          key={`${nama}-${index}`}
                          onClick={() =>
                            handleSelectAnggota(
                              nama
                            )
                          }
                          className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50"
                        >
                          {nama}
                        </button>
                      )
                    )}

                  </div>
                )}
            </div>

            {/* Tanggal Mulai */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Tanggal Mulai
              </label>

              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  type="date"
                  value={
                    tanggalMulai
                  }
                  onChange={(e) =>
                    setTanggalMulai(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Tanggal Selesai */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Tanggal Selesai
              </label>

              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  type="date"
                  value={
                    tanggalSelesai
                  }
                  onChange={(e) =>
                    setTanggalSelesai(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* Search Transaksi */}

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Cari Transaksi
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="No transaksi atau uraian..."
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <XCircle className="h-4 w-4" />
                Reset Filter
              </button>
            </div>
          </div>
        </div>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="flex-1">
              {error}
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* ====================================================
            SUCCESS
        ==================================================== */}

        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {/* ====================================================
            ANGGOTA
        ==================================================== */}

        {selectedAnggota && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                  <UserRound className="h-6 w-6 text-blue-600" />
                </div>

                <div>
                  <h2 className="font-bold text-gray-800">
                    {selectedAnggota.nama}
                  </h2>

                  <p className="text-sm text-gray-500">
                    No. Anggota:{" "}
                    {selectedAnggota.no_anggota ||
                      "-"}
                  </p>

                  <p className="text-sm text-gray-500">
                    {selectedAnggota.alamat ||
                      "-"}
                  </p>
                </div>
              </div>

              {/* Export */}

              <div className="flex flex-wrap gap-2">

                <button
                  type="button"
                  onClick={() =>
                    handleExport(
                      "excel"
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleExport(
                      "pdf"
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </button>

              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            STATISTIK
        ==================================================== */}

        {selectedAnggota && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {/* Saldo Awal */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Saldo Awal
                  </p>

                  <p className="mt-1 text-xl font-bold text-gray-800">
                    {formatRupiah(
                      saldoAwal
                    )}
                  </p>
                </div>

                <div className="rounded-lg bg-blue-50 p-3">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Total Hari Ini */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Transaksi Hari Ini
                  </p>

                  <p className="mt-1 text-2xl font-bold text-gray-800">
                    {totalHariIni}
                  </p>
                </div>

                <div className="rounded-lg bg-green-50 p-3">
                  <ReceiptText className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </div>

            {/* Bulan Ini */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Transaksi Bulan Ini
                  </p>

                  <p className="mt-1 text-2xl font-bold text-gray-800">
                    {totalBulanIni}
                  </p>
                </div>

                <div className="rounded-lg bg-purple-50 p-3">
                  <CalendarDays className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Total Kontribusi */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Total Kontribusi
                  </p>

                  <p className="mt-1 text-xl font-bold text-blue-600">
                    {formatRupiah(
                      totalKontribusi
                    )}
                  </p>
                </div>

                <div className="rounded-lg bg-blue-50 p-3">
                  <HandCoins className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            DETAIL PER JENIS
        ==================================================== */}

        {selectedAnggota &&
          detailPerJenis.length >
            0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

              <div className="mb-4 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-blue-600" />

                <h2 className="font-semibold text-gray-800">
                  Ringkasan Kontribusi
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

                {detailPerJenis.map(
                  (item) => (
                    <div
                      key={
                        item.kolom_key ||
                        item.jenis
                      }
                      className={`rounded-lg border p-4 ${
                        jenisTerpilih &&
                        jenisTerpilih.kolom_key ===
                          item.kolom_key
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <p className="text-sm text-gray-500">
                        {item.jenis}
                      </p>

                      <p className="mt-1 text-lg font-bold text-gray-800">
                        {formatRupiah(
                          item.saldo_akhir
                        )}
                      </p>
                    </div>
                  )
                )}

              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-100 px-4 py-3">
                <span className="font-semibold text-gray-700">
                  Total
                </span>

                <span className="font-bold text-blue-600">
                  {formatRupiah(
                    totalKontribusi
                  )}
                </span>
              </div>
            </div>
          )}

        {/* ====================================================
            TABLE TRANSAKSI
        ==================================================== */}

        {selectedAnggota && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="font-semibold text-gray-800">
                  Riwayat Transaksi Kontribusi
                </h2>

                <p className="text-sm text-gray-500">
                  {totalTransaksi} transaksi
                </p>
              </div>

              <div className="flex items-center gap-2">

                <span className="text-sm text-gray-500">
                  Tampilkan
                </span>

                <select
                  value={perPage}
                  onChange={(e) =>
                    setPerPage(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value={10}>
                    10
                  </option>

                  <option value={25}>
                    25
                  </option>

                  <option value={50}>
                    50
                  </option>

                  <option value={100}>
                    100
                  </option>
                </select>

                <span className="text-sm text-gray-500">
                  data
                </span>
              </div>
            </div>

            {/* Loading */}

            {loading ? (
              <div className="flex min-h-[250px] items-center justify-center">

                <div className="flex flex-col items-center gap-3 text-gray-500">

                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

                  <span className="text-sm">
                    Memuat data kontribusi...
                  </span>

                </div>
              </div>
            ) : transaksi.length ===
              0 ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center text-gray-500">

                <ReceiptText className="mb-3 h-10 w-10 text-gray-300" />

                <p className="font-medium">
                  Tidak ada transaksi
                </p>

                <p className="mt-1 text-sm">
                  Tidak ditemukan transaksi
                  sesuai filter.
                </p>

              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="min-w-full text-sm">

                  <thead className="bg-gray-50">

                    <tr className="border-b border-gray-200">

                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        No
                      </th>

                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        Tanggal
                      </th>

                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        No Bukti
                      </th>

                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        Jenis
                      </th>

                      <th className="px-4 py-3 text-left font-semibold text-gray-600">
                        Uraian
                      </th>

                      <th className="px-4 py-3 text-right font-semibold text-gray-600">
                        Jumlah
                      </th>

                      <th className="px-4 py-3 text-right font-semibold text-gray-600">
                        Saldo
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {/* Saldo awal */}

                    {saldoAwal !==
                      0 && (
                      <tr className="border-b border-gray-100 bg-blue-50">

                        <td className="px-4 py-3 text-gray-500">
                          -
                        </td>

                        <td className="px-4 py-3">
                          -
                        </td>

                        <td className="px-4 py-3">
                          -
                        </td>

                        <td className="px-4 py-3">
                          -
                        </td>

                        <td className="px-4 py-3 font-semibold text-blue-700">
                          Saldo Awal
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-blue-700">
                          {formatRupiah(
                            saldoAwal
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-blue-700">
                          {formatRupiah(
                            saldoAwal
                          )}
                        </td>

                      </tr>
                    )}

                    {transaksi.map(
                      (item, index) => (
                        <tr
                          key={
                            item.id ||
                            index
                          }
                          className="border-b border-gray-100 transition hover:bg-gray-50"
                        >

                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                            {(page - 1) *
                              perPage +
                              index +
                              1}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                            {formatTanggal(
                              item.tanggal
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-700">
                            {item.no_transaksi ||
                              "-"}
                          </td>

                          <td className="px-4 py-3">

                            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                              {item.jenis_nama ||
                                "-"}
                            </span>

                          </td>

                          <td className="max-w-xs px-4 py-3 text-gray-600">
                            {item.deskripsi ||
                              "-"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-800">
                            {formatRupiah(
                              item.jumlah_efektif
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-800">
                            {formatRupiah(
                              item.saldo
                            )}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                  <tfoot>

                    <tr className="bg-gray-50">

                      <td
                        colSpan={5}
                        className="px-4 py-4 text-right font-bold text-gray-700"
                      >
                        TOTAL
                      </td>

                      <td className="px-4 py-4 text-right font-bold text-blue-600">
                        {formatRupiah(
                          transaksi.reduce(
                            (
                              total,
                              item
                            ) =>
                              total +
                              Number(
                                item.jumlah_efektif ||
                                  0
                              ),
                            0
                          )
                        )}
                      </td>

                      <td className="px-4 py-4 text-right font-bold text-blue-600">
                        {formatRupiah(
                          totalKontribusi
                        )}
                      </td>

                    </tr>

                  </tfoot>

                </table>
              </div>
            )}

            {/* ==================================================
                PAGINATION
            ================================================== */}

            {totalTransaksi >
              0 && (
              <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                <p className="text-sm text-gray-500">
                  Halaman{" "}
                  <span className="font-medium text-gray-700">
                    {page}
                  </span>{" "}
                  dari{" "}
                  <span className="font-medium text-gray-700">
                    {totalPages}
                  </span>
                </p>

                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    disabled={
                      page <= 1 ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (prev) =>
                          Math.max(
                            1,
                            prev - 1
                          )
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Sebelumnya
                  </button>

                  <button
                    type="button"
                    disabled={
                      page >=
                        totalPages ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (prev) =>
                          Math.min(
                            totalPages,
                            prev + 1
                          )
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                    <ChevronRight className="h-4 w-4" />
                  </button>

                </div>
              </div>
            )}

          </div>
        )}

        {/* ====================================================
            EMPTY STATE
        ==================================================== */}

        {!selectedAnggota &&
          !loading && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">

              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">

                <UserRound className="h-8 w-8 text-blue-500" />

              </div>

              <h3 className="font-semibold text-gray-800">
                Pilih Anggota
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
                Pilih nama anggota terlebih
                dahulu untuk melihat kartu
                kontribusi dan riwayat
                transaksinya.
              </p>

            </div>
          )}

      </div>
    </DashboardLayout>
  );
}