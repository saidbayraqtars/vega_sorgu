import { useState } from "react";
import { useConnection } from "../context/ConnectionContext";

export default function StokTable() {
  const { fetchStok } = useConnection();
  const [search, setSearch] = useState("");
  const [stokData, setStokData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStok(search);
      setStokData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-800/40 rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-dark-800/60 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Stok Arama</h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Stok Kodu veya Adı..."
            className="px-3 py-1.5 rounded-lg bg-dark-900 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            {loading ? "Aranıyor..." : "Ara"}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 text-red-400 text-sm">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-dark-300">
          <thead className="text-xs text-dark-400 uppercase bg-dark-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">Stok Kodu</th>
              <th className="px-4 py-3 font-medium">Malın Cinsi</th>
              <th className="px-4 py-3 font-medium text-right">Kalan</th>
            </tr>
          </thead>
          <tbody>
            {stokData.length > 0 ? (
              stokData.map((stok, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-dark-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{stok.STOKKODU}</td>
                  <td className="px-4 py-3">{stok.MALINCINSI}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-block px-2 py-1 rounded bg-dark-900 text-violet-300 font-mono text-xs">
                      {stok.KALAN}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="px-4 py-8 text-center text-dark-500">
                  Arama yapmak için yukarıdaki alanı kullanın.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
