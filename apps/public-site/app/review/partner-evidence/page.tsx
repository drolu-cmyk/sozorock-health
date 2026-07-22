import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  isConcernSignal,
  PARTNER_EVIDENCE_REVIEW_CASES,
  type CaseForActionPackage,
  type DecisionSupportSignal,
} from "@sozorock/evidence-core";
import { partnerEvidenceReviewEnabled } from "./review-access";
import styles from "./partner-evidence.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partner Evidence Review",
  description: "Review-only SozoRock Health case-for-action evidence brief.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

type PlaceKey = keyof typeof PARTNER_EVIDENCE_REVIEW_CASES;
type ViewMode = "public" | "internal";

function safePlace(value: string | string[] | undefined): PlaceKey {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected === "bexar" ? "bexar" : "albany";
}
function safeMode(value: string | string[] | undefined): ViewMode {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected === "internal" ? "internal" : "public";
}

function date(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`));
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function statusLabel(value: CaseForActionPackage["evidenceStatus"][keyof CaseForActionPackage["evidenceStatus"]]) {
  if (value === "verified") return "Verified";
  if (value === "not_yet_verified") return "Not yet verified";
  if (value === "no_verified_records") return "No verified records";
  if (value === "stale") return "Stale";
  return "Unavailable";
}

function signalLabel(signal: DecisionSupportSignal) {
  if (signal.interpretation === "adverse_signal") return isConcernSignal(signal) ? "Needs local attention" : "Direction check required";
  if (signal.interpretation === "favorable_signal") return "Favorable context";
  if (signal.interpretation === "similar") return "Similar to comparison";
  return "Context only";
}

function EvidenceStatusCard({ title, value, detail }: { title: string; value: CaseForActionPackage["evidenceStatus"][keyof CaseForActionPackage["evidenceStatus"]]; detail: string }) {
  const tone = value === "verified" ? styles.statusVerified : value === "stale" ? styles.statusStale : styles.statusPending;
  return (
    <article className={`${styles.statusCard} ${tone}`}>
      <p>{title}</p>
      <strong>{statusLabel(value)}</strong>
      <span>{detail}</span>
    </article>
  );
}

function BenchmarkFigure({ value }: { value: CaseForActionPackage }) {
  return (
    <figure className={styles.benchmarkFigure} aria-labelledby="benchmark-title">
      <figcaption>
        <div>
          <p className={styles.sectionIndex}>Current public-data context</p>
          <h2 id="benchmark-title">Read the direction before the number.</h2>
        </div>
        <p>{value.publicData.publicStatement}</p>
      </figcaption>
      <div className={styles.chartLegend} aria-label="Chart legend">
        <span><i className={styles.localKey} />{value.place.displayName}</span>
        <span><i className={styles.comparisonKey} />U.S. county estimate average</span>
      </div>
      <div className={styles.benchmarkRows}>
        {value.publicData.signals.map((signal) => (
          <article className={styles.benchmarkRow} key={signal.id}>
            <div className={styles.metricIntro}>
              <div><h3>{signal.label}</h3><p>{signal.definition}</p></div>
              <span className={isConcernSignal(signal) ? styles.signalConcern : styles.signalContext}>{signalLabel(signal)}</span>
            </div>
            <div className={styles.barGroup} aria-label={`${signal.label}: ${signal.localValue}% in ${value.place.displayName}; ${signal.comparisonValue}% ${signal.comparisonLabel.toLowerCase()}`}>
              <div className={styles.barLine}>
                <span className={styles.barName}>Place</span>
                <div className={styles.barTrack}><i className={isConcernSignal(signal) ? styles.barConcern : styles.barLocal} style={{ width: `${signal.localValue}%` }} /></div>
                <strong>{signal.localValue.toFixed(1)}%</strong>
              </div>
              <div className={styles.barLine}>
                <span className={styles.barName}>U.S. counties</span>
                <div className={styles.barTrack}><i className={styles.barComparison} style={{ width: `${signal.comparisonValue}%` }} /></div>
                <strong>{signal.comparisonValue.toFixed(1)}%</strong>
              </div>
            </div>
            <p className={styles.metricNote}>95% confidence interval: {signal.confidenceInterval ?? "not reported"} · Release {date(signal.releaseDate)} · {signal.dataPeriod}</p>
          </article>
        ))}
      </div>
      <p className={styles.figureNote}>The comparison is an average across county estimates in the same PLACES release, not a population-weighted national prevalence estimate.</p>
    </figure>
  );
}

function Pathway({ value }: { value: CaseForActionPackage }) {
  return (
    <section className={styles.pathwaySection} aria-labelledby="pathway-title">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionIndex}>Evidence pathway</p>
        <h2 id="pathway-title">From signal to a decision worth testing.</h2>
        <p>{value.responseConcept.summary}</p>
      </div>
      <ol className={styles.pathwayList}>
        {value.responseConcept.pathway.map((item) => (
          <li key={item.stage} data-status={item.status}>
            <span>{item.stage}</span>
            <p>{item.statement}</p>
            <small>{item.status === "verified" ? "Verified evidence" : item.status === "missing" ? "Evidence missing" : "Partner review required"}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SourceLedger({ value }: { value: CaseForActionPackage }) {
  return (
    <section className={styles.sourceSection} aria-labelledby="sources-title">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionIndex}>Source ledger</p>
        <h2 id="sources-title">Every visible claim keeps its dates and scope.</h2>
      </div>
      <div className={styles.sourceTableWrap}>
        <table>
          <thead><tr><th>Source</th><th>Release</th><th>Data period</th><th>Geography</th><th>Review status</th></tr></thead>
          <tbody>{value.sources.map((source) => (
            <tr key={source.id}>
              <th scope="row"><a href={source.officialUrl} target="_blank" rel="noreferrer">{source.title}</a><span>{source.publisher}</span></th>
              <td>{date(source.releaseDate)}</td>
              <td>{source.dataPeriod}</td>
              <td>{source.geography}</td>
              <td><span className={source.reviewStatus === "verified" ? styles.sourceVerified : styles.sourcePending}>{source.reviewStatus === "verified" ? "Verified" : "Provisional"}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function InternalReview({ value }: { value: CaseForActionPackage }) {
  return (
    <section className={styles.internalSection} aria-labelledby="internal-title">
      <div className={styles.sectionHeading}>
        <p className={styles.sectionIndex}>Internal source review</p>
        <h2 id="internal-title">What reviewers still need to decide.</h2>
        <p>{value.internalReview.summary}</p>
      </div>
      <div className={styles.reviewGrid}>
        {value.internalReview.claimsAwaitingReview.map((claim) => (
          <article key={claim.id}>
            <header><span>{claim.type.replaceAll("_", " ")}</span><strong>Provisional</strong></header>
            <h3>{claim.statement}</h3>
            <blockquote>“{claim.exactExcerpt}”</blockquote>
            <p>Page {claim.page} · {claim.section}</p>
          </article>
        ))}
      </div>
      <div className={styles.reviewDecisions}>
        <h3>Required decisions</h3>
        <ul>{value.internalReview.decisionsRequired.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </section>
  );
}

export default async function PartnerEvidenceReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!partnerEvidenceReviewEnabled()) notFound();
  const params = await searchParams;
  const place = safePlace(params.place);
  const mode = safeMode(params.mode);
  const value = PARTNER_EVIDENCE_REVIEW_CASES[place];
  const alternatePlace: PlaceKey = place === "albany" ? "bexar" : "albany";

  return (
    <main className={styles.page}>
      <a className={styles.skipLink} href="#evidence-main">Skip to evidence</a>
      <header className={styles.topbar}>
        <div className={styles.brand}><strong>SozoRock<sup>®</sup> Health</strong><span>Partner evidence review</span></div>
        <nav aria-label="Review controls">
          <div><span>Geography</span><div className={styles.segmented}><Link aria-current={place === "albany" ? "page" : undefined} href={`?place=albany&mode=${mode}`}>Albany County, NY</Link><Link aria-current={place === "bexar" ? "page" : undefined} href={`?place=bexar&mode=${mode}`}>Bexar County, TX</Link></div></div>
          <div><span>View</span><div className={styles.segmented}><Link aria-current={mode === "public" ? "page" : undefined} href={`?place=${place}&mode=public`}>Public preview</Link><Link aria-current={mode === "internal" ? "page" : undefined} href={`?place=${place}&mode=internal`}>Internal detail</Link></div></div>
        </nav>
      </header>

      <div id="evidence-main" className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Case for action · {value.place.displayName}</p>
            <h1>A case for action—without inventing one.</h1>
            <p>{value.executiveSummary}</p>
            <div className={styles.heroActions}>
              <a className={styles.downloadButton} href={`/review/partner-evidence/download/${place}`}>Download evidence brief <span aria-hidden="true">↓</span></a>
              <Link href={`?place=${alternatePlace}&mode=${mode}`}>Compare the other pilot <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <aside className={styles.reviewNotice} aria-label="Review status">
            <strong>Review only</strong>
            <p>For language, evidence, and visual review. Not approved for public distribution.</p>
            <span>Editable evidence brief · Generated {date(value.generatedAt)}</span>
          </aside>
        </section>

        <section className={styles.executiveSection} aria-labelledby="summary-title">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionIndex}>Executive summary</p>
            <h2 id="summary-title">What can be said now.</h2>
          </div>
          <div className={styles.statusGrid}>
            <EvidenceStatusCard title="Local-plan alignment" value={value.evidenceStatus.localPlan} detail={value.localPlan.publicStatement} />
            <EvidenceStatusCard title="Current public data" value={value.evidenceStatus.publicData} detail={`${value.publicData.signals.length} reviewed county-level measures are shown.`} />
            <EvidenceStatusCard title="Verified assets" value={value.evidenceStatus.resourceCoverage} detail={value.resourceCoverage.publicStatement} />
          </div>
        </section>

        <BenchmarkFigure value={value} />
        <Pathway value={value} />

        <section className={styles.decisionGrid}>
          <article>
            <p className={styles.sectionIndex}>Potential SozoRock response</p>
            <h2>{value.responseConcept.title}</h2>
            <span className={styles.fitBadge}>{value.responseConcept.status}</span>
            <p>{value.responseConcept.summary}</p>
          </article>
          <article>
            <p className={styles.sectionIndex}>Evidence gaps</p>
            <h2>What must be closed first.</h2>
            <ul>{value.evidenceGaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
          </article>
          <article>
            <p className={styles.sectionIndex}>Measures of progress</p>
            <h2>Proposed—not promised.</h2>
            <ul>{value.progressMeasures.map((measure) => <li key={measure.id}><strong>{measure.label}</strong><span>{measure.definition}</span></li>)}</ul>
          </article>
        </section>

        <SourceLedger value={value} />
        {mode === "internal" ? <InternalReview value={value} /> : null}

        <footer className={styles.disclosures}>
          <div><strong>Boundaries and disclosures</strong>{value.disclosures.map((item) => <p key={item}>{item}</p>)}</div>
          <p>{value.place.geographyCaveat}</p>
        </footer>
      </div>
    </main>
  );
}
