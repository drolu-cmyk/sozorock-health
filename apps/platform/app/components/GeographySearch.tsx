"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MagnifyingGlass, SpinnerGap } from "@phosphor-icons/react";
import type {
  GeographySearchResponse,
  GeographySuggestion,
  VerifiedGeographySuggestion,
} from "../lib/types";

const kindLabels: Record<VerifiedGeographySuggestion["kind"], string> = {
  state: "State summary",
  county: "County",
  place: "City / Census place",
  locality: "Town / county subdivision",
  community: "Named community",
  zcta: "Census ZCTA",
};

const availabilityLabels: Record<VerifiedGeographySuggestion["dataAvailability"], string> = {
  "derived-county-summary-available": "Derived state summary available",
  "official-modeled-estimates-available": "CDC modeled county estimates available",
  "official-geography-only": "Census geography verified; compatible health estimates unavailable",
  "checked-on-selection": "Health-estimate availability checked after selection",
};

export function GeographySearch({
  onSelect,
}: {
  onSelect: (suggestion: GeographySuggestion) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VerifiedGeographySuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [partial, setPartial] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [committedQuery, setCommittedQuery] = useState<string | null>(null);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (committedQuery === trimmed) {
      setResults([]);
      setStatus("idle");
      setPartial(false);
      setActiveIndex(-1);
      return;
    }
    if (trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      setPartial(false);
      setActiveIndex(-1);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/geography?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search unavailable");
        const body = await response.json() as GeographySearchResponse;
        setResults(body.results ?? []);
        setPartial(body.partial === true);
        setActiveIndex(-1);
        setStatus("ready");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setResults([]);
        setPartial(false);
        setStatus("error");
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [committedQuery, query, retryKey]);

  const choose = (suggestion: VerifiedGeographySuggestion) => {
    onSelect(suggestion);
    setCommittedQuery(suggestion.label);
    setQuery(suggestion.label);
    setResults([]);
    setPartial(false);
    setActiveIndex(-1);
    setStatus("idle");
    inputRef.current?.focus();
  };

  const expanded = committedQuery !== query.trim()
    && query.trim().length >= 2
    && (status === "loading" || status === "ready" || status === "error");

  return (
    <div className="geo-search">
      <label htmlFor={`${listboxId}-input`}>Find any U.S. geography</label>
      <div className="geo-search__field">
        <MagnifyingGlass size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="search"
          value={query}
          placeholder="Place, ZIP, FIPS or GEOID"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={expanded}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          onChange={(event) => {
            setCommittedQuery(null);
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              setActiveIndex((current) => Math.min(current + 1, results.length - 1));
            } else if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              choose(results[activeIndex]);
            } else if (event.key === "Escape") {
              setResults([]);
              setPartial(false);
              setActiveIndex(-1);
              setStatus("idle");
            }
          }}
        />
        {status === "loading" && <SpinnerGap className="geo-search__spinner" size={19} aria-label="Searching" />}
      </div>
      {expanded && (
        <div className="geo-search__menu">
          {status === "loading" && <p role="status">Searching Census geography…</p>}
          {status === "error" && <p role="alert">Search is temporarily unavailable. Try again shortly.</p>}
          {status === "ready" && partial && (
            <p role="status">
              Some Census search sources did not respond, so these results may be incomplete.{" "}
              <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Retry search</button>
            </p>
          )}
          {status === "ready" && !partial && !results.length && <p role="status">No matching geography found.</p>}
          {!!results.length && (
            <ul id={listboxId} role="listbox" aria-label="Geography suggestions">
              {results.map((result, index) => {
                const evidenceSource = result.profileSource ?? result.source;
                return (
                  <li
                    id={`${listboxId}-${index}`}
                    key={result.id}
                    role="option"
                    aria-selected={index === activeIndex}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(result)}
                  >
                    <span>
                      <strong>{result.label}</strong>
                      <small>{result.context}</small>
                      <small>{availabilityLabels[result.dataAvailability]}</small>
                      <small>Source: {evidenceSource.dataset} · {evidenceSource.vintage}</small>
                    </span>
                    <em>{kindLabels[result.kind]}</em>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <p className="geo-search__hint">Search covers 50 states, D.C., 3,144 county equivalents, Census cities and towns, named communities, and ZCTAs.</p>
    </div>
  );
}
