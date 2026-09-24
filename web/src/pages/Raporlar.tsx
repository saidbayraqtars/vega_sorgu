import { KatalogGezgini } from "../components/KatalogGezgini";
import { useYon } from "../lib/yonlendirici";
import { LayoutGrid } from "lucide-react";

export function Raporlar() {
  const { git } = useYon();
  return (
    <div className="flex flex-col gap-3" data-testid="raporlar-sayfasi">
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <LayoutGrid size={24} className="text-marka" aria-hidden /> Raporlar
      </h1>
      <KatalogGezgini onSec={(r) => git(`/rapor/${encodeURIComponent(r.id)}`)} />
    </div>
  );
}
