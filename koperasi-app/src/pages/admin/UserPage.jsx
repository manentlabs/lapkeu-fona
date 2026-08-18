import { useEffect, useState, useCallback, useRef } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../api/axios";
import {
  Search,
  XCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  User,
  X,
  UserPlus,
  CheckCircle,
  XCircle as XCircleIcon,
} from "lucide-react";

const emptyForm = {
  username: "",
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role_id: "",
  is_active: true,
  anggota_id: "",
};

export default function UserPage() {
  // ==================== State ====================
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Autocomplete user (untuk filter)
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Modal Form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Autocomplete Anggota di form
  const [anggotaSearch, setAnggotaSearch] = useState("");
  const [anggotaSuggestions, setAnggotaSuggestions] = useState([]);
  const [showAnggotaSuggestions, setShowAnggotaSuggestions] = useState(false);
  const [selectedAnggota, setSelectedAnggota] = useState(null);

  // Toggle password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: "", color: "" });

  // Validasi duplikat
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [roles, setRoles] = useState([]);

  const searchInputRef = useRef(null);
  const suggestionRef = useRef(null);
  const usernameDebounceRef = useRef(null);
  const emailDebounceRef = useRef(null);

  // ==================== Fetch Data ====================
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get("/users/summary");
      setSummary(data);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (page = 1, searchQuery = "") => {
    setLoading(true);
    try {
      const params = { page, per_page: 10 };
      if (searchQuery) params.search = searchQuery;
      const { data } = await api.get("/users", { params });
      setUsers(data.data);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const { data } = await api.get("/roles");
      setRoles(data.data);
    } catch {
      // fallback
    }
  }, []);

  // Autocomplete user (pencarian di filter)
  const fetchUserSuggestions = useCallback(async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSuggestLoading(true);
    try {
      const { data } = await api.get("/users/autocomplete", { params: { q: query } });
      setSuggestions(data.data || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  }, []);

  // Autocomplete Anggota
  const fetchAnggotaSuggestions = useCallback(async (query) => {
    if (!query.trim() || query.length < 2) {
      setAnggotaSuggestions([]);
      setShowAnggotaSuggestions(false);
      return;
    }
    try {
      const { data } = await api.get("/anggota/autocomplete", { params: { q: query } });
      setAnggotaSuggestions(data.data || []);
      setShowAnggotaSuggestions(true);
    } catch {
      setAnggotaSuggestions([]);
    }
  }, []);

  // Cek duplikat username
  const checkUsername = useCallback(async (username) => {
    if (!username || username.length < 2) {
      setUsernameError("");
      return;
    }
    setIsCheckingUsername(true);
    try {
      const params = { username };
      if (editingId) params.exclude_id = editingId;
      const { data } = await api.get("/users/check", { params });
      if (data.exists) {
        setUsernameError("Username sudah digunakan.");
      } else {
        setUsernameError("");
      }
    } catch {
      setUsernameError("");
    } finally {
      setIsCheckingUsername(false);
    }
  }, [editingId]);

  // Cek duplikat email
  const checkEmail = useCallback(async (email) => {
    if (!email || email.length < 3) {
      setEmailError("");
      return;
    }
    setIsCheckingEmail(true);
    try {
      const params = { email };
      if (editingId) params.exclude_id = editingId;
      const { data } = await api.get("/users/check", { params });
      if (data.exists) {
        setEmailError("Email sudah digunakan.");
      } else {
        setEmailError("");
      }
    } catch {
      setEmailError("");
    } finally {
      setIsCheckingEmail(false);
    }
  }, [editingId]);

  // Debounce untuk autocomplete user
  useEffect(() => {
    const timer = setTimeout(() => fetchUserSuggestions(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchUserSuggestions]);

  // Debounce untuk autocomplete anggota
  useEffect(() => {
    const timer = setTimeout(() => fetchAnggotaSuggestions(anggotaSearch), 300);
    return () => clearTimeout(timer);
  }, [anggotaSearch, fetchAnggotaSuggestions]);

  // Debounce untuk cek username
  useEffect(() => {
    clearTimeout(usernameDebounceRef.current);
    usernameDebounceRef.current = setTimeout(() => {
      checkUsername(form.username);
    }, 500);
    return () => clearTimeout(usernameDebounceRef.current);
  }, [form.username, checkUsername]);

  // Debounce untuk cek email
  useEffect(() => {
    clearTimeout(emailDebounceRef.current);
    emailDebounceRef.current = setTimeout(() => {
      checkEmail(form.email);
    }, 500);
    return () => clearTimeout(emailDebounceRef.current);
  }, [form.email, checkEmail]);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==================== Password Strength ====================
  const checkPasswordStrength = useCallback((password) => {
    if (!password) {
      setPasswordStrength({ score: 0, label: "", color: "" });
      return;
    }
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    const map = {
      0: { label: "Sangat Lemah", color: "bg-red-500" },
      1: { label: "Lemah", color: "bg-orange-500" },
      2: { label: "Sedang", color: "bg-yellow-500" },
      3: { label: "Kuat", color: "bg-blue-500" },
      4: { label: "Sangat Kuat", color: "bg-green-500" },
      5: { label: "Sangat Kuat", color: "bg-green-600" },
    };
    const result = map[Math.min(score, 5)];
    setPasswordStrength({ score, label: result.label, color: result.color });
  }, []);

  // ==================== Actions ====================
  const applySearch = () => {
    setAppliedSearch(search);
    fetchUsers(1, search);
  };

  const resetSearch = () => {
    setSearch("");
    setAppliedSearch("");
    fetchUsers(1, "");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const goToPage = (page) => {
    fetchUsers(page, appliedSearch);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectUserSuggestion = (user) => {
    setSearch(user.username);
    setShowSuggestions(false);
    setAppliedSearch(user.username);
    fetchUsers(1, user.username);
  };

  const selectAnggota = (anggota) => {
    setSelectedAnggota(anggota);
    setAnggotaSearch(`${anggota.no_anggota} - ${anggota.nama}`);
    setForm((prev) => ({
      ...prev,
      anggota_id: String(anggota.id),
      name: anggota.nama,
    }));
    setShowAnggotaSuggestions(false);
  };

  const clearAnggota = () => {
    setSelectedAnggota(null);
    setAnggotaSearch("");
    setForm((prev) => ({ ...prev, anggota_id: "", name: "" }));
  };

  // Modal Form
  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setUsernameError("");
    setEmailError("");
    setSelectedAnggota(null);
    setAnggotaSearch("");
    setPasswordStrength({ score: 0, label: "", color: "" });
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      name: user.name,
      email: user.email,
      password: "",
      confirmPassword: "",
      role_id: user.role_id || "",
      is_active: user.is_active,
      anggota_id: user.anggota_id || "",
    });
    setUsernameError("");
    setEmailError("");
    setPasswordStrength({ score: 0, label: "", color: "" });
    if (user.anggota) {
      setSelectedAnggota(user.anggota);
      setAnggotaSearch(`${user.anggota.no_anggota} - ${user.anggota.nama}`);
    } else {
      setSelectedAnggota(null);
      setAnggotaSearch("");
    }
    setFormError("");
    setModalOpen(true);
  };

  const openDetailModal = (user) => setDetailUser(user);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "password") {
      checkPasswordStrength(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    // Validasi password dan konfirmasi
    if (form.password) {
      if (form.password !== form.confirmPassword) {
        setFormError("Password dan konfirmasi password tidak cocok.");
        return;
      }
    } else if (!editingId) {
      setFormError("Password wajib diisi untuk pengguna baru.");
      return;
    }

    // Validasi duplikat terakhir (cek error dari state)
    if (usernameError || emailError) {
      setFormError("Masih ada kesalahan pada form. Periksa username dan email.");
      return;
    }

    setFormLoading(true);
    try {
      const payload = { ...form };
      delete payload.confirmPassword;
      if (editingId && !payload.password) delete payload.password;
      if (!payload.anggota_id) payload.anggota_id = null;

      if (editingId) {
        await api.put(`/users/${editingId}`, payload);
      } else {
        await api.post("/users", payload);
      }
      setModalOpen(false);
      fetchUsers(pagination.page, appliedSearch);
      fetchSummary();
    } catch (err) {
      setFormError(err.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${deleteId}`);
      setDeleteId(null);
      fetchUsers(pagination.page, appliedSearch);
      fetchSummary();
    } catch {
      alert("Gagal menghapus user.");
    }
  };

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchUsers(1, "");
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== Render ====================
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Data Pengguna</h2>
            <p className="text-sm text-gray-500">Kelola akun pengguna sistem.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus size={16} />
            Tambah Pengguna
          </button>
        </div>

        {/* Summary Cards */}
        <div
          className={`grid grid-cols-3 gap-4 transition-opacity ${
            summaryLoading ? "opacity-50" : "opacity-100"
          }`}
        >
          <SummaryCard label="Total Pengguna" value={summary?.total ?? "-"} color="blue" />
          <SummaryCard label="Aktif" value={summary?.active ?? "-"} color="green" />
          <SummaryCard label="Tidak Aktif" value={summary?.inactive ?? "-"} color="gray" />
        </div>

        {/* Search & Filter */}
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Cari username / nama
                </label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Ketik username atau nama..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applySearch()}
                    className="w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
                {showSuggestions && (
                  <div
                    ref={suggestionRef}
                    className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-auto"
                  >
                    {suggestLoading ? (
                      <div className="px-3 py-2 text-sm text-gray-400">Memuat...</div>
                    ) : suggestions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">Tidak ada hasil</div>
                    ) : (
                      suggestions.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => selectUserSuggestion(user)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <User size={14} className="text-gray-400" />
                          <span className="font-medium">{user.username}</span>
                          <span className="text-gray-500">- {user.name}</span>
                          <span className="ml-auto text-xs text-gray-400">{user.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applySearch}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Search size={15} /> Cari
                </button>
                <button
                  onClick={resetSearch}
                  className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <XCircle size={15} /> Reset
                </button>
              </div>
            </div>
            {appliedSearch && (
              <p className="mt-3 text-sm text-gray-500">
                Menampilkan hasil untuk: <span className="font-medium">"{appliedSearch}"</span>
              </p>
            )}
          </div>
        </div>

        {/* Tabel Desktop */}
        <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm sm:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Anggota</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Memuat...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium">{user.username}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.role?.name || "-"}</td>
                    <td className="px-4 py-3">
                      {user.anggota ? `${user.anggota.no_anggota} - ${user.anggota.nama}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                       <StatusBadge active={user.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openDetailModal(user)}
                          title="Lihat detail"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          title="Edit user"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteId(user.id)}
                          title="Hapus user"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Kartu Mobile */}
        <div className="space-y-3 sm:hidden">
          {loading ? (
            <p className="py-6 text-center text-gray-400">Memuat...</p>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-gray-400">Tidak ada data.</p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-gray-500">@{user.username}</p>
                  </div>
                  <StatusBadge active={user.is_active} />
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>Email: {user.email}</p>
                  <p>Role: {user.role?.name || "-"}</p>
                  <p>
                    Anggota:{" "}
                    {user.anggota ? `${user.anggota.no_anggota} - ${user.anggota.nama}` : "-"}
                  </p>
                </div>
                <div className="mt-4 flex gap-2 border-t pt-3">
                  <button
                    onClick={() => openDetailModal(user)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm"
                  >
                    <Eye size={15} /> Detail
                  </button>
                  <button
                    onClick={() => openEditModal(user)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-2 text-sm text-blue-600"
                  >
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(user.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2 text-sm text-red-600"
                  >
                    <Trash2 size={15} /> Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && users.length > 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row sm:justify-between sm:bg-transparent sm:p-0 sm:shadow-none">
            <p className="text-sm text-gray-500">
              Halaman {pagination.page} dari {pagination.total_pages} &middot; {pagination.total} pengguna
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="h-8 rounded-lg border px-3 text-sm text-gray-600 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.min(pagination.total_pages, 10) }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`h-8 w-8 rounded-lg text-sm ${
                        p === pagination.page ? "bg-blue-600 text-white" : "border bg-white text-gray-600"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="h-8 rounded-lg border px-3 text-sm text-gray-600 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODAL FORM ==================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
              {editingId ? "Edit Pengguna" : "Tambah Pengguna"}
            </h3>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <form id="user-form" onSubmit={handleSubmit} className="mx-auto max-w-2xl">
              {formError && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Cari Anggota */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Cari Anggota <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs text-gray-400">(nama atau no. anggota)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik nama atau nomor anggota..."
                      value={anggotaSearch}
                      onChange={(e) => setAnggotaSearch(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      required
                    />
                    {showAnggotaSuggestions && anggotaSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-auto">
                        {anggotaSuggestions.map((anggota) => (
                          <button
                            key={anggota.id}
                            onClick={() => selectAnggota(anggota)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <span className="font-medium">{anggota.no_anggota}</span>
                            <span>- {anggota.nama}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedAnggota && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-green-600">
                        Terpilih: {selectedAnggota.no_anggota} - {selectedAnggota.nama}
                      </span>
                      <button
                        type="button"
                        onClick={clearAnggota}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Hapus pilihan
                      </button>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    * Hanya anggota yang belum memiliki user yang muncul.
                  </p>
                </div>

                {/* Nama Lengkap (readonly) */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-gray-700">
                    Nama Lengkap <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs text-gray-400">(otomatis dari pilihan anggota)</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    readOnly
                    className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700"
                    placeholder="Pilih anggota terlebih dahulu"
                  />
                </div>

                {/* Username dengan validasi */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-gray-700">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => handleFormChange("username", e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                        usernameError ? "border-red-500 focus:border-red-500" : "focus:border-blue-500"
                      }`}
                      required
                      placeholder="Masukkan username unik"
                    />
                    {isCheckingUsername && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                      </div>
                    )}
                    {!isCheckingUsername && usernameError && (
                      <XCircleIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />
                    )}
                    {!isCheckingUsername && form.username && !usernameError && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                    )}
                  </div>
                  {usernameError && <p className="mt-1 text-xs text-red-500">{usernameError}</p>}
                  <p className="mt-1 text-xs text-gray-400">Minimal 2 karakter, unik.</p>
                </div>

                {/* Email dengan validasi */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleFormChange("email", e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                        emailError ? "border-red-500 focus:border-red-500" : "focus:border-blue-500"
                      }`}
                      required
                      placeholder="Masukkan email unik"
                    />
                    {isCheckingEmail && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                      </div>
                    )}
                    {!isCheckingEmail && emailError && (
                      <XCircleIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" size={18} />
                    )}
                    {!isCheckingEmail && form.email && !emailError && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                    )}
                  </div>
                  {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
                </div>

                {/* Password dengan toggle & strength */}
                <div>
                  <label className="mb-1 block text-sm text-gray-700">
                    Password {!editingId && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => handleFormChange("password", e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder={editingId ? "Kosongkan jika tidak diubah" : "Masukkan password"}
                      required={!editingId}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {/* Password Strength */}
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{passwordStrength.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Minimal 8 karakter, kombinasi huruf besar/kecil, angka, dan simbol.
                      </p>
                    </div>
                  )}
                </div>

                {/* Konfirmasi Password */}
                <div>
                  <label className="mb-1 block text-sm text-gray-700">
                    Konfirmasi Password {!editingId && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => handleFormChange("confirmPassword", e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none ${
                        form.confirmPassword && form.password !== form.confirmPassword
                          ? "border-red-500 focus:border-red-500"
                          : form.confirmPassword && form.password === form.confirmPassword
                          ? "border-green-500 focus:border-green-500"
                          : "focus:border-blue-500"
                      }`}
                      placeholder="Ulangi password"
                      required={!editingId}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    {form.confirmPassword && form.password === form.confirmPassword && (
                      <CheckCircle className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                    )}
                  </div>
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">Password tidak cocok.</p>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="mb-1 block text-sm text-gray-700">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.role_id}
                    onChange={(e) => handleFormChange("role_id", e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Pilih Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Aktif */}
                <div>
                  <label className="mb-1 block text-sm text-gray-700">Status Aktif</label>
                  <select
                    value={form.is_active ? "1" : "0"}
                    onChange={(e) => handleFormChange("is_active", e.target.value === "1")}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="1">Aktif</option>
                    <option value="0">Tidak Aktif</option>
                  </select>
                </div>
              </div>
            </form>
          </div>

          <div className="flex justify-end gap-2 border-t px-4 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="user-form"
              disabled={formLoading || isCheckingUsername || isCheckingEmail}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {formLoading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* ==================== MODAL DETAIL ==================== */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-8">
            <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">Detail Pengguna</h3>
            <button
              onClick={() => setDetailUser(null)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-2xl space-y-4">
              <DetailRow label="Username" value={detailUser.username} />
              <DetailRow label="Nama" value={detailUser.name} />
              <DetailRow label="Email" value={detailUser.email} />
              <DetailRow label="Role" value={detailUser.role?.name || "-"} />
              <DetailRow
                label="Anggota"
                value={
                  detailUser.anggota
                    ? `${detailUser.anggota.no_anggota} - ${detailUser.anggota.nama}`
                    : "-"
                }
              />
              <DetailRow label="Status" value={<StatusBadge active={detailUser.is_active} />} />
              <DetailRow
                label="Login Terakhir"
                value={detailUser.last_login ? new Date(detailUser.last_login).toLocaleString() : "-"}
              />
              <DetailRow label="Online" value={detailUser.is_online ? "Online" : "Offline"} />
              <DetailRow
                label="Dibuat"
                value={detailUser.created_at ? new Date(detailUser.created_at).toLocaleString() : "-"}
              />
            </div>
          </div>
          <div className="flex justify-end border-t px-4 py-4 sm:px-8">
            <button
              onClick={() => setDetailUser(null)}
              className="rounded-lg border px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ==================== KONFIRMASI HAPUS ==================== */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center">
            <p className="mb-4 text-gray-700">Yakin ingin menghapus pengguna ini?</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm">
                Batal
              </button>
              <button onClick={handleDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ==================== KOMPONEN PEMBANTU ====================
function SummaryCard({ label, value, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    gray: "bg-gray-100 text-gray-700",
  };
  return (
    <div className={`rounded-xl p-4 shadow-sm ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status, active }) {
  // Untuk user (menggunakan prop active)
  if (active !== undefined) {
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
        active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
      }`}>
        {active ? "Aktif" : "Nonaktif"}
      </span>
    );
  }
  // Untuk anggota (menggunakan prop status)
  if (status !== undefined) {
    const isAktif = status?.toLowerCase() === "aktif";
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
        isAktif ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
      }`}>
        {isAktif ? "Aktif" : "Nonaktif"}
      </span>
    );
  }
  return <span className="rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600">-</span>;
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b pb-2">
      <dt className="text-sm font-medium text-gray-600">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-800">{value}</dd>
    </div>
  );
}