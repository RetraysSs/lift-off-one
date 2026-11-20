export function MockSkeleton() {
  return (
    <svg
      className="skeleton-preview"
      viewBox="0 0 800 450"
      role="img"
      aria-label="Mock ready stance skeleton: arms green, legs red, head and hands grey"
    >
      <g className="court-lines">
        <path d="M0 340H800M0 415H800M90 450L265 280H535L710 450M205 450L335 280M595 450L465 280M400 280V450" />
        <path d="M0 150H800" strokeDasharray="3 6" opacity=".25" />
      </g>
      <ellipse cx="400" cy="371" rx="105" ry="12" className="court-lines" />
      <g className="skeleton-bone skeleton-neutral">
        <circle cx="400" cy="100" r="21" />
        <path d="M400 122V146M364 156L400 146L436 156M400 146V245M380 250L400 245L420 250" />
      </g>
      <g className="skeleton-bone skeleton-pass">
        <path d="M364 156L331 205L293 181M436 156L468 192L504 136" />
      </g>
      <g className="skeleton-bone skeleton-fail">
        <path d="M380 250L347 300L321 357M420 250L454 300L480 357" />
      </g>
      <g className="skeleton-bone skeleton-neutral">
        <path d="M321 357L300 365M480 357L505 365M504 136L514 113" />
        <ellipse cx="528" cy="83" rx="16" ry="31" transform="rotate(25 528 83)" strokeWidth="2" />
      </g>
      {[
        [364, 156],
        [436, 156],
        [331, 205],
        [468, 192],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" className="skeleton-joint joint-pass" />
      ))}
      {[
        [380, 250],
        [420, 250],
        [347, 300],
        [454, 300],
        [321, 357],
        [480, 357],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" className="skeleton-joint joint-fail" />
      ))}
      {[
        [293, 181],
        [504, 136],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" className="skeleton-joint joint-neutral" />
      ))}
      <circle cx="454" cy="300" r="20" className="knee-focus" />
      <circle cx="454" cy="300" r="27" className="knee-focus" opacity=".25" />
    </svg>
  );
}
