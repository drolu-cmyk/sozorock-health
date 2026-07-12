import Image from "next/image";

type LogoLockupProps = {
  className?: string;
  href?: string;
  inverse?: boolean;
};

export function LogoLockup({ className = "", href = "/", inverse = false }: LogoLockupProps) {
  return (
    <a className={`logo-lockup ${inverse ? "logo-lockup--inverse" : ""} ${className}`.trim()} href={href} aria-label="SozoRock Health home">
      <span className="logo-lockup__name">
        <Image src="/brand/sozorock-wordmark-clean-v3.png" alt="SozoRock" width={2172} height={724} sizes="143px" />
        <sup aria-label="registered trademark">®</sup>
      </span>
      <span className="logo-lockup__health">Health</span>
    </a>
  );
}
