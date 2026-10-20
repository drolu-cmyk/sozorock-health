export const NEW_YORK_COUNTIES = [
  "Albany",
  "Allegany",
  "Bronx",
  "Broome",
  "Cattaraugus",
  "Cayuga",
  "Chautauqua",
  "Chemung",
  "Chenango",
  "Clinton",
  "Columbia",
  "Cortland",
  "Delaware",
  "Dutchess",
  "Erie",
  "Essex",
  "Franklin",
  "Fulton",
  "Genesee",
  "Greene",
  "Hamilton",
  "Herkimer",
  "Jefferson",
  "Kings",
  "Lewis",
  "Livingston",
  "Madison",
  "Monroe",
  "Montgomery",
  "Nassau",
  "New York",
  "Niagara",
  "Oneida",
  "Onondaga",
  "Ontario",
  "Orange",
  "Orleans",
  "Oswego",
  "Otsego",
  "Putnam",
  "Queens",
  "Rensselaer",
  "Richmond",
  "Rockland",
  "St. Lawrence",
  "Saratoga",
  "Schenectady",
  "Schoharie",
  "Schuyler",
  "Seneca",
  "Steuben",
  "Suffolk",
  "Sullivan",
  "Tioga",
  "Tompkins",
  "Ulster",
  "Warren",
  "Washington",
  "Wayne",
  "Westchester",
  "Wyoming",
  "Yates"
] as const;

export type ProgramInterestInput = {
  inquiryType: "program-interest";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: "email" | "phone" | "text";
  county: string;
  newYorkResident: true;
  ageConfirmed: true;
  consent: true;
  heardAbout: string;
};

export type ProgramInterestErrors = Partial<Record<keyof ProgramInterestInput | "form", string>>;
export const PROGRAM_INTEREST_SUCCESS = "Thank you. You're on the interest list. We'll contact you by your preferred method.";

const allowedFields = new Set([
  "inquiryType", "firstName", "lastName", "email", "phone",
  "preferredContact", "county", "newYorkResident", "ageConfirmed",
  "consent", "heardAbout", "website",
]);

export function validateProgramInterest(body: Record<string, unknown>):
  | { ok: true; value: ProgramInterestInput }
  | { ok: false; errors: ProgramInterestErrors } {
  const errors: ProgramInterestErrors = {};
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    errors.form = "Send only the contact information requested on this form.";
  }
  function text(name: keyof ProgramInterestInput, maximum: number) {
    const raw = body[name];
    if (raw === undefined || raw === "") return "";
    if (typeof raw !== "string" || raw.length > maximum || /[\u0000-\u001f\u007f]/.test(raw)) {
      errors[name] = "Enter a short, valid answer for this field.";
      return "";
    }
    return raw.trim();
  }
  const firstName = text("firstName", 80);
  const lastName = text("lastName", 80);
  const email = text("email", 254).toLowerCase();
  const phone = text("phone", 40);
  const preferredContact = text("preferredContact", 10);
  const county = text("county", 40);
  const heardAbout = text("heardAbout", 200);
  if (body.inquiryType !== "program-interest") errors.form = "Choose the program interest form.";
  if (!firstName) errors.firstName = "Enter your first name.";
  if (!lastName) errors.lastName = "Enter your last name.";
  if (!email && !phone) {
    errors.email = "Enter an email address or phone number.";
    errors.phone = "Enter a phone number or email address.";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const northAmerican = /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ||
      /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits);
    const international = /^\+[2-9]/.test(phone) && /^[2-9]\d{7,14}$/.test(digits);
    if (!/^\+?[\d ().-]+$/.test(phone) || !(northAmerican || international)) {
      errors.phone = "Enter a valid phone number, including the area code.";
    }
  }
  if (!["email", "phone", "text"].includes(preferredContact)) {
    errors.preferredContact = "Choose how we should contact you.";
  } else if (preferredContact === "email" && !email) {
    errors.email = "Enter an email address for your preferred contact method.";
  } else if (preferredContact !== "email" && !phone) {
    errors.phone = "Enter a phone number for your preferred contact method.";
  }
  if (!(NEW_YORK_COUNTIES as readonly string[]).includes(county)) errors.county = "Choose a New York county.";
  if (body.newYorkResident !== true) errors.newYorkResident = "Confirm that you live in New York State.";
  if (body.ageConfirmed !== true) errors.ageConfirmed = "Confirm that you are 64 or younger.";
  if (body.consent !== true) errors.consent = "Confirm that SozoRock may contact you about the program.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      inquiryType: "program-interest", firstName, lastName, email, phone,
      preferredContact: preferredContact as ProgramInterestInput["preferredContact"],
      county, newYorkResident: true, ageConfirmed: true, consent: true, heardAbout,
    },
  };
}

export function programInterestExpiry(cohortStart: string | undefined): number | null {
  if (!cohortStart || !/^2027-01-(0[1-9]|[12]\d|3[01])$/.test(cohortStart)) return null;
  const deadline = new Date(cohortStart + "T00:00:00-05:00");
  deadline.setUTCFullYear(deadline.getUTCFullYear() + 1);
  return Math.floor(deadline.getTime() / 1000);
}
