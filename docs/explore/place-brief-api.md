# Explore place-brief API

`GET /api/evidence/v1/place-brief` returns the versioned county evidence contract.

## Query parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `kind` | yes | Canonical typed-geography selector. The current public contract accepts `county`. |
| `geoid` | yes | Five-digit U.S. Census county or county-equivalent GEOID. |
| `geography` | deprecated | Compatibility alias for `kind`. If both are supplied they must match exactly. |

Examples:

```text
/api/evidence/v1/place-brief?kind=county&geoid=36001
/api/evidence/v1/place-brief?geography=county&geoid=36001
```

Requests without a type, with an unsupported type, or with conflicting `kind` and `geography` values return `400`. County evidence remains county-scoped; a ZIP Code, Census place, or city must be resolved through the Explore geography workflow before this endpoint is called.
