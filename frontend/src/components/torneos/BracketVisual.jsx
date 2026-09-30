import React from 'react';
import { normalizeEstado, getParticipantName, isWinner } from './torneoUtils';

const BV = { W: 148, PH: 26, SH: 18, CGAP: 48, LH: 24, PAD: 12, VG: 22 };
BV.MH = BV.PH * 2 + BV.SH;
BV.UH = BV.MH + BV.VG;
BV.CS = BV.W + BV.CGAP;

function BracketVisual({ bracket, onMatchClick, selectedId }) {
  const rounds = bracket.slice().sort((a, b) => Number(a.ronda) - Number(b.ronda));
  if (!rounds.length) return null;
  const n1 = rounds[0].encuentros.length;
  if (!n1) return null;

  const { W, PH, SH, CGAP, LH, PAD, VG, MH, UH, CS } = BV;
  const numR = rounds.length;
  const WW = 140;
  const svgW = PAD + numR * CS + WW + PAD;
  const svgH = LH + PAD + n1 * UH + PAD;

  const cy = (ri, ei) => {
    const sp = UH * Math.pow(2, ri);
    return LH + PAD + sp * ei + sp / 2;
  };

  const lastRound = rounds[numR - 1];
  const finalMatch = lastRound?.encuentros?.[0];
  let champion = null;
  if (finalMatch && normalizeEstado(finalMatch.estado) === 'finalizado') {
    if (finalMatch.ganador_nombre) {
      champion = finalMatch.ganador_nombre;
    } else {
      const p = isWinner(finalMatch, finalMatch.participante_1)
        ? finalMatch.participante_1
        : isWinner(finalMatch, finalMatch.participante_2)
          ? finalMatch.participante_2
          : null;
      if (p) champion = getParticipantName(p);
    }
  }

  const trunc = (s, max = 15) => {
    const t = String(s || 'Por definir');
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  };

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', padding: '4px 0' }}>
      <svg width={svgW} height={svgH} style={{ display: 'block', fontFamily: 'system-ui,sans-serif' }}>
        <defs>
          {rounds.map((r, ri) =>
            (r.encuentros || []).map((_, ei) => {
              const x = PAD + ri * CS;
              const y = cy(ri, ei) - MH / 2;
              return (
                <clipPath key={`clip-${ri}-${ei}`} id={`bc-${ri}-${ei}`}>
                  <rect x={x} y={y} width={W} height={MH} rx={7} />
                </clipPath>
              );
            })
          )}
          <linearGradient id="champGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>

        {/* Round labels */}
        {rounds.map((r, ri) => (
          <text
            key={`lbl-${ri}`}
            x={PAD + ri * CS + W / 2}
            y={LH - 5}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill="#475569"
          >
            {ri === numR - 1 ? 'FINAL' : `RONDA ${r.ronda}`}
          </text>
        ))}

        {/* Connector lines */}
        {rounds.slice(0, -1).map((r, ri) =>
          (r.encuentros || []).map((_, ei) => {
            const nei = Math.floor(ei / 2);
            const x1 = PAD + ri * CS + W;
            const y1 = cy(ri, ei);
            const x2 = PAD + (ri + 1) * CS;
            const y2 = cy(ri + 1, nei);
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={`ln-${ri}-${ei}`}
                d={`M${x1} ${y1}H${mx}V${y2}H${x2}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
            );
          })
        )}

        {/* Winner arrow */}
        {(() => {
          const x1 = PAD + (numR - 1) * CS + W;
          const y1 = cy(numR - 1, 0);
          const x2 = PAD + numR * CS + 8;
          return (
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y1}
              stroke={champion ? '#f59e0b' : '#e2e8f0'}
              strokeWidth={2}
              strokeDasharray={champion ? '' : '4 3'}
            />
          );
        })()}

        {/* Match boxes */}
        {rounds.map((r, ri) =>
          (r.encuentros || []).map((enc, ei) => {
            const bx = PAD + ri * CS;
            const by = cy(ri, ei) - MH / 2;
            const p1 = enc.participante_1 || {};
            const p2 = enc.participante_2 || {};
            const est = normalizeEstado(enc.estado);
            const done = est === 'finalizado';
            const w1 = done && isWinner(enc, p1);
            const w2 = done && isWinner(enc, p2);
            const p1n = trunc(getParticipantName(p1));
            const p2n = trunc(getParticipantName(p2));

            const isSelected = enc.encuentro_id === selectedId;
            return (
              <g
                key={`m-${r.ronda}-${ei}`}
                onClick={() => onMatchClick && onMatchClick(enc)}
                style={{ cursor: onMatchClick ? 'pointer' : 'default' }}
              >
                {/* Selection glow */}
                {isSelected && (
                  <rect
                    x={bx - 3}
                    y={by - 3}
                    width={W + 6}
                    height={MH + 6}
                    rx={10}
                    fill="#eff6ff"
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                )}
                {/* Border box */}
                <rect
                  x={bx}
                  y={by}
                  width={W}
                  height={MH}
                  rx={7}
                  fill="white"
                  stroke={isSelected ? '#2563eb' : done ? '#10b981' : est === 'programado' ? '#3b82f6' : '#e2e8f0'}
                  strokeWidth={isSelected ? 2.5 : done ? 1.5 : 1}
                />
                {/* Clipped backgrounds */}
                <g clipPath={`url(#bc-${ri}-${ei})`}>
                  <rect x={bx} y={by} width={W} height={PH} fill={w1 ? '#dcfce7' : '#f8fafc'} />
                  <rect x={bx} y={by + PH} width={W} height={SH} fill={done ? '#f0fdf4' : '#f8fafc'} />
                  <rect x={bx} y={by + PH + SH} width={W} height={PH} fill={w2 ? '#dcfce7' : 'white'} />
                  <line x1={bx} y1={by + PH} x2={bx + W} y2={by + PH} stroke="#e2e8f0" strokeWidth={0.8} />
                  <line x1={bx} y1={by + PH + SH} x2={bx + W} y2={by + PH + SH} stroke="#e2e8f0" strokeWidth={0.8} />
                </g>
                {/* P1 name */}
                <text
                  x={bx + 7}
                  y={by + PH / 2 + 4}
                  fontSize={10}
                  fill={w1 ? '#15803d' : p1n === 'Por definir' ? '#94a3b8' : '#1e293b'}
                  fontWeight={w1 ? 700 : 500}
                >
                  {p1n}
                </text>
                {done && enc.marcador_1 != null && (
                  <text
                    x={bx + W - 6}
                    y={by + PH / 2 + 4}
                    textAnchor="end"
                    fontSize={10}
                    fontWeight={800}
                    fill={w1 ? '#15803d' : '#64748b'}
                  >
                    {enc.marcador_1}
                  </text>
                )}
                {/* Center label */}
                <text
                  x={bx + W / 2}
                  y={by + PH + SH / 2 + 4}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight={700}
                  fill={done ? '#16a34a' : '#94a3b8'}
                >
                  {done ? `${enc.marcador_1 ?? '-'} — ${enc.marcador_2 ?? '-'}` : est === 'programado' ? 'vs' : '···'}
                </text>
                {/* P2 name */}
                <text
                  x={bx + 7}
                  y={by + PH + SH + PH / 2 + 4}
                  fontSize={10}
                  fill={w2 ? '#15803d' : p2n === 'Por definir' ? '#94a3b8' : '#1e293b'}
                  fontWeight={w2 ? 700 : 500}
                >
                  {p2n}
                </text>
                {done && enc.marcador_2 != null && (
                  <text
                    x={bx + W - 6}
                    y={by + PH + SH + PH / 2 + 4}
                    textAnchor="end"
                    fontSize={10}
                    fontWeight={800}
                    fill={w2 ? '#15803d' : '#64748b'}
                  >
                    {enc.marcador_2}
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* Champion box */}
        {(() => {
          const bw = WW - 18;
          const bh = 46;
          const cx_ = PAD + numR * CS + 8;
          const cy_ = cy(numR - 1, 0);
          return (
            <g>
              <rect
                x={cx_}
                y={cy_ - bh / 2}
                width={bw}
                height={bh}
                rx={9}
                fill={champion ? 'url(#champGrad)' : '#f8fafc'}
                stroke={champion ? '#f59e0b' : '#e2e8f0'}
                strokeWidth={champion ? 2 : 1.5}
                strokeDasharray={champion ? '' : '5 3'}
              />
              <text
                x={cx_ + bw / 2}
                y={cy_ - 6}
                textAnchor="middle"
                fontSize={8}
                fontWeight={800}
                fill={champion ? '#92400e' : '#94a3b8'}
              >
                {champion ? 'CAMPEON' : 'POR DEFINIR'}
              </text>
              <text
                x={cx_ + bw / 2}
                y={cy_ + 11}
                textAnchor="middle"
                fontSize={11}
                fontWeight={800}
                fill={champion ? '#78350f' : '#94a3b8'}
              >
                {champion ? trunc(champion, 13) : '?'}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

export default BracketVisual;
