export function PageHeader({ title, subtitle, actions = null, breadcrumbs = null }) {
  return (
    <div className="ui-page-header">
      <div>
        {breadcrumbs ? <div className="ui-breadcrumbs">{breadcrumbs}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="ui-page-header-actions">{actions}</div> : null}
    </div>
  );
}

