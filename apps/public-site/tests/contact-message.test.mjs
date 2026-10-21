import test from "node:test";
import assert from "node:assert/strict";
import { contactMessage, CONTACT_MESSAGE_LIMIT } from "../app/lib/contact-message.ts";

test("message limits account for the complete inquiry including contextual fields", () => {
 const form = new FormData();
 for (const [key, value] of Object.entries({organization:"A".repeat(180),jobTitle:"B".repeat(100),subject:"C".repeat(120),volunteerArea:"Technology and cybersecurity",message:"D".repeat(1600)})) form.set(key,value);
 assert.ok(contactMessage(form,"en").length > CONTACT_MESSAGE_LIMIT);
 form.set("message","D".repeat(1400));
 assert.ok(contactMessage(form,"en").length <= CONTACT_MESSAGE_LIMIT);
 assert.ok(contactMessage(form,"en").endsWith("D".repeat(1400)));
});
