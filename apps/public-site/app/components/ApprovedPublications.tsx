import { ArrowRight, BookOpenText } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { publications } from "../lib/publications";

export function ApprovedPublications() {
  return (
    <section
      id="publications"
      className="publications section-pad"
      aria-labelledby="publications-title"
    >
      <div className="measure-wide publications-heading">
        <div>
          <p className="section-label">Publications</p>
          <h2 id="publications-title">Ideas that shape the work.</h2>
        </div>
        <p>
          Oluwabiyi Adeyemo’s public-interest writing connects health access,
          public systems, technology and accountable implementation.
        </p>
      </div>
      <div className="measure-wide publication-list publication-list--covers">
        {publications.map((publication) => (
          <article key={publication.slug}>
            {publication.cover ? (
              <Image
                className="publication-cover"
                src={publication.cover}
                width={1320}
                height={1688}
                alt={`${publication.title} front cover`}
                sizes="(max-width: 640px) 112px, 170px"
              />
            ) : (
              <div className="publication-cover-placeholder" aria-hidden="true">
                <BookOpenText size={34} />
                <span>In development</span>
              </div>
            )}
            <div className="publication-copy">
              <span className="publication-status">{publication.status}</span>
              <h3>{publication.title}</h3>
              <p>{publication.description}</p>
              <div
                className="publication-tags"
                aria-label={`${publication.title} subjects`}
              >
                {publication.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <a
              className="publication-action"
              href={`/publications/${publication.slug}`}
            >
              {publication.status === "Available"
                ? "Access publication"
                : "View the series"}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
