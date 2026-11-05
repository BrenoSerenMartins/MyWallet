import type { ReactNode } from 'react';

/** Shared page hierarchy: title first, one quiet description and task actions. */
export function PageHeader({
  title,
  description,
  navigation,
  children,
  compact = false,
}: {
  title: ReactNode;
  compact?: boolean;
  description?: ReactNode;
  navigation?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={`page-heading page-header${compact ? ' page-header-compact' : ''}`}>
      <div className="page-header-copy">
        <div className="page-header-headingline">
          <h1 className={compact ? 'sr-only' : undefined}>{title}</h1>
          {navigation}
        </div>
        {description && !compact && <p>{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  );
}
