// src/pages/bendahara/PiutangPage.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Search,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Wallet,
  PiggyBank,
  TrendingUp,
  Users,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return Math.round(num).toLocaleString("id-ID");
}

export default function PiutangPage() {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [jenisPiutang, setJenisPiutang] = useState([]);
  const [summary, setSummary] = useState({ saldo: {}, totalPiutang: 0, jumlahAnggota: 0 });
  const [daftarAnggota, setDaftarAnggota] = useState([]);
  const [daftarNoAnggota, setDaftarNoAnggota] = useState([]);

  const [filterNama, setFilterNama] = useState("");
  const [filterNoAnggota, setFilterNoAnggota] = useState("");
  const [tanggalDari, setTanggalDari] = useState("");
  const [tanggalSampai, setTanggalSampai] = useState("");
  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState("");

  const [anggotaSearch, setAnggotaSearch] = useState("");
  const [anggotaOptions, setAnggotaOptions] = useState([]);
  const [showAnggotaOptions, setShowAnggotaOptions] = useState(false);
  const [searchingAnggota, setSearchingAnggota] = useState(false);
  const anggotaTimeoutRef = useRef(null);

  const [appliedNama, setAppliedNama] = useState("");
  const [appliedNoAnggota, setAppliedNoAnggota] = useState("");
  const [appliedDari, setAppliedDari] = useState("");
  const [appliedSampai, setAppliedSampai] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedJenis, setAppliedJenis] = useState("");

  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async (page = 1, params = {}) => {
    setLoading(true);
    try {
      const queryParams = { page, per_page: 10, ...params };
      const { data } = await api.get("/bendahara/piutang", { params: queryParams });
      setData(data.data || []);
      setPagination(data.pagination || { page: 1, total_pages: 1, total: 0 });
      setSummary(data.summary || { saldo: {}, totalPiutang: 0, jumlahAnggota: 0 });
      setJenisPiutang(data.jenisPiutang || []);
      setDaftarAnggota(data.filters?.daftarAnggota || []);
      setDaftarNoAnggota(data.filters?.daftarNoAnggota || []);

      if (data.filterActive) {
        setAppliedNama(data.filterActive.nama_anggota || "");
        setAppliedNoAnggota(data.filterActive.no_anggota || "");
        setAppliedDari(data.filterActive.tanggal_dari || "");
        setAppliedSampai(data.filterActive.tanggal_sampai || "");
        setAppliedSearch(data.filterActive.search || "");
        setAppliedJenis(data.filterActive.jenis_piutang_id || "");
        setFilterNama(data.filterActive.nama_anggota || "");
        setFilterNoAnggota(data.filterActive.no_anggota || "");
        setTanggalDari(data.filterActive.tanggal_dari || "");
        setTanggalSampai(data.filterActive.tanggal_sampai || "");
        setSearch(data.filterActive.search || "");
        setFilterJenis(data.filterActive.jenis_piutang_id || "");
        if (data.filterActive.nama_anggota) {
          setAnggotaSearch(data.filterActive.nama_anggota);
        }
      }
    } catch (err) {
      console.error("Gagal fetch piutang:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, {});
  }, [fetchData]);

  // Autocomplete dan filter sama persis, hanya ganti endpoint
  // ... (salin dari SimpananPage, ganti semua "tabungan" -> "piutang", "jenis_tabungan" -> "jenis_piutang", "jenis_tabungan_id" -> "jenis_piutang_id", "total_tabungan" -> "total_piutang", "totalTabungan" -> "totalPiutang", "Jenis Tabungan" -> "Jenis Piutang")

  // Karena semua fungsi sama, saya tulis ulang dengan perubahan kata kunci.
  // Saya akan salin dari TabunganPage dan ganti semua kata kunci.

  const fetchAnggotaOptions = useCallback(async (query) => {
    if (query.length < 3) {
      setAnggotaOptions([]);
      setShowAnggotaOptions(false);
      return;
    }
    setSearchingAnggota(true);
    try {
      const { data } = await api.get("/anggota", {
        params: { search: query, status: "aktif", per_page: 5 },
      });
      setAnggotaOptions(data.data || []);
      setShowAnggotaOptions(true);
    } catch (err) {
      console.error(err);
      setAnggotaOptions([]);
    } finally {
      setSearchingAnggota(false);
    }
  }, []);

  const handleAnggotaSearch = (value) => {
    setAnggotaSearch(value);
    if (anggotaTimeoutRef.current) clearTimeout(anggotaTimeoutRef.current);
    if (value.length < 3) {
      setAnggotaOptions([]);
      setShowAnggotaOptions(false);
      if (value === "") {
        setFilterNama("");
        setFilterNoAnggota("");
      }
      return;
    }
    anggotaTimeoutRef.current = setTimeout(() => {
      fetchAnggotaOptions(value);
    }, 300);
  };

  const selectAnggota = (anggota) => {
    setFilterNama(anggota.nama);
    setFilterNoAnggota(anggota.no_anggota);
    setAnggotaSearch(`${anggota.no_anggota} - ${anggota.nama}`);
    setShowAnggotaOptions(false);
  };

  const applyFilters = () => {
    const params = {};
    if (filterNama) params.nama_anggota = filterNama;
    if (filterNoAnggota) params.no_anggota = filterNoAnggota;
    if (tanggalDari) params.tanggal_dari = tanggalDari;
    if (tanggalSampai) params.tanggal_sampai = tanggalSampai;
    if (search) params.search = search;
    if (filterJenis) params.jenis_piutang_id = filterJenis;

    setAppliedNama(filterNama);
    setAppliedNoAnggota(filterNoAnggota);
    setAppliedDari(tanggalDari);
    setAppliedSampai(tanggalSampai);
    setAppliedSearch(search);
    setAppliedJenis(filterJenis);
    fetchData(1, params);
  };

  const resetFilters = () => {
    setFilterNama("");
    setFilterNoAnggota("");
    setTanggalDari("");
    setTanggalSampai("");
    setSearch("");
    setFilterJenis("");
    setAnggotaSearch("");
    setAnggotaOptions([]);
    setShowAnggotaOptions(false);
    setAppliedNama("");
    setAppliedNoAnggota("");
    setAppliedDari("");
    setAppliedSampai("");
    setAppliedSearch("");
    setAppliedJenis("");
    fetchData(1, {});
  };

  const goToPage = (page) => {
    const params = {};
    if (appliedNama) params.nama_anggota = appliedNama;
    if (appliedNoAnggota) params.no_anggota = appliedNoAnggota;
    if (appliedDari) params.tanggal_dari = appliedDari;
    if (appliedSampai) params.tanggal_sampai = appliedSampai;
    if (appliedSearch) params.search = appliedSearch;
    if (appliedJenis) params.jenis_piutang_id = appliedJenis;
    fetchData(page, params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      const params = { export: type };
      if (appliedNama) params.nama_anggota = appliedNama;
      if (appliedNoAnggota) params.no_anggota = appliedNoAnggota;
      if (appliedDari) params.tanggal_dari = appliedDari;
      if (appliedSampai) params.tanggal_sampai = appliedSampai;
      if (appliedSearch) params.search = appliedSearch;
      if (appliedJenis) params.jenis_piutang_id = appliedJenis;

      const response = await api.get("/bendahara/piutang/export", {
        params,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type: type === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
        })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `rekap-piutang-${new Date().toISOString().slice(0, 10)}.${type === "excel" ? "xlsx" : "pdf"}`;
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

  const renderPagination = () => {
    const { page, total_pages } = pagination;
    if (total_pages <= 1) return null;
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(total_pages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50">
          <ChevronLeft size={16} />
        </button>
        {start > 1 && <button onClick={() => goToPage(1)} className="h-8 w-8 rounded-lg border text-sm hover:bg-gray-50">1</button>}
        {start > 2 && <span className="px-1 text-gray-400">...</span>}
        {pages.map((p) => (
          <button key={p} onClick={() => goToPage(p)} className={`h-8 w-8 rounded-lg text-sm ${p === page ? "bg-blue-600 text-white" : "border hover:bg-gray-50"}`}>
            {p}
          </button>
        ))}
        {end < total_pages && <button onClick={() => goToPage(total_pages)} className="h-8 w-8 rounded-lg border text-sm hover:bg-gray-50">{total_pages}</button>}
        <button onClick={() => goToPage(page + 1)} disabled={page >= total_pages} className="h-8 px-3 rounded-lg border text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50">
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Rekap Piutang Anggota</h2>
              <p className="text-sm text-gray-500">Saldo piutang per anggota</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {jenisPiutang.slice(0, 2).map((j, idx) => {
            const icons = [Wallet, PiggyBank];
            const colors = ["#10b981", "#f59e0b"];
            const Icon = icons[idx % icons.length];
            const color = colors[idx % colors.length];
            const value = summary.saldo[j.kolom_key] || 0;
            return (
              <div key={j.kolom_key} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ background: color + "20" }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{j.nama}</p>
                    <p className="text-sm font-bold text-gray-800">Rp {formatRupiah(value)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><Users size={18} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Anggota Berpiutang</p>
                <p className="text-sm font-bold text-gray-800">{summary.jumlahAnggota}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100"><TrendingUp size={18} className="text-purple-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total Piutang</p>
                <p className="text-sm font-bold text-gray-800">Rp {formatRupiah(summary.totalPiutang)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Export */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button onClick={() => setFilterOpen(!filterOpen)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
            <span className="flex items-center gap-2 font-medium text-gray-700"><Search size={18} className="text-gray-500" /> Filter & Export</span>
            {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {filterOpen && (
            <div className="border-t p-4 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3"><Search size={14} /> Filter Data</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nama / No Anggota</label>
                      <div className="relative">
                        <input type="text" value={anggotaSearch} onChange={(e) => handleAnggotaSearch(e.target.value)} placeholder="Ketik minimal 3 huruf..." className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                        {showAnggotaOptions && (
                          <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {searchingAnggota ? <div className="px-3 py-2 text-sm text-gray-500">Mencari...</div> : anggotaOptions.length === 0 ? <div className="px-3 py-2 text-sm text-gray-500">Tidak ditemukan</div> : anggotaOptions.map((anggota) => (
                              <button key={anggota.id} onClick={() => selectAnggota(anggota)} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                                <span className="font-medium">{anggota.no_anggota}</span> - {anggota.nama}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tanggal Dari</label>
                      <input type="date" value={tanggalDari} onChange={(e) => setTanggalDari(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tanggal Sampai</label>
                      <input type="date" value={tanggalSampai} onChange={(e) => setTanggalSampai(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Jenis Piutang</label>
                      <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Semua --</option>
                        {jenisPiutang.map((j) => <option key={j.id} value={j.id}>{j.nama}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={applyFilters} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Search size={15} /> Terapkan</button>
                    <button onClick={resetFilters} className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"><XCircle size={15} /> Reset</button>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-xs font-semibold uppercase text-gray-500 flex items-center gap-2 mb-3"><FileSpreadsheet size={14} /> Export</p>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => handleExport("excel")} disabled={exporting} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"><FileSpreadsheet size={15} /> {exporting ? "Mengekspor..." : "Excel"}</button>
                    <button onClick={() => handleExport("pdf")} disabled={exporting} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"><FileText size={15} /> {exporting ? "Mengekspor..." : "PDF"}</button>
                  </div>
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1"><AlertCircle size={12} /> Export dengan filter aktif</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pencarian Cepat */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-500">Cari anggota</label>
              <input type="text" placeholder="Ketik nama atau no anggota..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()} className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={applyFilters} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Search size={15} /> Cari</button>
              <button onClick={resetFilters} className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><XCircle size={15} /> Reset</button>
            </div>
          </div>
          {(appliedNama || appliedNoAnggota || appliedDari || appliedSampai || appliedSearch || appliedJenis) && (
            <p className="mt-3 text-sm text-gray-500">
              Filter: {appliedNama && <span className="font-medium">Nama "{appliedNama}" </span>}
              {appliedNoAnggota && <span className="font-medium">No "{appliedNoAnggota}" </span>}
              {appliedDari && <span className="font-medium">dari {appliedDari} </span>}
              {appliedSampai && <span className="font-medium">sampai {appliedSampai} </span>}
              {appliedSearch && <span className="font-medium">Cari "{appliedSearch}" </span>}
              {appliedJenis && <span className="font-medium">Jenis: {jenisPiutang.find(j => String(j.id) === appliedJenis)?.nama || appliedJenis}</span>}
            </p>
          )}
        </div>

        {/* Tabel */}
        <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-100 lg:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 text-center">NO</th>
                <th className="px-4 py-3">No Anggota</th>
                <th className="px-4 py-3">Nama Anggota</th>
                {jenisPiutang.map((j) => <th key={j.kolom_key} className="px-4 py-3 text-right">{j.nama}</th>)}
                <th className="px-4 py-3 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={jenisPiutang.length + 4} className="px-4 py-6 text-center text-gray-400"><Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={jenisPiutang.length + 4} className="px-4 py-6 text-center text-gray-400">Tidak ada data.</td></tr>
              ) : (
                data.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-center">{(pagination.page - 1) * 10 + idx + 1}</td>
                    <td className="px-4 py-3">{item.no_anggota}</td>
                    <td className="px-4 py-3 font-medium">{item.nama}</td>
                    {jenisPiutang.map((j) => <td key={j.kolom_key} className="px-4 py-3 text-right font-mono">{formatRupiah(item[j.kolom_key] || 0)}</td>)}
                    <td className="px-4 py-3 text-right font-bold text-green-700">Rp {formatRupiah(item.total_piutang || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right">TOTAL</td>
                  {jenisPiutang.map((j) => {
                    const total = data.reduce((sum, item) => sum + (parseFloat(item[j.kolom_key]) || 0), 0);
                    return <td key={j.kolom_key} className="px-4 py-3 text-right font-mono">{formatRupiah(total)}</td>;
                  })}
                  <td className="px-4 py-3 text-right font-mono text-green-700">
                    Rp {formatRupiah(data.reduce((sum, item) => { let totalItem = 0; jenisPiutang.forEach(j => totalItem += parseFloat(item[j.kolom_key]) || 0); return sum + totalItem; }, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile */}
        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="text-center py-8 text-gray-400"><Loader className="animate-spin inline-block mr-2" size={20} /> Memuat...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Tidak ada data.</div>
          ) : (
            data.map((item) => (
              <div key={item.id || Math.random()} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="flex items-start justify-between">
                  <div><p className="font-semibold">{item.nama}</p><p className="text-xs text-gray-500">{item.no_anggota}</p></div>
                  <div className="text-right"><p className="text-xs text-gray-500">Total</p><p className="font-bold text-green-700">Rp {formatRupiah(item.total_piutang || 0)}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
                  {jenisPiutang.map((j) => (
                    <div key={j.kolom_key} className="flex justify-between border-b py-1">
                      <span className="text-gray-500">{j.nama}</span>
                      <span className="font-mono">Rp {formatRupiah(item[j.kolom_key] || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {!loading && data.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100 sm:flex-row sm:justify-between">
            <p className="text-sm text-gray-500">Menampilkan {(pagination.page - 1) * 10 + 1}–{Math.min(pagination.page * 10, pagination.total)} dari {pagination.total}</p>
            {renderPagination()}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}