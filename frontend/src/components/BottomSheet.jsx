import { X } from 'lucide-react'

// Shared bottom-sheet primitive — extracted from the recipe already used
// (independently, copy-pasted) in Activity.jsx's log sheet and Settings.jsx's
// AI overlay: dimmed backdrop, rounded-t-3xl panel, translate-y transition,
// always mounted so open/close animates instead of popping.
export default function BottomSheet({ open, onClose, title, headerRight, children, zIndex = 60 }) {
  return (
    <div
      className={`fixed inset-0 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      style={{ zIndex }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`absolute bottom-0 left-0 right-0 bg-surface-card rounded-t-3xl max-h-[92vh] flex flex-col transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-border" />
        </div>

        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border shrink-0">
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            <div className="flex items-center gap-2">
              {headerRight}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 flex flex-col min-h-0">{children}</div>
      </div>
    </div>
  )
}
