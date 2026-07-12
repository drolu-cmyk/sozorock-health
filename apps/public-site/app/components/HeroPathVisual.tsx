export function HeroPathVisual({
  caption,
  label,
}: {
  caption: string;
  label: string;
}) {
  return (
    <figure className="path-illustration" role="img" aria-label={label}>
      <picture>
        <source
          media="(max-width: 820px)"
          srcSet="/media/clearer-path-hero-mobile-v2.webp"
          type="image/webp"
        />
        <img
          src="/media/clearer-path-hero.webp"
          width={1513}
          height={1039}
          alt=""
          decoding="async"
          fetchPriority="high"
        />
      </picture>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
