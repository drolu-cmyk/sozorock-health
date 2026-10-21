export const CONTACT_MESSAGE_LIMIT = 2000;

export function contactMessage(form: FormData, locale: "en" | "es") {
  const text = (field: string) => String(form.get(field) ?? "").trim();
  const volunteer = text("volunteerArea");
  const inquiry = `${volunteer ? `Volunteer area: ${volunteer}\n` : ""}${text("message")}`;
  return locale === "en" ? `Organization: ${text("organization")}\nRole or job title: ${text("jobTitle")}\nSubject: ${text("subject")}\n\n${inquiry}` : inquiry;
}
