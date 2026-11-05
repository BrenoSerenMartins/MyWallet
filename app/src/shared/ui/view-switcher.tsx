import { useLayoutEffect, useRef, useState } from 'react';
export function ViewSwitcher<T extends string>({
  label,
  value,
  options,
  onChange,
  variant = 'segment',
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  variant?: 'segment' | 'tabs';
}) {
  const root = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    if (variant !== 'tabs' || !root.current) return;
    const element = root.current;
    const measure = () => {
      const active = element.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!active) return;
      const tab = active.getBoundingClientRect(),
        bounds = element.getBoundingClientRect();
      setIndicator({ left: tab.left - bounds.left + element.scrollLeft, width: tab.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('button').forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [value, variant]);
  return (
    <div
      ref={root}
      className={`view-switcher ${variant === 'tabs' ? 'view-switcher-tabs' : ''}`}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span>{option.count}</span>}
        </button>
      ))}
      {variant === 'tabs' && (
        <span
          className="view-switcher-indicator"
          aria-hidden="true"
          style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
        />
      )}
    </div>
  );
}
