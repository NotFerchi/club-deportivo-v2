import React, { useEffect, useRef, useState } from 'react';
import { Check, Trophy } from 'lucide-react';
import './Bracket.css';

// Ancho mínimo de una columna y separación entre columnas (deben coincidir con Bracket.css)
const ANCHO_COLUMNA = 176;
const SEPARACION = 32;

/** true si las rondas forman una llave que se puede partir en dos mitades iguales hacia la final. */
function admiteSimetrica(rounds) {
  if (rounds.length < 2) return false;
  if (rounds[rounds.length - 1].matches.length !== 1) return false;
  return rounds.slice(0, -1).every((r) => r.matches.length >= 2 && r.matches.length % 2 === 0);
}

function columnasNecesarias(rounds, simetrica) {
  return simetrica ? 2 * (rounds.length - 1) + 1 : rounds.length;
}

/** Ancho del contenedor (ResizeObserver) para elegir la forma de la llave. */
function useAncho(ref) {
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setAncho(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(([entry]) => setAncho(entry.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return ancho;
}

function Lado({ lado }) {
  const clases = [
    'ui-bracket__side',
    lado.winner && 'ui-bracket__side--winner',
    lado.empty && 'ui-bracket__side--empty'
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={clases}>
      {lado.winner ? (
        <span className="ui-bracket__mark" aria-hidden="true">
          <Check size={12} />
        </span>
      ) : lado.seed !== undefined && lado.seed !== null ? (
        <span className="ui-bracket__seed">{lado.seed}</span>
      ) : (
        <span className="ui-bracket__mark ui-bracket__mark--idle" aria-hidden="true" />
      )}
      <span className="ui-bracket__name">{lado.name}</span>
      {lado.score !== undefined && lado.score !== null && lado.score !== '' && (
        <span className="ui-bracket__score">{lado.score}</span>
      )}
    </span>
  );
}

function textoLado(lado) {
  const marcador = lado.score !== undefined && lado.score !== null && lado.score !== '' ? ` ${lado.score}` : '';
  return `${lado.name}${marcador}${lado.winner ? ' (ganador)' : ''}`;
}

function Encuentro({ match, selected, onMatchClick }) {
  const clases = [
    'ui-bracket__match',
    selected && 'ui-bracket__match--selected',
    onMatchClick && 'ui-bracket__match--interactive'
  ]
    .filter(Boolean)
    .join(' ');
  const contenido = (
    <>
      <span className="ui-bracket__head">
        <span className="ui-bracket__label">{match.label}</span>
        {match.status && (
          <span className={`ui-bracket__status ui-bracket__status--${match.status.tone || 'neutral'}`}>
            {match.status.label}
          </span>
        )}
      </span>
      <Lado lado={match.a} />
      <Lado lado={match.b} />
    </>
  );
  const etiqueta = `${match.name || match.label}: ${textoLado(match.a)} contra ${textoLado(match.b)}${
    match.status ? `. ${match.status.label}` : ''
  }`;
  if (!onMatchClick) {
    return (
      <div className={clases} role="group" aria-label={etiqueta}>
        {contenido}
      </div>
    );
  }
  return (
    <button type="button" className={clases} aria-label={etiqueta} aria-pressed={selected} onClick={() => onMatchClick(match.id)}>
      {contenido}
    </button>
  );
}

/** Una columna de la llave. `pares` agrupa los encuentros de dos en dos para dibujar el conector. */
function Columna({ matches, pares, rtl, alFinal, selectedId, onMatchClick }) {
  const slot = (m) => (
    <div key={m.id} className="ui-bracket__slot">
      <Encuentro match={m} selected={String(m.id) === String(selectedId)} onMatchClick={onMatchClick} />
    </div>
  );
  const clases = [
    'ui-bracket__col',
    rtl && 'ui-bracket__col--rtl',
    alFinal && 'ui-bracket__col--to-final'
  ]
    .filter(Boolean)
    .join(' ');
  if (!pares) return <div className={clases}>{matches.map(slot)}</div>;
  const grupos = [];
  for (let i = 0; i < matches.length; i += 2) grupos.push(matches.slice(i, i + 2));
  return (
    <div className={clases}>
      {grupos.map((g) => (
        <div key={g[0].id} className="ui-bracket__pair">
          {g.map(slot)}
        </div>
      ))}
    </div>
  );
}

function ColumnaFinal({ match, champion, championLabel, selectedId, onMatchClick }) {
  return (
    <div className="ui-bracket__col ui-bracket__col--final">
      <div className="ui-bracket__slot ui-bracket__slot--final">
        <div className="ui-bracket__final">
          <Encuentro match={match} selected={String(match.id) === String(selectedId)} onMatchClick={onMatchClick} />
          <div className="ui-bracket__champion">
            <span className="ui-bracket__champion-icon" aria-hidden="true">
              <Trophy size={22} />
            </span>
            <span className="ui-bracket__champion-label">{championLabel}</span>
            <span className="ui-bracket__champion-name">{champion || 'Por definir'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Bracket - llave de eliminación directa (tablero U4-03, "Cuadro"). Si cabe, se dibuja simétrica:
 * la mitad de cada ronda a la izquierda, la otra mitad en espejo a la derecha y la final al
 * centro con la tarjeta del campeón debajo. Si no cabe (o las rondas no se pueden partir en
 * mitades), usa una columna por ronda con desplazamiento lateral. Solo presentación.
 *
 *   <Bracket
 *     rounds={[{ key: 1, label: 'Semifinal', matches: [{ id, label, status, a, b }, …] }, …]}
 *     champion="Sofía Torres"
 *     selectedId={encuentroId}
 *     onMatchClick={(id) => abrir(id)}
 *   />
 *
 * Props:
 *   rounds        - [{ key, label, matches }], de la primera ronda a la final (la última, con 1 encuentro)
 *                   match: { id, label, name?, status?: { label, tone?: 'neutral'|'info'|'success' }, a, b }
 *                   (label es el rótulo corto visible, p. ej. "#12"; name, el nombre accesible)
 *                   a / b: { name, seed?, score?, winner?, empty? }
 *   champion      - nombre del campeón; sin él dice "Por definir"
 *   championLabel - rótulo de la tarjeta (default "Campeón")
 *   selectedId    - id del encuentro marcado
 *   onMatchClick  - (id) => void; sin él los encuentros no son botones
 *   ariaLabel     - nombre accesible de la llave (default "Cuadro del torneo")
 *   className     - clase extra; opcional
 */
export function Bracket({ rounds, champion, championLabel = 'Campeón', selectedId, onMatchClick, ariaLabel = 'Cuadro del torneo', className }) {
  const ref = useRef(null);
  const ancho = useAncho(ref);

  const final = rounds[rounds.length - 1]?.matches[0];
  const posibleSimetrica = admiteSimetrica(rounds);
  const necesario = (n) => n * ANCHO_COLUMNA + (n - 1) * SEPARACION;
  const simetrica = posibleSimetrica && ancho >= necesario(columnasNecesarias(rounds, true));

  const previas = rounds.slice(0, -1);
  // Encuentros de la columna más alta: con menos de 4 no cabe el campeón bajo la final
  const masAlta = Math.max(1, ...previas.map((r) => (simetrica ? r.matches.length / 2 : r.matches.length)));
  let columnas;
  let rotulos;
  if (simetrica) {
    const izquierda = previas.map((r) => r.matches.slice(0, r.matches.length / 2));
    const derecha = previas.map((r) => r.matches.slice(r.matches.length / 2));
    columnas = [
      ...izquierda.map((ms, i) => (
        <Columna
          key={`i-${previas[i].key}`}
          matches={ms}
          pares={ms.length >= 2}
          alFinal={i === previas.length - 1}
          selectedId={selectedId}
          onMatchClick={onMatchClick}
        />
      )),
      <ColumnaFinal
        key="final"
        match={final}
        champion={champion}
        championLabel={championLabel}
        selectedId={selectedId}
        onMatchClick={onMatchClick}
      />,
      ...derecha
        .map((ms, i) => (
          <Columna
            key={`d-${previas[i].key}`}
            matches={ms}
            pares={ms.length >= 2}
            rtl
            alFinal={i === previas.length - 1}
            selectedId={selectedId}
            onMatchClick={onMatchClick}
          />
        ))
        .reverse()
    ];
    rotulos = [
      ...previas.map((r) => ({ key: `i-${r.key}`, label: r.label })),
      { key: 'final', label: rounds[rounds.length - 1].label, final: true },
      ...previas.map((r) => ({ key: `d-${r.key}`, label: r.label })).reverse()
    ];
  } else {
    columnas = [
      ...previas.map((r, i) => (
        <Columna
          key={r.key}
          matches={r.matches}
          pares={r.matches.length >= 2}
          alFinal={i === previas.length - 1 && r.matches.length === 1}
          selectedId={selectedId}
          onMatchClick={onMatchClick}
        />
      )),
      final && (
        <ColumnaFinal
          key="final"
          match={final}
          champion={champion}
          championLabel={championLabel}
          selectedId={selectedId}
          onMatchClick={onMatchClick}
        />
      )
    ];
    rotulos = rounds.map((r, i) => ({ key: r.key, label: r.label, final: i === rounds.length - 1 }));
  }

  return (
    <div ref={ref} className={['ui-bracket', simetrica ? 'ui-bracket--symmetric' : 'ui-bracket--columns', className].filter(Boolean).join(' ')}>
      <div className="ui-bracket__scroller" role="region" aria-label={ariaLabel} tabIndex={simetrica ? undefined : 0}>
        <ol className="ui-bracket__rounds" aria-label="Rondas">
          {rotulos.map((r) => (
            <li key={r.key} className={['ui-bracket__round', r.final && 'ui-bracket__round--final'].filter(Boolean).join(' ')}>
              {r.label}
            </li>
          ))}
        </ol>
        <div className={['ui-bracket__grid', masAlta < 4 && 'ui-bracket__grid--room'].filter(Boolean).join(' ')}>{columnas}</div>
      </div>
    </div>
  );
}

export default Bracket;
