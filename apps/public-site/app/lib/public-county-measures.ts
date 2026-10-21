export type PublicCountyGroup = "conditions" | "barriers" | "prevention";
export const publicCountyMeasures: {group: PublicCountyGroup; key: string; label: string; year: number; population: string}[] = [
  ...[
    ["highBloodPressure", "High blood pressure"], ["diabetes", "Diagnosed diabetes"],
    ["coronaryHeartDisease", "Coronary heart disease"], ["stroke", "Stroke"],
    ["cancer", "Cancer, excluding skin cancer"], ["asthma", "Current asthma"],
    ["copd", "COPD"], ["depression", "Depression"], ["obesity", "Obesity"],
  ].map(([key,label])=>({group:"conditions" as const,key,label,year:2023,population:"Adults aged 18 or older"})),
  ...[
    ["uninsured", "No health insurance"], ["transportation", "Lack of reliable transportation"],
    ["foodInsecurity", "Food insecurity"], ["housingInsecurity", "Housing insecurity"],
    ["utilityShutoff", "Utility shutoff or threat"], ["loneliness", "Loneliness"],
    ["disability", "Any disability"],
  ].map(([key,label])=>({group:"barriers" as const,key,label,year:2023,population:key === "uninsured" ? "Adults aged 18–64" : "Adults aged 18 or older"})),
  {group:"prevention",key:"annualCheckup",label:"Routine checkup in the past year",year:2023,population:"Adults aged 18 or older"},
  {group:"prevention",key:"dentalVisit",label:"Dental visit in the past year",year:2022,population:"Adults aged 18 or older"},
  {group:"prevention",key:"cholesterolScreening",label:"Cholesterol screening in the past five years",year:2023,population:"Adults aged 18 or older"},
  {group:"prevention",key:"colorectalScreening",label:"Colorectal cancer screening",year:2022,population:"Adults aged 45–75"},
  {group:"prevention",key:"mammography",label:"Mammography in the past two years",year:2022,population:"Women aged 50–74"},
];
