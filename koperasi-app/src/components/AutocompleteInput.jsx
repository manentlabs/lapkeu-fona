import { useEffect, useRef, useState } from "react";

// Input dengan saran ketik (maksimal 5), fetchSuggestions bersifat async
// dan dipanggil dengan debounce supaya tidak spam request tiap huruf.
export default function AutocompleteInput({
  label,
  value,
  onChange,
  fetchSuggestions,
  placeholder = "",
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (val) => {
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await fetchSuggestions(val);
        setSuggestions(result.slice(0, 5));
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleSelect = (item) => {
    onChange(item);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        autoComplete="off"
      />

      {open && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
          {loading ? (
            <li className="px-3 py-2 text-sm text-gray-400">Mencari…</li>
          ) : suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Tidak ada saran</li>
          ) : (
            suggestions.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                >
                  {item}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}