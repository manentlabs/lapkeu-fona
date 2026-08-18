import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import Select from "react-select";
import {
  Plus, Trash2, Save, ChevronLeft, AlertCircle, Loader,
} from "lucide-react";

function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString("id-ID");
}

function parseRupiah(value) {
  return parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
}

let rowIdCounter = 0;
function genRowId() {
  rowIdCounter += 1;
  return `row-${Date.now()}-${rowIdCounter}`;
}

function blankRow() {
  return {
    id: genRowId(),
    akun_id: "",
    debet: "",
    kredit: "",
    keterangan: "",
    isDefault: false,
    tipe: null,
  };
}

// ✅ Fix: pastikan dropdown react-select tidak terpotong/ketutup oleh
// container yang punya overflow (mis. div.overflow-x-auto pada tabel jurnal).
// Menu di-render lewat portal ke document.body dan posisinya "fixed"
// relatif terhadap viewport, bukan parent yang scrollable.
const selectMenuPortalStyle = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

const selectPortalProps = {
  menuPortalTarget: typeof document !== "undefined" ? document.body : null,
  menuPosition: "fixed",
  styles: selectMenuPortalStyle,
};

export default function TransaksiFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    no_transaksi: "",
    tanggal: new Date().toISOString().slice(0, 10),
    deskripsi: "",
    unit_usaha: "",
    anggota_id: "",
    kode_referensi_id: "",
    // Tambahan field jenis
    jenis_simpanan_id: "",
    jenis_tabungan_id: "",
    jenis_piutang_id: "",
    jenis_pendapatan_id: "",
  });

  const [jurnal, setJurnal] = useState([]);
  const [referensiList, setReferensiList] = useState([]);
  const [anggotaList, setAnggotaList] = useState([]);
  const [akunList, setAkunList] = useState([]);

  // Data master jenis
  const [jenisSimpananList, setJenisSimpananList] = useState([]);
  const [jenisTabunganList, setJenisTabunganList] = useState([]);
  const [jenisPiutangList, setJenisPiutangList] = useState([]);
  const [jenisPendapatanList, setJenisPendapatanList] = useState([]);

  // Fetch all form data
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        // Ambil data form utama
        const { data: formData } = await api.get("/transaksi/form-data");
        if (cancelled) return;

        setReferensiList(formData.referensi || []);
        setAnggotaList(formData.anggota || []);
        setAkunList(formData.akun || []);

        // Ambil daftar jenis simpanan, tabungan, piutang, pendapatan
        const [simpananRes, tabunganRes, piutangRes, pendapatanRes] = await Promise.all([
          api.get("/pengaturan/jenis-simpanan", { params: { include_inactive: false } }),
          api.get("/pengaturan/jenis-tabungan", { params: { include_inactive: false } }),
          api.get("/pengaturan/jenis-piutang", { params: { include_inactive: false } }),
          api.get("/pengaturan/jenis-pendapatan", { params: { include_inactive: false } }),
        ]);

        setJenisSimpananList(simpananRes.data.data || []);
        setJenisTabunganList(tabunganRes.data.data || []);
        setJenisPiutangList(piutangRes.data.data || []);
        setJenisPendapatanList(pendapatanRes.data.data || []);

        if (isEdit) {
          const { data } = await api.get(`/transaksi/${id}`);
          if (cancelled) return;

          const trx = data.data;
          setForm({
            no_transaksi: trx.no_transaksi,
            tanggal: trx.tanggal,
            deskripsi: trx.deskripsi,
            unit_usaha: trx.unit_usaha || "",
            anggota_id: trx.anggota_id || "",
            kode_referensi_id: trx.kode_referensi_id || "",
            jenis_simpanan_id: trx.jenis_simpanan_id || "",
            jenis_tabungan_id: trx.jenis_tabungan_id || "",
            jenis_piutang_id: trx.jenis_piutang_id || "",
            jenis_pendapatan_id: trx.jenis_pendapatan_id || "",
          });

          const ref = referensiList.find((r) => r.id === trx.kode_referensi_id);
          const rows = trx.jurnalList.map((j) => {
            let isDefault = false;
            let tipe = null;
            if (ref) {
              if (ref.akun_debet_id && ref.akun_debet_id === j.akun_id) {
                isDefault = true;
                tipe = "debet";
              } else if (ref.akun_kredit_id && ref.akun_kredit_id === j.akun_id) {
                isDefault = true;
                tipe = "kredit";
              }
            }
            return {
              id: genRowId(),
              akun_id: j.akun_id,
              debet: parseFloat(j.debet) || 0,
              kredit: parseFloat(j.kredit) || 0,
              keterangan: j.keterangan || "",
              isDefault,
              tipe,
            };
          });
          setJurnal(rows);
        } else {
          setJurnal([blankRow(), blankRow()]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            isEdit ? "Gagal mengambil data transaksi." : "Gagal mengambil data form."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  // Handle referensi change
  const handleReferensiChange = (selected) => {
    const refId = selected?.value || "";
    setForm((prev) => ({ ...prev, kode_referensi_id: refId }));

    if (refId) {
      const ref = referensiList.find((r) => r.id === refId);
      if (ref) {
        const newRows = [];
        if (ref.akun_debet_id) {
          newRows.push({
            id: genRowId(),
            akun_id: ref.akun_debet_id,
            debet: "",
            kredit: "",
            keterangan: "",
            isDefault: true,
            tipe: "debet",
          });
        }
        if (ref.akun_kredit_id) {
          newRows.push({
            id: genRowId(),
            akun_id: ref.akun_kredit_id,
            debet: "",
            kredit: "",
            keterangan: "",
            isDefault: true,
            tipe: "kredit",
          });
        }
        newRows.push(blankRow());
        setJurnal(newRows);
      }
    } else {
      setJurnal([blankRow(), blankRow()]);
    }
  };

  const addRow = () => {
    setJurnal((prev) => [...prev, blankRow()]);
  };

  const removeRow = (index) => {
    setJurnal((prev) => {
      if (prev[index].isDefault) return prev;
      if (prev.filter((r) => !r.isDefault).length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  // Locking logic for extra rows
  function getLockedSideForExtraRows(rows) {
    const defaultSides = new Set(rows.filter((r) => r.isDefault).map((r) => r.tipe));
    return defaultSides.size === 1 ? [...defaultSides][0] : null;
  }

  const handleRowChange = (index, field, value) => {
    setJurnal((prev) => {
      const lockedSide = getLockedSideForExtraRows(prev);
      return prev.map((row, i) => {
        if (i !== index) return row;
        const { isDefault, tipe } = row;
        const debetLocked = isDefault ? tipe === "kredit" : lockedSide === "debet";
        const kreditLocked = isDefault ? tipe === "debet" : lockedSide === "kredit";
        const updated = { ...row };
        if (field === "akun_id") {
          if (isDefault) return row;
          updated.akun_id = value;
        } else if (field === "debet") {
          if (debetLocked) return row;
          updated.debet = value;
          if (value) updated.kredit = "";
        } else if (field === "kredit") {
          if (kreditLocked) return row;
          updated.kredit = value;
          if (value) updated.debet = "";
        } else if (field === "keterangan") {
          updated.keterangan = value;
        }
        return updated;
      });
    });
  };

  const totalDebet = jurnal.reduce((sum, row) => sum + parseRupiah(row.debet), 0);
  const totalKredit = jurnal.reduce((sum, row) => sum + parseRupiah(row.kredit), 0);
  const balance = totalDebet - totalKredit;
  const isBalanced = Math.abs(balance) < 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (!form.tanggal || !form.deskripsi || !form.kode_referensi_id) {
      setError("Tanggal, deskripsi, dan kode referensi wajib diisi.");
      setSaving(false);
      return;
    }

    if (jurnal.some((r) => !r.akun_id)) {
      setError("Semua baris jurnal harus memilih akun.");
      setSaving(false);
      return;
    }

    if (jurnal.every((r) => parseRupiah(r.debet) === 0 && parseRupiah(r.kredit) === 0)) {
      setError("Setidaknya satu baris harus memiliki nilai.");
      setSaving(false);
      return;
    }

    if (!isBalanced) {
      setError(`Total debet (Rp ${formatRupiah(totalDebet)}) tidak sama dengan total kredit (Rp ${formatRupiah(totalKredit)}).`);
      setSaving(false);
      return;
    }

    const payload = {
      ...form,
      jurnal: jurnal.map((r) => ({
        akun_id: r.akun_id,
        debet: parseRupiah(r.debet),
        kredit: parseRupiah(r.kredit),
        keterangan: r.keterangan || null,
      })),
    };

    try {
      if (isEdit) {
        await api.put(`/transaksi/${id}`, payload);
      } else {
        await api.post("/transaksi", payload);
      }
      navigate("/dashboard/bendahara/transaksi");
    } catch (err) {
      setError(err.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin text-purple-600" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  // Options for selects
  const referensiOptions = referensiList.map((r) => ({ value: r.id, label: r.label }));
  const anggotaOptions = anggotaList.map((a) => ({ value: a.id, label: `${a.no_anggota} - ${a.nama}` }));
  const akunOptions = akunList.map((a) => ({ value: a.id, label: `${a.kode_akun} - ${a.nama_akun}` }));

  // Options for jenis
  const jenisSimpananOptions = jenisSimpananList.map((j) => ({ value: j.id, label: j.nama }));
  const jenisTabunganOptions = jenisTabunganList.map((j) => ({ value: j.id, label: j.nama }));
  const jenisPiutangOptions = jenisPiutangList.map((j) => ({ value: j.id, label: j.nama }));
  const jenisPendapatanOptions = jenisPendapatanList.map((j) => ({ value: j.id, label: j.nama }));

  const lockedSideForExtraRows = getLockedSideForExtraRows(jurnal);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {isEdit ? "Edit Transaksi" : "Tambah Transaksi"}
              </h2>
              <p className="text-sm text-gray-500">Pencatatan transaksi keuangan koperasi</p>
            </div>
            <button
              onClick={() => navigate("/dashboard/bendahara/transaksi")}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              <ChevronLeft size={16} /> Kembali
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-start gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-6">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">No. Bukti</label>
              <input
                type="text"
                value={form.no_transaksi}
                onChange={(e) => setForm({ ...form, no_transaksi: e.target.value })}
                placeholder="Kosongkan untuk otomatis"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tanggal *</label>
              <input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Deskripsi *</label>
              <textarea
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                rows="2"
                placeholder="Uraian transaksi..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Unit Usaha</label>
              <select
                value={form.unit_usaha}
                onChange={(e) => setForm({ ...form, unit_usaha: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Pilih Unit Usaha</option>
                <option value="Waserda">Waserda</option>
                <option value="Simpan Pinjam">Simpan Pinjam</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Anggota</label>
              <Select
                options={anggotaOptions}
                value={anggotaOptions.find((o) => o.value === form.anggota_id) || null}
                onChange={(opt) => setForm({ ...form, anggota_id: opt?.value || "" })}
                placeholder="Pilih anggota (opsional)"
                isClearable
                {...selectPortalProps}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Kode Referensi *</label>
              <Select
                options={referensiOptions}
                value={referensiOptions.find((o) => o.value === form.kode_referensi_id) || null}
                onChange={handleReferensiChange}
                placeholder="Pilih kode transaksi..."
                {...selectPortalProps}
              />
              <p className="text-xs text-gray-400 mt-1">
                Akun default tidak bisa diganti, hanya diisi sesuai arah (debet/kredit).
              </p>
            </div>
          </div>

          {/* ─── PILIHAN JENIS (Manual) ─── */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-700 mb-3">Jenis Transaksi (Opsional)</h4>
            <p className="text-xs text-gray-400 mb-3">
              Pilih jenis simpanan/tabungan/piutang/pendapatan yang terkait. 
              Jika tidak dipilih, sistem akan mencoba mendeteksi otomatis dari akun.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600">Jenis Simpanan</label>
                <Select
                  options={jenisSimpananOptions}
                  value={jenisSimpananOptions.find((o) => o.value === form.jenis_simpanan_id) || null}
                  onChange={(opt) => setForm({ ...form, jenis_simpanan_id: opt?.value || "" })}
                  placeholder="Pilih jenis simpanan..."
                  isClearable
                  {...selectPortalProps}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Jenis Tabungan</label>
                <Select
                  options={jenisTabunganOptions}
                  value={jenisTabunganOptions.find((o) => o.value === form.jenis_tabungan_id) || null}
                  onChange={(opt) => setForm({ ...form, jenis_tabungan_id: opt?.value || "" })}
                  placeholder="Pilih jenis tabungan..."
                  isClearable
                  {...selectPortalProps}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Jenis Piutang</label>
                <Select
                  options={jenisPiutangOptions}
                  value={jenisPiutangOptions.find((o) => o.value === form.jenis_piutang_id) || null}
                  onChange={(opt) => setForm({ ...form, jenis_piutang_id: opt?.value || "" })}
                  placeholder="Pilih jenis piutang..."
                  isClearable
                  {...selectPortalProps}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Jenis Pendapatan</label>
                <Select
                  options={jenisPendapatanOptions}
                  value={jenisPendapatanOptions.find((o) => o.value === form.jenis_pendapatan_id) || null}
                  onChange={(opt) => setForm({ ...form, jenis_pendapatan_id: opt?.value || "" })}
                  placeholder="Pilih jenis pendapatan..."
                  isClearable
                  {...selectPortalProps}
                />
              </div>
            </div>
          </div>

          {/* Jurnal */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-700">Detail Jurnal</h4>
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus size={16} /> Tambah Baris
              </button>
            </div>

            {/* 
              Catatan fix dropdown:
              overflow-x-auto tetap dipertahankan agar tabel bisa discroll
              horizontal di layar sempit. Dropdown react-select TIDAK lagi
              terpotong karena setiap <Select> di dalam tabel memakai
              menuPortalTarget={document.body} + menuPosition="fixed"
              (lihat selectPortalProps), sehingga menu di-render di luar
              elemen overflow ini, langsung ke body.
            */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Akun</th>
                    <th className="px-3 py-2 text-right">Debet</th>
                    <th className="px-3 py-2 text-right">Kredit</th>
                    <th className="px-3 py-2 text-left">Keterangan</th>
                    <th className="px-3 py-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {jurnal.map((row, idx) => {
                    const isDefault = row.isDefault;
                    const tipe = row.tipe;
                    const debetDisabled = isDefault
                      ? tipe === "kredit"
                      : lockedSideForExtraRows === "debet";
                    const kreditDisabled = isDefault
                      ? tipe === "debet"
                      : lockedSideForExtraRows === "kredit";

                    return (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 min-w-[200px]">
                          <Select
                            options={akunOptions}
                            value={akunOptions.find((o) => o.value === row.akun_id) || null}
                            onChange={(opt) => handleRowChange(idx, "akun_id", opt?.value || "")}
                            placeholder="Pilih akun..."
                            isClearable
                            isDisabled={isDefault}
                            {...selectPortalProps}
                          />
                          {isDefault && (
                            <p className="text-xs text-gray-400 mt-1">🔒 Default</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.debet ? formatRupiah(row.debet) : ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              handleRowChange(idx, "debet", raw);
                            }}
                            placeholder="0"
                            disabled={debetDisabled}
                            className={`w-32 text-right border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 ${debetDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.kredit ? formatRupiah(row.kredit) : ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              handleRowChange(idx, "kredit", raw);
                            }}
                            placeholder="0"
                            disabled={kreditDisabled}
                            className={`w-32 text-right border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 ${kreditDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.keterangan || ""}
                            onChange={(e) => handleRowChange(idx, "keterangan", e.target.value)}
                            placeholder="(opsional)"
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={isDefault || jurnal.filter(r => !r.isDefault).length <= 1}
                            className="text-red-500 hover:text-red-700 disabled:opacity-40"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-3 py-2 text-right">Total</td>
                    <td className="px-3 py-2 text-right text-green-600">
                      Rp {formatRupiah(totalDebet)}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600">
                      Rp {formatRupiah(totalKredit)}
                    </td>
                    <td className="px-3 py-2 text-center" colSpan="2">
                      <span className={isBalanced ? "text-green-600" : "text-red-600"}>
                        {isBalanced ? "✓ Balance" : `Selisih: Rp ${formatRupiah(Math.abs(balance))}`}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              * Akun default hanya bisa diisi pada sisi yang sesuai. Akun tambahan otomatis
              mengisi sisi lawannya (boleh dipecah ke beberapa akun, tidak harus 1 banding 1)
              sampai total debet dan kredit balance.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate("/dashboard/bendahara/transaksi")}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : <><Save size={18} /> Simpan</>}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}