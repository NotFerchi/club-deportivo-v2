import React from 'react';
import { Search } from 'lucide-react';
import './Table.css';

/**
 * Table - tabla con header, filas (hover por CSS) y estado vacío (Figma: Table + TableRow).
 *
 *   const columns = [
 *     { key: 'socio', header: 'Socio', width: 200 },
 *     { key: 'fecha', header: 'Fecha' },
 *     { key: 'estado', header: 'Estado', render: (row) => <Badge>{row.estado}</Badge> },
 *   ];
 *   <Table columns={columns} data={reservas} emptyMessage="No hay reservas que coincidan con los filtros." />
 *
 * Props:
 *   columns      - [{ key, header, width?, render?(row, index) }]; sin render se muestra row[key]
 *   data         - arreglo de filas
 *   emptyMessage - texto del estado vacío (default 'No hay registros.')
 *   emptyTitle   - título del estado vacío (default 'Sin resultados')
 *   emptyAction  - nodo bajo el mensaje vacío (p. ej. <Button variant="secondary">); opcional
 *   getRowKey    - (row, index) => key; default row.id ?? index
 *   onRowClick   - (row) => void; opcional, hace la fila clicable
 *   className    - clase extra del contenedor; opcional
 */
export function Table({
  columns = [],
  data = [],
  emptyMessage = 'No hay registros.',
  emptyTitle = 'Sin resultados',
  emptyAction,
  getRowKey = (row, index) => row?.id ?? index,
  onRowClick,
  className,
}) {
  const classes = className ? `ui-table ${className}` : 'ui-table';
  const isEmpty = !data || data.length === 0;

  return (
    <div className={classes}>
      <table className="ui-table__table">
        <thead>
          <tr className="ui-table__row ui-table__row--header">
            {columns.map((column) => (
              <th key={column.key} className="ui-table__cell" style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={columns.length || 1}>
                <div className="ui-table__empty">
                  <span className="ui-table__empty-icon"><Search size={20} /></span>
                  <p className="ui-table__empty-title">{emptyTitle}</p>
                  <p className="ui-table__empty-message">{emptyMessage}</p>
                  {emptyAction}
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <TableRow
                key={getRowKey(row, index)}
                columns={columns}
                row={row}
                index={index}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * TableRow - fila de datos; el hover lo resuelve el CSS.
 * Table la usa internamente; se exporta para tablas armadas a mano.
 *
 * Props:
 *   columns - mismas columnas que Table
 *   row     - objeto de la fila
 *   index   - posición de la fila (se pasa a column.render)
 *   onClick - opcional; si existe la fila es clicable
 */
export function TableRow({ columns, row, index, onClick }) {
  const classes = onClick ? 'ui-table__row ui-table__row--clickable' : 'ui-table__row';

  return (
    <tr className={classes} onClick={onClick}>
      {columns.map((column) => (
        <td key={column.key} className="ui-table__cell">
          {column.render ? column.render(row, index) : row?.[column.key]}
        </td>
      ))}
    </tr>
  );
}

export default Table;
