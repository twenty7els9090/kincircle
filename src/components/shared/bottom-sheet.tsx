'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[81] rounded-t-[16px] max-h-[70vh] flex flex-col"
            style={{ background: 'var(--ios-bg)' }}
          >
            {/* Handle */}
            <div className="flex flex-col items-center pt-2 pb-1">
              <div className="w-[36px] h-[5px] rounded-full" style={{ background: 'var(--ios-text-tertiary)' }} />
            </div>
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-4 pb-2">
                <span className="ios-section-header">{title}</span>
                <button onClick={onClose} className="w-[44px] h-[44px] flex items-center justify-center -mr-4">
                  <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center" style={{ background: 'var(--ios-text-tertiary)' }}>
                    <X size={14} color="white" strokeWidth={3} />
                  </div>
                </button>
              </div>
            )}
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
