import type { ReactNode } from "react";
import "./styles.css";

export const metadata = {
  title: "Prueba de CAPTCHA seguro",
  description: "Demo local de mitigación de spam con una prueba de trabajo propia",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
