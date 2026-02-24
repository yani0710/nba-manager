/**
 * Generic Button component
 */

export function Button({ children, onClick, variant = 'primary', ...props }) {
  const className = `btn btn-${variant}`;
  return (
    <button className={className} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
