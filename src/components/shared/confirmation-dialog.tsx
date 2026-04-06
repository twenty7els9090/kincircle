'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-x-0 top-1/2 -translate-y-1/2 z-[101] mx-6"
          >
            <div className="rounded-[14px] overflow-hidden max-w-sm mx-auto" style={{ background: 'var(--ios-card-bg)' }}>
              <div className="px-6 pt-5 pb-4 text-center">
                <h3 className="ios-nav-title" style={{ color: 'var(--ios-text-primary)' }}>{title}</h3>
                <p className="ios-meta mt-2">{message}</p>
              </div>
              <div className="ios-separator" />
              <div className="flex">
                <button
                  onClick={onCancel}
                  className="flex-1 h-[44px] text-[17px] font-normal"
                  style={{ color: '#007AFF' }}
                >
                  Отмена
                </button>
                <div className="ios-separator" style={{ width: 0.5 }} />
                <button
                  onClick={onConfirm}
                  className="flex-1 h-[44px] text-[17px] font-semibold"
                  style={{ color: destructive ? '#FF3B30' : '#007AFF' }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
