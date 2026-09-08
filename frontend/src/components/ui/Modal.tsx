import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}

export function Modal({ title, onClose, children, maxWidth = 360 }: ModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'linear-gradient(145deg, #1b5e20, #2e7d32)',
        borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth,
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.25s ease-out',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
              fontSize: 16, lineHeight: '30px', textAlign: 'center',
            }}
          >✕</button>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
