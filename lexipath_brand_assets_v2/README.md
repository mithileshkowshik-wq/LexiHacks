# LexiPath Brand Assets — Corrected Concept 02

This package uses the corrected mark from the supplied reference.

## Exact mark construction

The symbol is **not** a conventional joined `LP`.

1. A sharp, angular Ink Blue `L`.
2. A separate Sage open bowl on the upper-right.
3. A detached horizontal Ink Blue bar underneath.

Do not add:
- a vertical stem to the Sage bowl
- a connecting line between the bowl and lower bar
- an enclosed `P`
- rounded caps on the `L`
- a square dot in place of the horizontal bar

## Palette

- Ink Blue: `#1A2433`
- Sage: `#7B8F7A`
- Mist: `#D6D4CC`
- Off-white: `#F7F5EF`

## Recommended project usage

- Header/navigation: `lexipath-horizontal.svg`
- Mobile or compact header: `lexipath-mark.svg`
- Browser icon: `favicon.svg` or `favicon.ico`
- PWA icon: `app-icon-512.png`
- React/Next.js: `LexiPathLogo.tsx`
- Styling source of truth: `brand-tokens.json`

## Typography

Use **Lexend Medium 500** for the wordmark.  
Fallback: `Inter, Arial, sans-serif`.

For Next.js:

```tsx
import { Lexend } from "next/font/google";

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
```

## Coding-agent implementation instruction

Use `asset-manifest.json` to locate the approved assets and
`brand-tokens.json` as the colour and typography source of truth.
Do not redraw or reinterpret the symbol. Preserve the exact three-part
construction: sharp L, open bowl, detached horizontal bar.
