/** Shuttlecock lifting off: the Lift Off mark. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full bg-stage text-primary shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 32 32" fill="none">
        <path
          d="M12 18L6 6l6 2 4-5 4 5 6-2-6 12M12 18h8l-1 5q-3 4-6 0Z"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M10 28h12" stroke="var(--lime)" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
