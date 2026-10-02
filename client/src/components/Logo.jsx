// The LexiPath "LP" monogram (lexipath_brand_assets_v2/lexipath-mark.svg):
// navy L + open sage bowl + detached navy bar.
//
// Two variants:
//   "brand" (default) — navy + sage, for light surfaces.
//   "light"           — off-white + sage, for the navy sidebar
//                       (mirrors lexipath-mark-white.svg but keeps the
//                       sage bowl so the accent survives on dark).

const FILLS = {
  brand: { solid: '#1A2433', bowl: '#7B8F7A' },
  light: { solid: '#F2F0E9', bowl: '#7B8F7A' },
};

export default function Logo({ size = 30, variant = 'brand', className }) {
  const { solid, bowl } = FILLS[variant] ?? FILLS.brand;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      role="img"
      aria-label="LexiPath"
    >
      <path d="M46 18H72V145H143V171H46Z" fill={solid} />
      <path
        fillRule="evenodd"
        d="M126 84H167C203 84 228 109 228 144C228 180 202 205 166 205H145V179H166C187 179 202 165 202 144C202 124 188 110 167 110H126Z"
        fill={bowl}
      />
      <rect x="119" y="219" width="50" height="25" fill={solid} />
    </svg>
  );
}
