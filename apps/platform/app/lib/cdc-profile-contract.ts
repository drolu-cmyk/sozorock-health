import type { BarrierIndicators, ConditionIndicators, PreventionIndicators } from "./types";

export const cdcProfileSources = {
  place: {
    id: "vgc8-iyc4",
    label: "CDC PLACES: Place Data (GIS Friendly Format), 2025 release",
    url: "https://data.cdc.gov/d/vgc8-iyc4",
  },
  zcta: {
    id: "kee5-23sr",
    label: "CDC PLACES: ZCTA Data (GIS Friendly Format), 2025 release",
    url: "https://data.cdc.gov/d/kee5-23sr",
  },
} as const;

export const cdcConditionFields: Record<keyof ConditionIndicators, [string, string]> = {
  highBloodPressure: ["bphigh_crudeprev", "bphigh_crude95ci"],
  diabetes: ["diabetes_crudeprev", "diabetes_crude95ci"],
  coronaryHeartDisease: ["chd_crudeprev", "chd_crude95ci"],
  stroke: ["stroke_crudeprev", "stroke_crude95ci"],
  cancer: ["cancer_crudeprev", "cancer_crude95ci"],
  asthma: ["casthma_crudeprev", "casthma_crude95ci"],
  copd: ["copd_crudeprev", "copd_crude95ci"],
  depression: ["depression_crudeprev", "depression_crude95ci"],
  obesity: ["obesity_crudeprev", "obesity_crude95ci"],
};

export const cdcBarrierFields: Record<keyof BarrierIndicators, [string, string]> = {
  uninsured: ["access2_crudeprev", "access2_crude95ci"],
  transportation: ["lacktrpt_crudeprev", "lacktrpt_crude95ci"],
  foodInsecurity: ["foodinsecu_crudeprev", "foodinsecu_crude95ci"],
  housingInsecurity: ["housinsecu_crudeprev", "housinsecu_crude95ci"],
  utilityShutoff: ["shututility_crudeprev", "shututility_crude95ci"],
  loneliness: ["loneliness_crudeprev", "loneliness_crude95ci"],
  disability: ["disability_crudeprev", "disability_crude95ci"],
};

export const cdcPreventionFields: Record<keyof PreventionIndicators, [string, string]> = {
  annualCheckup: ["checkup_crudeprev", "checkup_crude95ci"],
  dentalVisit: ["dental_crudeprev", "dental_crude95ci"],
  cholesterolScreening: ["cholscreen_crudeprev", "cholscreen_crude95ci"],
  colorectalScreening: ["colon_screen_crudeprev", "colon_screen_crude95ci"],
  mammography: ["mammouse_crudeprev", "mammouse_crude95ci"],
};

const cdcMetricFields = [
  ...Object.values(cdcConditionFields).flat(),
  ...Object.values(cdcBarrierFields).flat(),
  ...Object.values(cdcPreventionFields).flat(),
];

export const cdcProfileFieldsByKind = {
  place: [
    "stateabbr", "statedesc", "placename", "locationname", "placefips",
    "totalpopulation", "totalpop18plus",
    ...cdcMetricFields.filter((field) => !field.startsWith("loneliness_")),
  ],
  zcta: [
    "zcta5", "totalpopulation", "totalpop18plus", ...cdcMetricFields,
  ],
} as const;
