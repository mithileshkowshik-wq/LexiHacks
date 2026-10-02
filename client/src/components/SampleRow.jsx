// One row in the Writing samples list. A finished sample links to its error
// report (screen 3, GET /api/samples/:sampleId); a sample still being
// analysed is inert - no link, muted look - matching the wireframe.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import StatusPill from './StatusPill.jsx';
import { statusFor } from '../lib/status.js';
import { sampleImageUrl } from '../lib/api.js';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatUploaded(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export default function SampleRow({ sample }) {
  const { ready } = statusFor(sample.analysisStatus);
  // Falls back to the plain page icon if the scan can't load (sample still
  // mid-upload, or the file went missing on disk) instead of a broken image.
  const [thumbFailed, setThumbFailed] = useState(false);

  const inner = (
    <>
      <span className="sample-row__thumb" aria-hidden="true">
        {thumbFailed ? (
          <Icon name="page" size={22} />
        ) : (
          <img
            className="sample-row__thumb-img"
            src={sampleImageUrl(sample.sampleId, 0)}
            alt=""
            loading="lazy"
            onError={() => setThumbFailed(true)}
          />
        )}
        {sample.imageCount > 1 && (
          <span className="sample-row__count">{sample.imageCount}</span>
        )}
      </span>
      <span className="sample-row__body">
        <span className="sample-row__title">{sample.title}</span>
        <span className="sample-row__date">
          Uploaded {formatUploaded(sample.uploadedAt)}
        </span>
      </span>
      <StatusPill analysisStatus={sample.analysisStatus} />
      {ready && (
        <Icon name="arrow" size={20} className="sample-row__go" />
      )}
    </>
  );

  if (ready) {
    return (
      <Link
        className="sample-row sample-row--ready"
        to={`/samples/${sample.sampleId}`}
        aria-label={`Open error report for ${sample.title}`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="sample-row sample-row--waiting" aria-disabled="true">
      {inner}
    </div>
  );
}
