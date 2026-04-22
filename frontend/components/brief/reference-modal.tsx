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

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-4 uppercase">
              Data Point
            </label>
            <p className="text-sm mt-1">{citation.label}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-4 uppercase">
              Last Updated
            </label>
            <p className="text-sm mt-1">{citation.time_ago}</p>
          </div>

          <button className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
            View Raw Data
          </button>
        </div>
      </div>
    </div>
  );
}
