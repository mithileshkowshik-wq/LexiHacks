// One button, three ranks (primary / secondary / tertiary) plus a disabled
// look for actions that have nothing to act on yet (e.g. Trends before any
// sample exists). Renders as <button>, or as a router <Link> when `to` is set.

import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

export default function Button({
  variant = 'secondary',
  icon,
  to,
  disabled = false,
  disabledHint,
  children,
  ...rest
}) {
  const className = `btn btn--${variant}${disabled ? ' btn--disabled' : ''}`;
  const content = (
    <>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </>
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true" title={disabledHint}>
        {content}
      </span>
    );
  }
  if (to) {
    return (
      <Link className={className} to={to} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button className={className} type="button" {...rest}>
      {content}
    </button>
  );
}
