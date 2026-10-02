// Screen 1b's body: no samples yet. An empty screen is an invitation to act,
// so the whole card is built around the single next step — upload the first
// sample — with the child's first name in the copy to keep it human.

import Icon from './Icon.jsx';
import Button from './Button.jsx';

export default function EmptyState({ firstName, uploadTo }) {
  return (
    <div className="empty">
      <div className="empty__mark" aria-hidden="true">
        <Icon name="page" size={42} />
      </div>
      <h2 className="empty__title">No writing samples yet</h2>
      <p className="empty__text">
        Upload {firstName}’s first piece of writing to start spotting spelling
        patterns. Trends and recommendations unlock after the first sample is
        analysed.
      </p>
      <Button variant="primary" icon="upload" to={uploadTo}>
        Upload the first sample
      </Button>
    </div>
  );
}
