import React from 'react';
import './AuthShell.css';

/**
 * AuthShell - marco de las pantallas de acceso (Stitch: publico/login, escritorio y móvil).
 *
 *   <AuthShell
 *     imageDesktop={fondoEscritorio} imageMobile={fondoMovil}
 *     logo={brand.logos.atleta.logotipo.blanco} logoAlt={brand.nombre}
 *     title="Todo tu club, en un solo panel." subtitle="Reservas, clases…"
 *     mobileTitle="Entrena. Reserva. Compite." mobileSubtitle="Tu club, en la palma de tu mano."
 *     panelIntro={<…título del panel en escritorio…/>} mobilePanelIntro="Hola, inicia sesión…"
 *     footer="© 2026 Athlety."
 *   >
 *     <form>…</form>
 *   </AuthShell>
 *
 * Escritorio (≥ 900px): foto de fondo, marca y lema a la izquierda y panel de vidrio oscuro a la
 * derecha. Dentro del panel se redefinen los tokens de color, así Input, Button, Badge y Text del
 * kit se pintan en su versión clara sin props extra.
 * Móvil: foto arriba con la marca y el lema, y una hoja de vidrio claro abajo con el formulario.
 *
 * Props:
 *   imageDesktop / imageMobile - fotos de fondo (URLs importadas con Vite); decorativas
 *   logo, logoAlt     - logotipo blanco y su texto alternativo
 *   title, subtitle   - lema de escritorio
 *   mobileTitle, mobileSubtitle - lema del móvil; si faltan se usa el de escritorio
 *   panelIntro        - encabezado del panel en escritorio (nodo)
 *   mobilePanelIntro  - encabezado de la hoja en móvil (nodo); si falta se usa panelIntro
 *   footer            - texto del pie (solo escritorio); opcional
 *   children          - contenido del panel (formulario)
 */
export function AuthShell({
  imageDesktop,
  imageMobile,
  logo,
  logoAlt,
  title,
  subtitle,
  mobileTitle,
  mobileSubtitle,
  panelIntro,
  mobilePanelIntro,
  footer,
  children,
}) {
  const hasMobileHero = mobileTitle || mobileSubtitle;
  const hasMobileIntro = mobilePanelIntro !== undefined;

  return (
    <div className="ui-auth">
      <picture className="ui-auth__photo">
        <source media="(min-width: 900px)" srcSet={imageDesktop} />
        <img src={imageMobile || imageDesktop} alt="" />
      </picture>
      <div className="ui-auth__scrim" aria-hidden="true" />

      <div className="ui-auth__layout">
        <header className="ui-auth__brand">
          <img className="ui-auth__logo" src={logo} alt={logoAlt} />
          <div className={hasMobileHero ? 'ui-auth__hero ui-auth--desktop-only' : 'ui-auth__hero'}>
            {title && <h1 className="ui-auth__title">{title}</h1>}
            {subtitle && <p className="ui-auth__subtitle">{subtitle}</p>}
          </div>
          {hasMobileHero && (
            <div className="ui-auth__hero ui-auth--mobile-only">
              {mobileTitle && <h1 className="ui-auth__title">{mobileTitle}</h1>}
              {mobileSubtitle && <p className="ui-auth__subtitle">{mobileSubtitle}</p>}
            </div>
          )}
        </header>

        <main className="ui-auth__panel">
          <span className="ui-auth__handle ui-auth--mobile-only" aria-hidden="true" />
          {panelIntro && (
            <div className={hasMobileIntro ? 'ui-auth__intro ui-auth--desktop-only' : 'ui-auth__intro'}>
              {panelIntro}
            </div>
          )}
          {hasMobileIntro && <div className="ui-auth__intro ui-auth--mobile-only">{mobilePanelIntro}</div>}
          {children}
        </main>
      </div>

      {footer && <p className="ui-auth__footer">{footer}</p>}
    </div>
  );
}

export default AuthShell;
