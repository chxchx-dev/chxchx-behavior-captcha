import { ContactForm } from "../ContactForm";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">DEMO LOCAL · SIN CAPTCHA EXTERNO</p>
        <h1>Formulario con defensa propia contra spam</h1>
        <p>El servidor limita la frecuencia y pide una prueba criptográfica breve en cada envío para que puedas ver el flujo. Esta demo no guarda los datos.</p>
        <ol className="flow-list">
          <li><strong>El navegador</strong> cuenta interacciones y tiempo en página.</li>
          <li><strong>El servidor</strong> evalúa señales y decide si pide más trabajo.</li>
          <li><strong>El navegador</strong> encuentra una solución SHA-256; el servidor valida firma, vencimiento y uso único.</li>
        </ol>
      </section>
      <ContactForm />
    </main>
  );
}
