import type { ReactNode } from 'react';

/** Shared page hierarchy: title first, one quiet description and task actions. */
export function PageHeader({
  title,
  description,
  navigation,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  navigation?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading page-header">
      <div className="page-header-copy">
        <div className="page-header-headingline">
          <h1>{title}</h1>
          {navigation}
        </div>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  );
}
