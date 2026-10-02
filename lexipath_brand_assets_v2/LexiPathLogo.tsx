import type { SVGProps } from "react";

type MarkProps = SVGProps<SVGSVGElement> & {
  monochrome?: boolean;
};

export function LexiPathMark({
  monochrome = false,
  ...props
}: MarkProps) {
  const ink = "#1A2433";
  const sage = monochrome ? ink : "#7B8F7A";

  return (
    <svg
      viewBox="0 0 256 256"
      role="img"
      aria-label="LexiPath"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M46 18H72V145H143V171H46Z" fill={ink} />
      <path
        fillRule="evenodd"
        d="M126 84H167C203 84 228 109 228 144C228 180 202 205 166 205H145V179H166C187 179 202 165 202 144C202 124 188 110 167 110H126Z"
        fill={sage}
      />
      <rect x="119" y="219" width="50" height="25" fill={ink} />
    </svg>
  );
}

type LogoProps = SVGProps<SVGSVGElement> & {
  monochrome?: boolean;
};

export function LexiPathLogo({
  monochrome = false,
  ...props
}: LogoProps) {
  const ink = "#1A2433";
  const sage = monochrome ? ink : "#7B8F7A";

  return (
    <svg
      viewBox="0 0 1050 260"
      role="img"
      aria-label="LexiPath"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(18 2)">
        <path d="M46 18H72V145H143V171H46Z" fill={ink} />
        <path
          fillRule="evenodd"
          d="M126 84H167C203 84 228 109 228 144C228 180 202 205 166 205H145V179H166C187 179 202 165 202 144C202 124 188 110 167 110H126Z"
          fill={sage}
        />
        <rect x="119" y="219" width="50" height="25" fill={ink} />
      </g>
      <text
        x="314"
        y="161"
        fill={ink}
        fontFamily="Lexend, Inter, Arial, sans-serif"
        fontSize="98"
        fontWeight="500"
        letterSpacing="1.6"
      >
        LexiPath
      </text>
    </svg>
  );
}
