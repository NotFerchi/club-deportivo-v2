import React from 'react';
import './KpiCard.css';

/**
 * KpiCard - tarjeta de indicador del tablero U4-20: rótulo con ícono, valor grande con un
 * acompañante (unidad, estrellas) y una línea de apoyo con pastilla opcional. Para KPI simples
 * (número y etiqueta) está StatCard.
 *
 *   <KpiCard
 *     label="Promedio general"
 *     icon={<Star size={18} />}
 *     value="4.8"
 *     addon={<Stars value={4.8} />}
 *     caption="Calificación promedio del club"
 *     badge="+0.2 vs mes anterior"
 *   />
 *
 * Props:
 *   label     - rótulo (overline)
 *   icon      - ícono en círculo a la derecha del rótulo; opcional
 *   tag       - nodo a la derecha del rótulo en lugar del ícono (p. ej. un Badge); opcional
 *   value     - valor destacado
 *   addon     - nodo junto al valor (unidad, estrellas); opcional
 *   caption   - texto de apoyo; opcional
 *   badge     - texto en pastilla junto al apoyo; opcional
 *   children  - contenido libre en lugar de value/addon (p. ej. una persona); opcional
 *   className - clase extra; opcional
 */
export function KpiCard({ label, icon, tag, value, addon, caption, badge, children, className }) {
  return (
    <section className={['ui-kpi', className].filter(Boolean).join(' ')} aria-label={label}>
      <div className="ui-kpi__top">
        <span className="ui-kpi__label">{label}</span>
        {tag || (icon && (
          <span className="ui-kpi__icon" aria-hidden="true">
            {icon}
          </span>
        ))}
      </div>
      {children || (
        <div className="ui-kpi__main">
          <span className="ui-kpi__value">{value}</span>
          {addon && <span className="ui-kpi__addon">{addon}</span>}
        </div>
      )}
      {(caption || badge) && (
        <div className="ui-kpi__bottom">
          {caption && <span className="ui-kpi__caption">{caption}</span>}
          {badge && <span className="ui-kpi__badge">{badge}</span>}
        </div>
      )}
    </section>
  );
}

export default KpiCard;
