import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmModal — replaces native window.confirm() with a styled modal.
 * 
 * Props:
 *   open       — boolean, whether the modal is visible
 *   title      — string, heading text
 *   message    — string, body text
 *   confirmLabel — string, label for the confirm button (default: "Confirm")
 *   cancelLabel  — string, label for the cancel button (default: "Cancel")
 *   variant    — 'danger' | 'warning' | 'default' (controls confirm button color)
 *   onConfirm  — () => void
 *   onCancel   — () => void
 *   loading    — boolean, disables buttons while processing
 */
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false
}) {
  if (!open) return null;

  const variantStyles = {
    danger: {
      bg: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      color: 'var(--danger)',
      iconColor: '#ef4444'
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      color: 'var(--warning)',
      iconColor: '#f59e0b'
    },
    default: {
      bg: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      color: 'var(--accent-primary)',
      iconColor: '#3b82f6'
    }
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="animate-fade-in w-full max-w-sm rounded-xl border p-5"
        style={{ background: 'var(--surface-color)', borderColor: 'var(--surface-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: style.bg
            }}
          >
            <AlertTriangle size={20} style={{ color: style.iconColor }} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm mb-1">{title}</h3>
            {message && <p className="text-xs text-secondary leading-relaxed">{message}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="btn flex-1 text-sm"
            style={{
              background: 'var(--surface-hover)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-secondary)',
              padding: '10px'
            }}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className="btn flex-1 text-sm font-semibold"
            style={{
              background: style.bg,
              border: style.border,
              color: style.color,
              padding: '10px'
            }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
