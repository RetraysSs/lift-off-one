export function StanceIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="24" cy="8" r="4" />
      <path d="M24 13v14M15 18l9-3 9 3M14 18l-3 7M33 18l4-6M24 27l-7 6-2 9M24 27l7 6 2 9" />
    </svg>
  );
}

export function ClearIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="21" cy="11" r="4" />
      <path d="M21 16v13M21 19l9-6 3-8M21 19l-8-3-3-6M21 29l-5 7-1 7M21 29l6 7 4 6" />
      <ellipse cx="35" cy="4.5" rx="3" ry="4" transform="rotate(25 35 4.5)" />
    </svg>
  );
}
