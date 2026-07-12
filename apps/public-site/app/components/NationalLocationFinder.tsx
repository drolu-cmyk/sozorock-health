"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, MagnifyingGlass, MapPin } from "@phosphor-icons/react";

const STATES: Record<string, { name: string; abbreviation: string }> = {
  "01": { name: "Alabama", abbreviation: "AL" },
  "02": { name: "Alaska", abbreviation: "AK" },
  "04": { name: "Arizona", abbreviation: "AZ" },
  "05": { name: "Arkansas", abbreviation: "AR" },
  "06": { name: "California", abbreviation: "CA" },
  "08": { name: "Colorado", abbreviation: "CO" },
  "09": { name: "Connecticut", abbreviation: "CT" },
  "10": { name: "Delaware", abbreviation: "DE" },
  "11": { name: "District of Columbia", abbreviation: "DC" },
  "12": { name: "Florida", abbreviation: "FL" },
  "13": { name: "Georgia", abbreviation: "GA" },
  "15": { name: "Hawaii", abbreviation: "HI" },
  "16": { name: "Idaho", abbreviation: "ID" },
  "17": { name: "Illinois", abbreviation: "IL" },
  "18": { name: "Indiana", abbreviation: "IN" },
  "19": { name: "Iowa", abbreviation: "IA" },
  "20": { name: "Kansas", abbreviation: "KS" },
  "21": { name: "Kentucky", abbreviation: "KY" },
  "22": { name: "Louisiana", abbreviation: "LA" },
  "23": { name: "Maine", abbreviation: "ME" },
  "24": { name: "Maryland", abbreviation: "MD" },
  "25": { name: "Massachusetts", abbreviation: "MA" },
  "26": { name: "Michigan", abbreviation: "MI" },
  "27": { name: "Minnesota", abbreviation: "MN" },
  "28": { name: "Mississippi", abbreviation: "MS" },
  "29": { name: "Missouri", abbreviation: "MO" },
  "30": { name: "Montana", abbreviation: "MT" },
  "31": { name: "Nebraska", abbreviation: "NE" },
  "32": { name: "Nevada", abbreviation: "NV" },
  "33": { name: "New Hampshire", abbreviation: "NH" },
  "34": { name: "New Jersey", abbreviation: "NJ" },
  "35": { name: "New Mexico", abbreviation: "NM" },
  "36": { name: "New York", abbreviation: "NY" },
  "37": { name: "North Carolina", abbreviation: "NC" },
  "38": { name: "North Dakota", abbreviation: "ND" },
  "39": { name: "Ohio", abbreviation: "OH" },
  "40": { name: "Oklahoma", abbreviation: "OK" },
  "41": { name: "Oregon", abbreviation: "OR" },
  "42": { name: "Pennsylvania", abbreviation: "PA" },
  "44": { name: "Rhode Island", abbreviation: "RI" },
  "45": { name: "South Carolina", abbreviation: "SC" },
  "46": { name: "South Dakota", abbreviation: "SD" },
  "47": { name: "Tennessee", abbreviation: "TN" },
  "48": { name: "Texas", abbreviation: "TX" },
  "49": { name: "Utah", abbreviation: "UT" },
  "50": { name: "Vermont", abbreviation: "VT" },
  "51": { name: "Virginia", abbreviation: "VA" },
  "53": { name: "Washington", abbreviation: "WA" },
  "54": { name: "West Virginia", abbreviation: "WV" },
  "55": { name: "Wisconsin", abbreviation: "WI" },
  "56": { name: "Wyoming", abbreviation: "WY" },
};

type RemoteResult = {
  id: string;
  kind: "county" | "place" | "zip";
  label: string;
  geoid: string;
  stateFips: string;
};
type SearchResult = RemoteResult & { detail: string; displayLabel: string };

export function NationalLocationFinder() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [remote, setRemote] = useState<RemoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = "national-place-suggestions";

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || selected?.displayLabel === query) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/locations?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as { results?: RemoteResult[] };
        setRemote(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setRemote([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 240);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  const suggestions = useMemo<SearchResult[]>(
    () =>
      remote
        .map((item) => {
          const state = STATES[item.stateFips];
          const displayLabel =
            item.kind === "zip"
              ? item.label
              : `${item.label}${state ? `, ${state.abbreviation}` : ""}`;
          const kindLabel =
            item.kind === "county"
              ? "County FIPS"
              : item.kind === "zip"
                ? "ZIP Code Tabulation Area · GEOID"
                : "U.S. Census place · GEOID";
          return {
            ...item,
            displayLabel,
            detail: `${kindLabel} ${item.geoid}`,
          };
        })
        .filter(
          (item, index, all) =>
            all.findIndex((candidate) => candidate.id === item.id) === index,
        )
        .slice(0, 8),
    [remote],
  );

  const choose = (result: SearchResult) => {
    setSelected(result);
    setQuery(result.displayLabel);
    setSubmitted(false);
    setActiveIndex(-1);
    setRemote([]);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex])
      choose(suggestions[activeIndex]);
    else if (suggestions[0]) choose(suggestions[0]);
    else setSubmitted(true);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((value) => Math.min(value + 1, suggestions.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((value) => Math.max(value - 1, 0));
    }
    if (event.key === "Escape") {
      setRemote([]);
      setActiveIndex(-1);
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    }
  };

  return (
    <section
      className="location-finder"
      id="find-access"
      aria-labelledby="location-finder-heading"
    >
      <div className="location-finder__intro">
        <p className="eyebrow eyebrow--light">Nationwide readiness</p>
        <h2 id="location-finder-heading">Begin with a place.</h2>
        <p>
          Search any U.S. community to begin a local readiness or partnership
          conversation. Results show geography—not claimed programs or active
          sites.
        </p>
      </div>
      <div className="location-finder__search">
        <form onSubmit={submit} className="finder-form" role="search" noValidate>
          <label htmlFor="national-search">
            ZIP code, city, town, county, GEOID, or FIPS code
          </label>
          <div className="finder-input-row">
            <MapPin size={20} aria-hidden="true" />
            <input
              id="national-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
                setSubmitted(false);
                setActiveIndex(-1);
              }}
              onKeyDown={onKeyDown}
              placeholder="ZIP, city, county, place, GEOID, or FIPS"
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? suggestions[activeIndex]?.id : undefined
              }
            />
            <button type="submit">
              <MagnifyingGlass size={18} aria-hidden="true" />
              <span>Find a place</span>
            </button>
          </div>
          {suggestions.length > 0 && !selected && (
            <div
              id={listId}
              className="county-results"
              role="listbox"
              aria-label="U.S. location suggestions"
            >
              {suggestions.map((result, index) => (
                <button
                  id={result.id}
                  role="option"
                  aria-selected={activeIndex === index}
                  className={activeIndex === index ? "is-active" : ""}
                  key={result.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(result)}
                >
                  <strong>{result.displayLabel}</strong>
                  <span>{result.detail}</span>
                </button>
              ))}
            </div>
          )}
          <p className="finder-help">
            Suggestions use U.S. Census Bureau county, place, ZIP geography,
            GEOID, and FIPS data.
          </p>
          <div className="search-status" aria-live="polite">
            {loading
              ? "Looking across U.S. Census geographies…"
              : submitted
                ? "No exact match yet. Try a ZIP, city, county, or five-digit FIPS code."
                : selected
                  ? `${selected.displayLabel} is open for SozoRock Health interest and readiness conversations.`
                  : ""}
          </div>
        </form>
        <a className="location-finder__action" href="#systems">
          See how the layers work <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
