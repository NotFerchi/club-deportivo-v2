import React from 'react';
import './SplitLayout.css';

/**
 * SplitLayout - contenido principal + panel lateral a la derecha. A 1024 px o menos el panel
 * pasa debajo del contenido (una sola columna, sin scroll horizontal).
 *
 *   <SplitLayout aside={<Card title="Inscripciones">…</Card>}>
 *     <ListaTorneos />
 *   </SplitLayout>
 *
 * Props:
 *   aside     - nodo del panel lateral
 *   children  - contenido principal
 *   className - clase extra; opcional
 */
export function SplitLayout({ aside, children, className }) {
  return (
    <div className={['ui-split', className].filter(Boolean).join(' ')}>
      <div className="ui-split__main">{children}</div>
      {aside && <aside className="ui-split__aside">{aside}</aside>}
    </div>
  );
}

export default SplitLayout;
