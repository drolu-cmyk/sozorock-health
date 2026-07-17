export function ApprovedBrandLockup({ inverse = false }) {
  return (
    <span
      className={`brand-lockup${inverse ? " brand-lockup--inverse" : ""}`}
      aria-label="SozoRock Health"
    >
      <span className="brand-word">
        SozoRock<sup aria-label="registered trademark">®</sup>
      </span>
      <span className="brand-health">Health</span>
    </span>
  );
}
