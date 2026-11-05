import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from './tooltip';

/** Quiet task action with a named, touch-sized target and a visible explanation on focus. */
export function IconAction({
  label,
  icon,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode }) {
  return (
    <Tooltip text={label}>
      <button
        {...props}
        type={type}
        className={`icon-button quiet-action ${className}`}
        aria-label={label}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
