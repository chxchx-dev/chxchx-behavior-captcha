"use client";

import { BehaviorForm } from "@chxchx/behavior-captcha/client";
import { submit } from "./actions";

export function ContactForm() {
  return (
    <BehaviorForm action={submit} proofFallback={<p>Contact support through the host application's accessible channel.</p>}>
      <label>
        Message
        <textarea name="message" required />
      </label>
    </BehaviorForm>
  );
}
