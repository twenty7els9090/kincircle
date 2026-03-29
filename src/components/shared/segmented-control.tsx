'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';

interface SegmentedControlProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  dark?: boolean;
}

export function SegmentedControl({ options, selected, onSelect, dark }: SegmentedControlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = () => {
    const idx = options.indexOf(selected);
    const btn = btnRefs.current[idx];
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  };

  useLayoutEffect(() => {
    updateIndicator();
  }, [selected]);

  useEffect(() => {
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex relative rounded-[12px] p-[3px]"
      style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }}
    >
      <motion.div
        className="absolute rounded-[10px]"
        style={{
          top: 3,
          bottom: 3,
          background: dark ? '#0A84FF' : '#007AFF',
          boxShadow: dark
            ? '0 2px 16px rgba(10,132,255,0.35)'
            : '0 2px 16px rgba(0,122,255,0.3)',
        }}
        animate={{ left: indicator.left, width: indicator.width }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      />
      {options.map((option, idx) => {
        const isActive = selected === option;
        return (
          <button
            key={option}
            ref={(el) => { btnRefs.current[idx] = el; }}
            onClick={() => onSelect(option)}
            className="relative z-10 flex-1 py-[8px] text-[14px] font-medium rounded-[10px] transition-colors duration-200"
            style={{
              color: isActive ? '#FFFFFF' : (dark ? '#8E8E93' : '#8E8E93'),
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
