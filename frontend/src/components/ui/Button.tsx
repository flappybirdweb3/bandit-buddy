import type { ReactNode, CSSProperties } from 'react';

interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
  children: ReactNode;
  fullWidth?: boolean;
  style?: CSSProperties;
}

const variants = {
  primary: {
    background: 'linear-gradient(135deg, #43a047, #2e7d32)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  danger: {
    background: 'linear-gradient(135deg, #ef5350, #c62828)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  ghost: {
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
  },
};

export function Button({ onClick, disabled, variant = 'primary', children, fullWidth, style }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        width: fullWidth ? '100%' : 'auto',
        padding: '12px 20px',
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontSize: 15,
        fontWeight: 600,
        transition: 'transform 0.1s, opacity 0.1s',
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) (e.currentTarget.style.transform = 'scale(0.97)'); }}
      onMouseUp={(e) => { (e.currentTarget.style.transform = 'scale(1)'); }}
    >
      {children}
    </button>
  );
}
