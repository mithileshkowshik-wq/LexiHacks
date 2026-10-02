// The live "does this password qualify" checklist, shared by
// ResetPasswordPage and AccountPage's change-password form.

import { PASSWORD_RULES } from '../lib/passwordRules.js';
import Icon from './Icon.jsx';

export default function PasswordRulesList({ password }) {
  return (
    <ul className="password-rules">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`password-rules__item${met ? ' password-rules__item--met' : ''}`}
          >
            <Icon name={met ? 'check' : 'cross'} size={14} />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
