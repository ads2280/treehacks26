import type { SVGProps } from "react";

export function DjHead(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Head */}
      <circle cx="12" cy="13" r="6" />
      {/* Headband */}
      <path d="M4.5 11.5C4.5 7.1 7.9 3.5 12 3.5s7.5 3.6 7.5 8" />
      {/* Left ear cup */}
      <rect x="2.5" y="10" width="3" height="5" rx="1" />
      {/* Right ear cup */}
      <rect x="18.5" y="10" width="3" height="5" rx="1" />
      {/* Sunglasses/visor */}
      <path d="M8 12h8" />
      <path d="M7.5 11.5l1.5 1.5-1.5 1.5" />
      <path d="M16.5 11.5l-1.5 1.5 1.5 1.5" />
      {/* Mouth/smile */}
      <path d="M10 16.5c.5.5 1.2.8 2 .8s1.5-.3 2-.8" />
    </svg>
  );
}
