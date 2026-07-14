import Image from "next/image";

export function BrandLockup({
  compact = false,
  priority = false,
}: {
  compact?: boolean;
  priority?: boolean;
}) {
  return (
    <a className={`brand-lockup${compact ? " brand-lockup--compact" : ""}`} href="#overview" aria-label="SozoRock Health CB-CAP home">
      <span className="brand-lockup__wordmark">
        <Image
          src="/brand/sozorock-wordmark-clean-v2.png"
          alt="SozoRock"
          width={560}
          height={140}
          priority={priority}
          sizes={compact ? "118px" : "142px"}
        />
        <sup aria-hidden="true">®</sup>
      </span>
      <span className="brand-lockup__health">Health</span>
    </a>
  );
}
