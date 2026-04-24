import type { CitationMeta } from "@/lib/fixtures/northstar-beauty-brief";
import { X } from "lucide-react";

interface ReferenceModalProps {
  citation: CitationMeta | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReferenceModal({
  citation,
  isOpen,
  onClose,
}: ReferenceModalProps) {
  if (!isOpen || !citation) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-lg p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{citation.label}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-2 rounded"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-ink-4 uppercase tracking-wide">
              Citation
            </label>
            <p className="text-sm mt-1 text-ink">{citation.label}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-4 uppercase tracking-wide">
              Last Updated
            </label>
            <p className="text-sm mt-1 text-ink-2">{citation.time_ago}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-4 uppercase tracking-wide">
              Source ID
            </label>
            <p className="text-sm mt-1 font-mono text-ink-2">{citation.source}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
