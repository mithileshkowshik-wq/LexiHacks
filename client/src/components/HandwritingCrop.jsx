import { useId, useState } from 'react';

export default function HandwritingCrop({ imageUrl, box }) {
  const clipId = useId();
  const [loaded, setLoaded] = useState(null);
  const valid =
    imageUrl &&
    box &&
    [box.x, box.y, box.z, box.w].every(Number.isFinite) &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.x < 1 &&
    box.y < 1 &&
    box.z > 0 &&
    box.w > 0;
  if (!valid)
    return <span className="handwriting-crop__fallback">Handwriting crop unavailable</span>;
  const ready = loaded?.url === imageUrl && !loaded.failed;
  const left = Math.max(0, box.x - 0.008);
  const top = Math.max(0, box.y - 0.008);
  const width = Math.min(1, box.x + box.z + 0.008) - left;
  const height = Math.min(1, box.y + box.w + 0.008) - top;
  return (
    <span className="handwriting-crop">
      <span className="handwriting-crop__label">Original handwriting</span>
      <img
        className="handwriting-crop__source"
        src={imageUrl}
        alt=""
        onLoad={(event) =>
          setLoaded({
            url: imageUrl,
            width: event.target.naturalWidth,
            height: event.target.naturalHeight,
          })
        }
        onError={() => setLoaded({ url: imageUrl, failed: true })}
      />
      {ready ? (
        <svg
          className="handwriting-crop__image"
          role="img"
          aria-label="Original handwritten word from the uploaded page"
          viewBox={`${left * loaded.width} ${top * loaded.height} ${width * loaded.width} ${height * loaded.height}`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={left * loaded.width}
                y={top * loaded.height}
                width={width * loaded.width}
                height={height * loaded.height}
              />
            </clipPath>
          </defs>
          <image
            href={imageUrl}
            width={loaded.width}
            height={loaded.height}
            clipPath={`url(#${clipId})`}
          />
        </svg>
      ) : (
        <span className="handwriting-crop__fallback">
          {loaded?.url === imageUrl && loaded.failed
            ? 'Handwriting crop unavailable'
            : 'Loading handwriting…'}
        </span>
      )}
    </span>
  );
}
