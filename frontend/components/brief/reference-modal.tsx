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
            <p className="text-sm leading-relaxed text-ink">
              {citation.label}
            </p>
          </div>

          <div className="pt-2 border-t border-line">
            <p className="text-xs text-ink-3">
              <span className="font-semibold">Source:</span> {citation.source}
              <br />
              <span className="font-semibold">Updated:</span> {citation.time_ago}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
