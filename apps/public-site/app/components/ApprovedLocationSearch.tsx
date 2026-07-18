"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type RemoteResult = {
  id: string;
  kind: "county" | "place" | "zip";
  label: string;
  geoid: string;
  stateFips: string;
};

type Suggestion = RemoteResult & {
  display: string;
  kindLabel: string;
};

const stateCodes: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY",
};

function toSuggestion(result: RemoteResult): Suggestion {
  const cleanPlaceName =
    result.kind === "place"
      ? result.label.replace(/\s+(city|town|village|borough|CDP)$/i, "")
      : result.label;

  return {
    ...result,
    display:
      result.kind === "zip"
        ? result.label.replace(/^ZIP\s+/i, "")
        : `${cleanPlaceName}${stateCodes[result.stateFips] ? `, ${stateCodes[result.stateFips]}` : ""}`,
    kindLabel:
      result.kind === "county"
        ? "County"
        : result.kind === "zip"
          ? "ZIP Code"
          : "City or place",
  };
}

export function ApprovedLocationSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RemoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [message, setMessage] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const listId = "approved-place-suggestions";

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || selected?.display === query) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(
          `/api/locations?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search unavailable");
        const data = (await response.json()) as { results?: RemoteResult[] };
        setResults(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage(
            "Place search is temporarily unavailable. Please try again shortly.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 240);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  const suggestions = useMemo(
    () => results.slice(0, 8).map(toSuggestion),
    [results],
  );

  const choose = (result: (typeof suggestions)[number]) => {
    setSelected(result);
    setQuery(result.display);
    setResults([]);
    setActiveIndex(-1);
    setMessage(
      `${result.display} is open for a SozoRock Health readiness or partnership conversation.`,
    );
    window.requestAnimationFrame(() => resultRef.current?.focus());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selected?.display === query.trim()) {
      setMessage(
        `${selected.display} is open for a SozoRock Health readiness or partnership conversation.`,
      );
      window.requestAnimationFrame(() => resultRef.current?.focus());
      return;
    }
    const choice = suggestions[activeIndex] ?? suggestions[0];
    if (choice) {
      choose(choice);
      return;
    }

    const term = query.trim();
    if (!term) {
      setMessage("Enter a ZIP Code, city or county to begin.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/locations?q=${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error("Search unavailable");
      const data = (await response.json()) as { results?: RemoteResult[] };
      const immediateChoice = data.results?.[0];
      if (immediateChoice) {
        choose(toSuggestion(immediateChoice));
      } else {
        setResults([]);
        setMessage("No exact match yet. Try another ZIP Code, city or county.");
      }
    } catch {
      setMessage("Place search is temporarily unavailable. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveIndex((value) => Math.min(value + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveIndex((value) => Math.max(value - 1, 0));
    } else if (event.key === "Escape") {
      setResults([]);
      setActiveIndex(-1);
    }
  };

  return (
    <section
      id="place-search"
      className="place section-pad"
      aria-labelledby="place-title"
    >
      <div className="measure-wide place-layout">
        <div>
          <p className="section-label section-label--light">
            National by design
          </p>
          <h2 id="place-title">The barrier changes with the ZIP Code.</h2>
          <p>
            Begin with a ZIP Code, city or county—then see the local pathways
            and partnership status that are actually available.
          </p>
        </div>
        <form className="place-form" onSubmit={submit} role="search" noValidate>
          <label htmlFor="place-input">ZIP Code, city or county</label>
          <div className="place-input-wrap">
            <input
              id="place-input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
                setActiveIndex(-1);
                setMessage("");
              }}
              onKeyDown={onKeyDown}
              placeholder="Example: Delaware County, NY"
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? suggestions[activeIndex]?.id : undefined
              }
            />
            <button type="submit" aria-busy={loading}>
              {loading ? "Searching…" : "Explore the place"}
            </button>
            {suggestions.length > 0 && (
              <div
                id={listId}
                className="place-suggestions"
                role="listbox"
                aria-label="U.S. place suggestions"
              >
                {suggestions.map((result, index) => (
                  <button
                    id={result.id}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    className={activeIndex === index ? "is-active" : ""}
                    key={result.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(result)}
                  >
                    <strong>{result.display}</strong>
                    <span>{result.kindLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="place-status" aria-live="polite">
            {loading ? "Looking across U.S. communities…" : message}
          </p>
          {selected && (
            <div
              ref={resultRef}
              className="place-result"
              tabIndex={-1}
              aria-label={`Selected place: ${selected.display}`}
            >
              <div>
                <span>{selected.kindLabel}</span>
                <strong>{selected.display}</strong>
                <p>Available for a readiness or partnership conversation.</p>
              </div>
              <a
                href={`/contact?interest=${encodeURIComponent("Bring the model to a community")}&location=${encodeURIComponent(selected.display)}`}
              >
                Start a local conversation
              </a>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
