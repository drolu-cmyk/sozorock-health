import Image from "next/image";

type LogoLockupProps = {
  className?: string;
  href?: string;
  inverse?: boolean;
  locale?: "en" | "es";
};

export function LogoLockup({ className = "", href = "/", inverse = false, locale = "en" }: LogoLockupProps) {
  return (
    <a className={`logo-lockup ${inverse ? "logo-lockup--inverse" : ""} ${className}`.trim()} href={href} aria-label={locale === "es" ? "Inicio de SozoRock Health" : "SozoRock Health home"}>
      <span className="logo-lockup__name">
        <Image src="/brand/sozorock-wordmark-clean-v2.png" alt="SozoRock" width={560} height={140} sizes="143px" />
        <sup aria-hidden="true">®</sup>
      </span>
      <span className="logo-lockup__health">Health</span>
    </a>
  );
}
