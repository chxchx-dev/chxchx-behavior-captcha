import type { ReactNode } from "react";
import "@chxchx/behavior-captcha/styles.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
