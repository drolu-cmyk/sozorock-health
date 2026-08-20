export type PublicationSubdivision = {
  code: string;
  name: string;
  type: string;
};

export type PublicationCountry = {
  code: string;
  name: string;
};

// ISO 3166 country coverage for the public access form. Selected high-volume
// jurisdictions also use structured ISO 3166-2 subdivisions; other countries
// remain globally inclusive through a required free-text administrative area.
export const PUBLICATION_COUNTRIES: readonly PublicationCountry[] = [
  ["AF","Afghanistan"],["AL","Albania"],["DZ","Algeria"],["AS","American Samoa"],["AD","Andorra"],["AO","Angola"],["AI","Anguilla"],["AQ","Antarctica"],["AG","Antigua and Barbuda"],["AR","Argentina"],["AM","Armenia"],["AW","Aruba"],["AU","Australia"],["AT","Austria"],["AZ","Azerbaijan"],["BS","Bahamas"],["BH","Bahrain"],["BD","Bangladesh"],["BB","Barbados"],["BY","Belarus"],["BE","Belgium"],["BZ","Belize"],["BJ","Benin"],["BM","Bermuda"],["BT","Bhutan"],["BO","Bolivia"],["BQ","Bonaire, Sint Eustatius and Saba"],["BA","Bosnia and Herzegovina"],["BW","Botswana"],["BV","Bouvet Island"],["BR","Brazil"],["IO","British Indian Ocean Territory"],["BN","Brunei Darussalam"],["BG","Bulgaria"],["BF","Burkina Faso"],["BI","Burundi"],["CV","Cabo Verde"],["KH","Cambodia"],["CM","Cameroon"],["CA","Canada"],["KY","Cayman Islands"],["CF","Central African Republic"],["TD","Chad"],["CL","Chile"],["CN","China"],["CX","Christmas Island"],["CC","Cocos (Keeling) Islands"],["CO","Colombia"],["KM","Comoros"],["CG","Congo"],["CD","Congo, Democratic Republic of the"],["CK","Cook Islands"],["CR","Costa Rica"],["HR","Croatia"],["CU","Cuba"],["CW","Curaçao"],["CY","Cyprus"],["CZ","Czechia"],["CI","Côte d'Ivoire"],["DK","Denmark"],["DJ","Djibouti"],["DM","Dominica"],["DO","Dominican Republic"],["EC","Ecuador"],["EG","Egypt"],["SV","El Salvador"],["GQ","Equatorial Guinea"],["ER","Eritrea"],["EE","Estonia"],["SZ","Eswatini"],["ET","Ethiopia"],["FK","Falkland Islands"],["FO","Faroe Islands"],["FJ","Fiji"],["FI","Finland"],["FR","France"],["GF","French Guiana"],["PF","French Polynesia"],["TF","French Southern Territories"],["GA","Gabon"],["GM","Gambia"],["GE","Georgia"],["DE","Germany"],["GH","Ghana"],["GI","Gibraltar"],["GR","Greece"],["GL","Greenland"],["GD","Grenada"],["GP","Guadeloupe"],["GU","Guam"],["GT","Guatemala"],["GG","Guernsey"],["GN","Guinea"],["GW","Guinea-Bissau"],["GY","Guyana"],["HT","Haiti"],["HM","Heard Island and McDonald Islands"],["VA","Holy See"],["HN","Honduras"],["HK","Hong Kong"],["HU","Hungary"],["IS","Iceland"],["IN","India"],["ID","Indonesia"],["IR","Iran"],["IQ","Iraq"],["IE","Ireland"],["IM","Isle of Man"],["IL","Israel"],["IT","Italy"],["JM","Jamaica"],["JP","Japan"],["JE","Jersey"],["JO","Jordan"],["KZ","Kazakhstan"],["KE","Kenya"],["KI","Kiribati"],["KP","Korea, Democratic People's Republic of"],["KR","Korea, Republic of"],["KW","Kuwait"],["KG","Kyrgyzstan"],["LA","Lao People's Democratic Republic"],["LV","Latvia"],["LB","Lebanon"],["LS","Lesotho"],["LR","Liberia"],["LY","Libya"],["LI","Liechtenstein"],["LT","Lithuania"],["LU","Luxembourg"],["MO","Macao"],["MG","Madagascar"],["MW","Malawi"],["MY","Malaysia"],["MV","Maldives"],["ML","Mali"],["MT","Malta"],["MH","Marshall Islands"],["MQ","Martinique"],["MR","Mauritania"],["MU","Mauritius"],["YT","Mayotte"],["MX","Mexico"],["FM","Micronesia"],["MD","Moldova"],["MC","Monaco"],["MN","Mongolia"],["ME","Montenegro"],["MS","Montserrat"],["MA","Morocco"],["MZ","Mozambique"],["MM","Myanmar"],["NA","Namibia"],["NR","Nauru"],["NP","Nepal"],["NL","Netherlands"],["NC","New Caledonia"],["NZ","New Zealand"],["NI","Nicaragua"],["NE","Niger"],["NG","Nigeria"],["NU","Niue"],["NF","Norfolk Island"],["MK","North Macedonia"],["MP","Northern Mariana Islands"],["NO","Norway"],["OM","Oman"],["PK","Pakistan"],["PW","Palau"],["PS","Palestine, State of"],["PA","Panama"],["PG","Papua New Guinea"],["PY","Paraguay"],["PE","Peru"],["PH","Philippines"],["PN","Pitcairn"],["PL","Poland"],["PT","Portugal"],["PR","Puerto Rico"],["QA","Qatar"],["RO","Romania"],["RU","Russian Federation"],["RW","Rwanda"],["RE","Réunion"],["BL","Saint Barthélemy"],["SH","Saint Helena"],["KN","Saint Kitts and Nevis"],["LC","Saint Lucia"],["MF","Saint Martin"],["PM","Saint Pierre and Miquelon"],["VC","Saint Vincent and the Grenadines"],["WS","Samoa"],["SM","San Marino"],["ST","Sao Tome and Principe"],["SA","Saudi Arabia"],["SN","Senegal"],["RS","Serbia"],["SC","Seychelles"],["SL","Sierra Leone"],["SG","Singapore"],["SX","Sint Maarten"],["SK","Slovakia"],["SI","Slovenia"],["SB","Solomon Islands"],["SO","Somalia"],["ZA","South Africa"],["GS","South Georgia and the South Sandwich Islands"],["SS","South Sudan"],["ES","Spain"],["LK","Sri Lanka"],["SD","Sudan"],["SR","Suriname"],["SJ","Svalbard and Jan Mayen"],["SE","Sweden"],["CH","Switzerland"],["SY","Syrian Arab Republic"],["TW","Taiwan"],["TJ","Tajikistan"],["TZ","Tanzania"],["TH","Thailand"],["TL","Timor-Leste"],["TG","Togo"],["TK","Tokelau"],["TO","Tonga"],["TT","Trinidad and Tobago"],["TN","Tunisia"],["TM","Turkmenistan"],["TC","Turks and Caicos Islands"],["TV","Tuvalu"],["TR","Türkiye"],["UG","Uganda"],["UA","Ukraine"],["AE","United Arab Emirates"],["GB","United Kingdom"],["US","United States"],["UM","United States Minor Outlying Islands"],["UY","Uruguay"],["UZ","Uzbekistan"],["VU","Vanuatu"],["VE","Venezuela"],["VN","Viet Nam"],["VG","Virgin Islands, British"],["VI","Virgin Islands, U.S."],["WF","Wallis and Futuna"],["EH","Western Sahara"],["YE","Yemen"],["ZM","Zambia"],["ZW","Zimbabwe"],["AX","Åland Islands"],
].map(([code, name]) => ({ code, name }));

function mappedSubdivisions(countryCode: string, type: string, entries: readonly string[]) {
  return entries.map((entry) => {
    const separator = entry.indexOf(":");
    const code = entry.slice(0, separator);
    const name = entry.slice(separator + 1);
    return { code: `${countryCode}-${code}`, name, type };
  });
}

const subdivisions: Record<string, readonly PublicationSubdivision[]> = {
  US: mappedSubdivisions("US", "State or territory", [
    "AL:Alabama","AK:Alaska","AZ:Arizona","AR:Arkansas","CA:California","CO:Colorado","CT:Connecticut","DE:Delaware","DC:District of Columbia","FL:Florida","GA:Georgia","HI:Hawaii","ID:Idaho","IL:Illinois","IN:Indiana","IA:Iowa","KS:Kansas","KY:Kentucky","LA:Louisiana","ME:Maine","MD:Maryland","MA:Massachusetts","MI:Michigan","MN:Minnesota","MS:Mississippi","MO:Missouri","MT:Montana","NE:Nebraska","NV:Nevada","NH:New Hampshire","NJ:New Jersey","NM:New Mexico","NY:New York","NC:North Carolina","ND:North Dakota","OH:Ohio","OK:Oklahoma","OR:Oregon","PA:Pennsylvania","RI:Rhode Island","SC:South Carolina","SD:South Dakota","TN:Tennessee","TX:Texas","UT:Utah","VT:Vermont","VA:Virginia","WA:Washington","WV:West Virginia","WI:Wisconsin","WY:Wyoming","PR:Puerto Rico","GU:Guam","VI:Virgin Islands, U.S.","AS:American Samoa","MP:Northern Mariana Islands",
  ]),
  CA: mappedSubdivisions("CA", "Province or territory", ["AB:Alberta","BC:British Columbia","MB:Manitoba","NB:New Brunswick","NL:Newfoundland and Labrador","NS:Nova Scotia","NT:Northwest Territories","NU:Nunavut","ON:Ontario","PE:Prince Edward Island","QC:Quebec","SK:Saskatchewan","YT:Yukon"]),
  NG: [
    ...mappedSubdivisions("NG", "State", ["AB:Abia","AD:Adamawa","AK:Akwa Ibom","AN:Anambra","BA:Bauchi","BY:Bayelsa","BE:Benue","BO:Borno","CR:Cross River","DE:Delta","EB:Ebonyi","ED:Edo","EK:Ekiti","EN:Enugu","GO:Gombe","IM:Imo","JI:Jigawa","KD:Kaduna","KN:Kano","KT:Katsina","KE:Kebbi","KO:Kogi","KW:Kwara","LA:Lagos","NA:Nasarawa","NI:Niger","OG:Ogun","ON:Ondo","OS:Osun","OY:Oyo","PL:Plateau","RI:Rivers","SO:Sokoto","TA:Taraba","YO:Yobe","ZA:Zamfara"]),
    { code: "NG-FC", name: "Abuja Federal Capital Territory", type: "Capital territory" },
  ],
  AU: mappedSubdivisions("AU", "State or territory", ["ACT:Australian Capital Territory","NSW:New South Wales","NT:Northern Territory","QLD:Queensland","SA:South Australia","TAS:Tasmania","VIC:Victoria","WA:Western Australia"]),
  GB: mappedSubdivisions("GB", "Country or province", ["ENG:England","NIR:Northern Ireland","SCT:Scotland","WLS:Wales"]),
  ZA: mappedSubdivisions("ZA", "Province", ["EC:Eastern Cape","FS:Free State","GP:Gauteng","KZN:KwaZulu-Natal","LP:Limpopo","MP:Mpumalanga","NC:Northern Cape","NW:North West","WC:Western Cape"]),
  IN: mappedSubdivisions("IN", "State or union territory", [
    "AP:Andhra Pradesh","AR:Arunachal Pradesh","AS:Assam","BR:Bihar","CG:Chhattisgarh","GA:Goa","GJ:Gujarat","HR:Haryana","HP:Himachal Pradesh","JH:Jharkhand","KA:Karnataka","KL:Kerala","MP:Madhya Pradesh","MH:Maharashtra","MN:Manipur","ML:Meghalaya","MZ:Mizoram","NL:Nagaland","OD:Odisha","PB:Punjab","RJ:Rajasthan","SK:Sikkim","TN:Tamil Nadu","TG:Telangana","TR:Tripura","UP:Uttar Pradesh","UK:Uttarakhand","WB:West Bengal","AN:Andaman and Nicobar Islands","CH:Chandigarh","DH:Dadra and Nagar Haveli and Daman and Diu","DL:Delhi","JK:Jammu and Kashmir","LA:Ladakh","LD:Lakshadweep","PY:Puducherry",
  ]),
  BR: mappedSubdivisions("BR", "State or federal district", [
    "AC:Acre","AL:Alagoas","AP:Amapá","AM:Amazonas","BA:Bahia","CE:Ceará","DF:Distrito Federal","ES:Espírito Santo","GO:Goiás","MA:Maranhão","MT:Mato Grosso","MS:Mato Grosso do Sul","MG:Minas Gerais","PA:Pará","PB:Paraíba","PR:Paraná","PE:Pernambuco","PI:Piauí","RJ:Rio de Janeiro","RN:Rio Grande do Norte","RS:Rio Grande do Sul","RO:Rondônia","RR:Roraima","SC:Santa Catarina","SP:São Paulo","SE:Sergipe","TO:Tocantins",
  ]),
  MX: mappedSubdivisions("MX", "State or federal entity", [
    "AGU:Aguascalientes","BCN:Baja California","BCS:Baja California Sur","CAM:Campeche","CHP:Chiapas","CHH:Chihuahua","CMX:Ciudad de México","COA:Coahuila de Zaragoza","COL:Colima","DUR:Durango","GUA:Guanajuato","GRO:Guerrero","HID:Hidalgo","JAL:Jalisco","MEX:México","MIC:Michoacán de Ocampo","MOR:Morelos","NAY:Nayarit","NLE:Nuevo León","OAX:Oaxaca","PUE:Puebla","QUE:Querétaro","ROO:Quintana Roo","SLP:San Luis Potosí","SIN:Sinaloa","SON:Sonora","TAB:Tabasco","TAM:Tamaulipas","TLA:Tlaxcala","VER:Veracruz de Ignacio de la Llave","YUC:Yucatán","ZAC:Zacatecas",
  ]),
};

const countryByCode = new Map(PUBLICATION_COUNTRIES.map((country) => [country.code, country]));
const countryByName = new Map(PUBLICATION_COUNTRIES.map((country) => [country.name.toLowerCase(), country]));

export function getPublicationCountry(value: string) {
  const normalized = value.trim();
  return countryByCode.get(normalized.toUpperCase()) ?? countryByName.get(normalized.toLowerCase());
}

export function getPublicationSubdivisions(countryValue: string) {
  const country = getPublicationCountry(countryValue);
  return country ? subdivisions[country.code] ?? [] : [];
}

export function isStructuredSubdivision(countryValue: string) {
  return getPublicationSubdivisions(countryValue).length > 0;
}

export function isValidPublicationSubdivision(countryValue: string, subdivisionValue: string) {
  const options = getPublicationSubdivisions(countryValue);
  if (!options.length) return subdivisionValue.trim().length >= 2;
  const normalized = subdivisionValue.trim().toLowerCase();
  return options.some((option) => option.code.toLowerCase() === normalized || option.name.toLowerCase() === normalized);
}

export function publicationSubdivisionLabel(countryValue: string) {
  const options = getPublicationSubdivisions(countryValue);
  const types = [...new Set(options.map((option) => option.type.toLowerCase()))];
  if (!types.length) return "State, province, region, county, department, or equivalent";
  if (types.length === 1) return options[0]?.type ?? "Administrative area";
  return "State, province, territory, or equivalent";
}
