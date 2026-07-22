export type ExploreKind = "county" | "place" | "zip";

export type ExploreMetricDefinition = {
  key: string;
  label: string;
  category: "Chronic conditions" | "Access barriers" | "Prevention";
  field: string;
  plainLanguage: string;
  response: string;
  direction: "adverse" | "protective" | "contextual";
  higherValueMeaning: "adverse" | "favorable" | "context_dependent";
};

export const exploreMetrics: ExploreMetricDefinition[] = [
  {
    key: "diabetes",
    label: "Diabetes",
    category: "Chronic conditions",
    field: "diabetes",
    plainLanguage: "The estimated share of adults living with diagnosed diabetes.",
    response: "Support clear diabetes education, prevention and readiness for provider-led care.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "bphigh",
    label: "High blood pressure",
    category: "Chronic conditions",
    field: "bphigh",
    plainLanguage: "The estimated share of adults who have been told they have high blood pressure.",
    response: "Support awareness, prevention and practical preparation for licensed care.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "obesity",
    label: "Obesity",
    category: "Chronic conditions",
    field: "obesity",
    plainLanguage: "The estimated share of adults with a body mass index in the obesity range.",
    response: "Connect health literacy and prevention activity to local conditions and services.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "depression",
    label: "Depression",
    category: "Chronic conditions",
    field: "depression",
    plainLanguage: "The estimated share of adults who have been told they have a depressive disorder.",
    response: "Make trusted non-clinical pathways and provider-led options easier to understand.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "copd",
    label: "COPD",
    category: "Chronic conditions",
    field: "copd",
    plainLanguage: "The estimated share of adults who have been told they have chronic obstructive pulmonary disease.",
    response: "Support respiratory-health literacy and readiness for licensed care.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "csmoking",
    label: "Current smoking",
    category: "Prevention",
    field: "csmoking",
    plainLanguage: "The estimated share of adults who currently smoke cigarettes.",
    response: "Support prevention education and connection to established public-health resources.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "colon_screen",
    label: "Colorectal cancer screening",
    category: "Prevention",
    field: "colon_screen",
    plainLanguage: "The estimated share of adults ages 45 to 75 who are up to date with colorectal cancer screening.",
    response: "Support clear screening education and preparation for licensed preventive care.",
    direction: "protective",
    higherValueMeaning: "favorable",
  },
  {
    key: "mammouse",
    label: "Mammography use",
    category: "Prevention",
    field: "mammouse",
    plainLanguage: "The estimated share of women ages 50 to 74 who received a mammogram within the recommended period.",
    response: "Support screening awareness and practical preparation for provider-led services.",
    direction: "protective",
    higherValueMeaning: "favorable",
  },
  {
    key: "dental",
    label: "Dental visit",
    category: "Prevention",
    field: "dental",
    plainLanguage: "The estimated share of adults who visited a dentist or dental clinic in the past year.",
    response: "Support oral-health literacy and connection to established dental services.",
    direction: "protective",
    higherValueMeaning: "favorable",
  },
  {
    key: "sleep",
    label: "Short sleep duration",
    category: "Prevention",
    field: "sleep",
    plainLanguage: "The estimated share of adults who usually sleep fewer than seven hours in a 24-hour period.",
    response: "Connect plain-language education about sleep and chronic-disease risk to trusted local resources.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "teethlost",
    label: "All teeth lost",
    category: "Prevention",
    field: "teethlost",
    plainLanguage: "The estimated share of adults age 65 or older who have lost all natural teeth.",
    response: "Support oral-health education and practical pathways to licensed dental care.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "access2",
    label: "Adults without health insurance",
    category: "Access barriers",
    field: "access2",
    plainLanguage: "The estimated share of adults ages 18 to 64 without current health insurance.",
    response: "Make benefits information and provider-led pathways easier to find and use.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "lacktrpt",
    label: "Lack of reliable transportation",
    category: "Access barriers",
    field: "lacktrpt",
    plainLanguage: "The estimated share of adults who could not access needed destinations because transportation was unavailable.",
    response: "Bring non-clinical support closer through hub formats, events and home-based access concepts.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "foodinsecu",
    label: "Food insecurity",
    category: "Access barriers",
    field: "foodinsecu",
    plainLanguage: "The estimated share of adults who experienced limited or uncertain access to enough food.",
    response: "Connect place-based education and support to existing community resources.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "mobility",
    label: "Mobility difficulty",
    category: "Access barriers",
    field: "mobility",
    plainLanguage: "The estimated share of adults who have serious difficulty walking or climbing stairs.",
    response: "Consider home-based access, accessible events and practical digital readiness support.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "disability",
    label: "Any disability",
    category: "Access barriers",
    field: "disability",
    plainLanguage: "The estimated share of adults reporting at least one disability measure.",
    response: "Design access points, communication and technology for a wider range of needs.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
  {
    key: "loneliness",
    label: "Loneliness",
    category: "Access barriers",
    field: "loneliness",
    plainLanguage: "The estimated share of adults who report feeling lonely.",
    response: "Use trusted community settings for education, connection and non-clinical support.",
    direction: "adverse",
    higherValueMeaning: "adverse",
  },
];

export const localPlans: Record<
  string,
  {
    title: string;
    period: string;
    published: string;
    url: string;
    findings: string[];
  }
> = {
  "36025": {
    title: "Delaware County Community Health Assessment and Community Health Improvement Plan",
    period: "2025–2030",
    published: "January 2026",
    url: "https://www.delcony.gov/ph/wp-content/uploads/sites/86/2026/02/CHA-CHIP-Delaware-County-Public-Health-2025-Final.pdf",
    findings: [
      "Transportation and the county’s geographic size can make services difficult to reach.",
      "Provider availability, food security and mental health are identified as community concerns.",
      "The plan calls for coordinated action across public health and community institutions.",
    ],
  },
};

export function fieldFor(kind: ExploreKind, field: string) {
  return `${field}_${kind === "zip" ? "crudeprev" : "adjprev"}`;
}

export function confidenceFieldFor(kind: ExploreKind, field: string) {
  return `${field}_${kind === "zip" ? "crude95ci" : "adj95ci"}`;
}

export function safeGeoid(kind: ExploreKind, value: string) {
  const expected = kind === "county" || kind === "zip" ? 5 : 7;
  const normalized = value.replace(/\D/g, "").slice(0, expected);
  return normalized.length === expected ? normalized : "";
}

export function scoreMetric(
  value: number,
  national: number,
  higherValueMeaning: ExploreMetricDefinition["higherValueMeaning"],
) {
  const difference = value - national;
  if (higherValueMeaning === "adverse") return Math.max(0, difference) * 2;
  if (higherValueMeaning === "favorable") return Math.max(0, -difference) * 2;
  return 0;
}
