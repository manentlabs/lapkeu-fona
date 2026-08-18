// src/pages/bendahara/RekapPiutangAnggotaPage.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Search,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader,
  AlertCircle,
  Users,
  RefreshCw,
  User,
  X,
  Calendar,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatTanggal(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Komponen Autocomplete ──────────────────────────────
function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  label,
  required,
  loading,
  onSearch,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(inputValue.toLowerCase())
  );

  useEffect(() => {
    if (value) setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setHighlightedIndex(-1);
    if (val.length > 0) {
      setIsOpen(true);
      if (onSearch) onSearch(val);
    } else {
      setIsOpen(false);
      onChange("");
    }
  };

  const handleSelect = (option) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) inputRef.current.blur();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleClear = () => {
    setInputValue("");
    onChange("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleFocus = () => {
    if (inputValue.length > 0 && filteredOptions.length > 0) setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <User size={16} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder || "Cari anggota..."}
          className="w-full border rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoComplete="off"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader size={16} className="animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2 ${
                index === highlightedIndex ? "bg-blue-100" : ""
              }`}
            >
              <User size={14} className="text-gray-400" />
              <span>{option}</span>
            </button>
          ))}
        </div>
      )}

      {isOpen && inputValue.length > 0 && filteredOptions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
          <Users size={24} className="mx-auto mb-2 text-gray-300" />
          <p>Tidak ada anggota dengan nama "{inputValue}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Komponen Utama ──────────────────────────────────────
export default function RekapPiutangAnggotaPage() {
  const [loading, setLoading] = useState(false);
  const [searchingAnggota, setSearchingAnggota] = useState(false);
  const [error, setError] = useState(null);

  // State data dari API
  const [data, setData] = useState({
    transaksi: [],
    ringkasan: [],
    detailPerJenis: [],
    grandTotal: {},
    saldoAwal: 0,
    jenisPiutang: [],
    namaAnggota: [],
    currentPage: 1,
    totalPages: 1,
    totalTransaksi: 0,
    perPage: 10,
  });

  // Filter input
  const [selectedAnggota, setSelectedAnggota] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [search, setSearch] = useState("");
  const [jenisPiutangId, setJenisPiutangId] = useState("");

  const [exporting, setExporting] = useState(false);

  // ─── Fetch Data ──────────────────────────────────────────
  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = { page, per_page: 10 };
        if (selectedAnggota) params.nama_anggota = selectedAnggota;
        if (tanggalMulai) params.tanggal_mulai = tanggalMulai;
        if (tanggalSelesai) params.tanggal_selesai = tanggalSelesai;
        if (search) params.search = search;
        if (jenisPiutangId) params.jenis_piutang_id = jenisPiutangId;

        const response = await api.get("/bendahara/rekap-piutang-anggota", {
          params,
        });
        setData(response.data);
      } catch (err) {
        console.error("Gagal fetch:", err);
        setError(err.response?.data?.message || "Gagal memuat data.");
      } finally {
        setLoading(false);
      }
    },
    [selectedAnggota, tanggalMulai, tanggalSelesai, search, jenisPiutangId]
  );

  // ─── Load daftar anggota (untuk autocomplete) ──────────
  const loadAnggota = useCallback(async (searchQuery = "") => {
    setSearchingAnggota(true);
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      const response = await api.get("/bendahara/rekap-piutang-anggota", {
        params,
      });
      setData((prev) => ({
        ...prev,
        namaAnggota: response.data.namaAnggota || [],
        jenisPiutang: response.data.jenisPiutang || [],
      }));
    } catch (err) {
      console.error("Gagal load anggota:", err);
    } finally {
      setSearchingAnggota(false);
    }
  }, []);

  // ─── Initial Load ────────────────────────────────────────
  useEffect(() => {
    loadAnggota();
  }, [loadAnggota]);

  // ─── Auto-fetch saat anggota berubah ────────────────────
  useEffect(() => {
    if (selectedAnggota) {
      fetchData(1);
    } else {
      setData((prev) => ({
        ...prev,
        transaksi: [],
        ringkasan: [],
        detailPerJenis: [],
        grandTotal: {},
        currentPage: 1,
        totalPages: 1,
        totalTransaksi: 0,
      }));
    }
  }, [fetchData, selectedAnggota]);

  // ─── Handlers ────────────────────────────────────────────
  const handleSearchAnggota = (query) => {
    if (query.length > 0) loadAnggota(query);
    else loadAnggota();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (selectedAnggota) {
      fetchData(1);
    } else {
      const input = document.querySelector('input[placeholder="Cari anggota..."]');
      if (input) {
        input.classList.add("border-red-500");
        setTimeout(() => input.classList.remove("border-red-500"), 2000);
      }
    }
  };

  const handleReset = () => {
    setSelectedAnggota("");
    setTanggalMulai("");
    setTanggalSelesai("");
    setSearch("");
    setJenisPiutangId("");
    setData((prev) => ({
      ...prev,
      transaksi: [],
      ringkasan: [],
      detailPerJenis: [],
      grandTotal: {},
      currentPage: 1,
      totalPages: 1,
      totalTransaksi: 0,
    }));
    loadAnggota();
  };

  const goToPage = (page) => {
    fetchData(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExport = async (type) => {
    if (!selectedAnggota) {
      alert("Pilih anggota terlebih dahulu");
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("nama_anggota", selectedAnggota);
      if (tanggalMulai) params.append("tanggal_mulai", tanggalMulai);
      if (tanggalSelesai) params.append("tanggal_selesai", tanggalSelesai);
      if (search) params.append("search", search);
      if (jenisPiutangId) params.append("jenis_piutang_id", jenisPiutangId);
      params.append("export", type);

      const response = await api.get(
        `/bendahara/rekap-piutang-anggota/export?${params.toString()}`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type:
            type === "excel"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/pdf",
        })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `rekap-piutang-${selectedAnggota}-${new Date()
        .toISOString()
        .slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  };

  // ─── Render Pagination ──────────────────────────────────
  const renderPagination = () => {
    const { currentPage, totalPages } = data;
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
        >
          <ChevronLeft size={16} />
        </button>
        {start > 1 && (
          <>
            <button
              onClick={() => goToPage(1)}
              className="h-8 w-8 rounded-lg border text-sm hover:bg-gray-50"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-gray-400">...</span>}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => goToPage(p)}
            className={`h-8 w-8 rounded-lg text-sm ${
              p === currentPage
                ? "bg-blue-600 text-white"
                : "border hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
            <button
              onClick={() => goToPage(totalPages)}
              className="h-8 w-8 rounded-lg border text-sm hover:bg-gray-50"
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  // ─── Destructure ─────────────────────────────────────────
  const {
    transaksi,
    ringkasan,
    detailPerJenis,
    grandTotal,
    saldoAwal,
    jenisPiutang,
    namaAnggota,
    currentPage,
    perPage,
    totalTransaksi,
  } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Rekap Piutang Anggota</h2>
              <p className="text-sm text-gray-500">Riwayat piutang per anggota</p>
            </div>
            {selectedAnggota && (
              <span className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1">
                <User size={14} className="text-blue-600" />
                {selectedAnggota}
              </span>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <AutocompleteInput
                label="Nama Anggota"
                value={selectedAnggota}
                onChange={setSelectedAnggota}
                options={namaAnggota || []}
                placeholder="Ketik nama anggota..."
                required
                loading={searchingAnggota}
                onSearch={handleSearchAnggota}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Mulai</label>
              <input
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Selesai</label>
              <input
                type="date"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Jenis Piutang</label>
              <select
                value={jenisPiutangId}
                onChange={(e) => setJenisPiutangId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Semua Jenis --</option>
                {jenisPiutang.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cari Transaksi</label>
              <input
                type="text"
                placeholder="No bukti / uraian..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex-1"
                disabled={!selectedAnggota}
              >
                <Search size={16} /> Tampilkan
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="p-2 border rounded-lg text-gray-500 hover:bg-gray-50"
                title="Reset Filter"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </form>
        </div>

        {/* Summary Cards */}
        {selectedAnggota && detailPerJenis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {detailPerJenis.map((item) => (
              <div
                key={item.kolom_key}
                className="bg-white rounded-xl shadow-sm p-3 border border-gray-100 text-center"
              >
                <p className="text-xs text-gray-500">{item.jenis}</p>
                <p className="text-sm font-bold text-red-600">
                  Rp {formatRupiah(item.saldo_akhir)}
                </p>
              </div>
            ))}
            <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-500">Total Piutang</p>
              <p className="text-sm font-bold text-purple-600">
                Rp {formatRupiah(grandTotal.total || 0)}
              </p>
            </div>
          </div>
        )}

        {/* ─── Loading ─── */}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader className="animate-spin text-blue-600" size={32} />
          </div>
        )}

        {/* ─── Error ─── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-700">
            <AlertCircle size={32} className="mx-auto mb-2" />
            <p>{error}</p>
          </div>
        )}

        {/* ─── Tabel Transaksi ─── */}
        {!loading && !error && selectedAnggota && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-800">
                Riwayat Transaksi {selectedAnggota}
                {jenisPiutangId && (
                  <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                    {jenisPiutang.find((j) => j.id === parseInt(jenisPiutangId))?.nama || "Filtered"}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{totalTransaksi || 0} transaksi</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleExport("excel")}
                    disabled={exporting || transaksi.length === 0}
                    className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                  >
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    disabled={exporting || transaksi.length === 0}
                    className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                  >
                    <FileText size={14} /> PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">No</th>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">Tanggal</th>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">No Bukti</th>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">Jenis Piutang</th>
                    <th className="py-2 px-4 text-left text-xs font-semibold uppercase tracking-wider">Uraian</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Penambahan</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Pembayaran</th>
                    <th className="py-2 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Baris Saldo Awal */}
                  {saldoAwal > 0 && (
                    <tr className="bg-green-50">
                      <td className="py-2 px-4 text-center">-</td>
                      <td colSpan="3" className="py-2 px-4 font-semibold text-gray-700">
                        Saldo Awal Bulan Berjalan
                      </td>
                      <td className="py-2 px-4"></td>
                      <td className="py-2 px-4 text-right text-green-600 font-bold">
                        Rp {formatRupiah(saldoAwal)}
                      </td>
                      <td className="py-2 px-4 text-right">-</td>
                      <td className="py-2 px-4 text-right font-bold">
                        Rp {formatRupiah(saldoAwal)}
                      </td>
                    </tr>
                  )}

                  {transaksi.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-gray-400">
                        Tidak ada transaksi untuk periode ini.
                      </td>
                    </tr>
                  ) : (
                    transaksi.map((t, idx) => {
                      const isSaldoAwal = t.is_saldo_awal === true;
                      const jumlah = parseFloat(t.jumlah_efektif) || 0;
                      const tambah = jumlah > 0 ? jumlah : 0;
                      const kurang = jumlah < 0 ? Math.abs(jumlah) : 0;

                      return (
                        <tr
                          key={t.id || idx}
                          className={`border-b border-gray-100 hover:bg-gray-50 ${
                            isSaldoAwal ? "bg-green-50" : ""
                          }`}
                        >
                          <td className="py-2 px-4 text-sm text-gray-400">
                            {(currentPage - 1) * perPage + idx + 1}
                          </td>
                          <td className="py-2 px-4 text-sm">{formatTanggal(t.tanggal)}</td>
                          <td className="py-2 px-4 text-sm font-mono">{t.no_transaksi || "-"}</td>
                          <td className="py-2 px-4 text-sm">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${
                                isSaldoAwal
                                  ? "bg-green-100 text-green-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {t.jenis_nama || t.jenis_key || "-"}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-sm">
                            {isSaldoAwal ? (
                              <span className="font-medium text-green-600">
                                {t.deskripsi || t.akun || "-"}
                              </span>
                            ) : (
                              t.deskripsi || t.akun || "-"
                            )}
                          </td>
                          <td className="py-2 px-4 text-right text-sm text-green-600">
                            {tambah > 0 ? formatRupiah(tambah) : "-"}
                          </td>
                          <td className="py-2 px-4 text-right text-sm text-red-600">
                            {kurang > 0 ? formatRupiah(kurang) : "-"}
                          </td>
                          <td className="py-2 px-4 text-right text-sm font-mono font-bold">
                            {formatRupiah(t.saldo || 0)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalTransaksi > 0 && (
              <div className="flex flex-col items-center gap-3 p-4 border-t border-gray-100 sm:flex-row sm:justify-between">
                <p className="text-sm text-gray-500">
                  Menampilkan {(currentPage - 1) * perPage + 1}–
                  {Math.min(currentPage * perPage, totalTransaksi)} dari {totalTransaksi} transaksi
                </p>
                {renderPagination()}
              </div>
            )}
          </div>
        )}

        {/* ─── Empty State ─── */}
        {!loading && !error && !selectedAnggota && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Users size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">Cari Anggota untuk Melihat Rekap</h3>
            <p className="text-sm text-gray-400 mt-1">Ketik nama anggota pada kolom pencarian di atas</p>
          </div>
        )}

        {/* ─── Info Footer ─── */}
        {selectedAnggota && transaksi.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center text-xs text-gray-400">
            Data rekap piutang {selectedAnggota} • Periode:
            {tanggalMulai ? ` ${formatTanggal(tanggalMulai)}` : " Awal"}
            {tanggalSelesai ? ` - ${formatTanggal(tanggalSelesai)}` : " - Sekarang"}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}