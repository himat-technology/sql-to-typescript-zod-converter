import { ChevronRight, FlaskConical, KeyRound, Table2 } from 'lucide-react';
import type { TableModel } from '../generators/model';
import { Card } from './ui';

interface DetectedTablesProps {
  tables: TableModel[];
  stale: boolean;
  onTestTable: (index: number) => void;
}

export function DetectedTables({ tables, stale, onTestTable }: DetectedTablesProps) {
  const count = tables.length;
  return (
    <Card
      id="detected-tables"
      accent="indigo"
      title={
        <span aria-live="polite">
          {count} {count === 1 ? 'Table' : 'Tables'} Detected
          {stale && <span className="ml-2 text-xs font-normal text-amber-700">(from last valid SQL)</span>}
        </span>
      }
      icon={<Table2 size={16} />}
      bodyClassName="p-0"
    >
      {count === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">No tables yet. Paste SQL or load an example.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tables.map((model, index) => {
            const { table } = model;
            const qualified = table.schema ? `${table.schema}.${table.name}` : table.name;
            return (
              <li key={`${qualified}-${index}`}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <ChevronRight size={14} className="shrink-0 text-slate-400 transition-transform group-open:rotate-90" aria-hidden="true" />
                    <span className="truncate font-mono font-medium text-slate-900">{qualified}</span>
                    <span className="shrink-0 text-slate-500">
                      — {table.columns.length} {table.columns.length === 1 ? 'column' : 'columns'}
                    </span>
                    <span className="ml-auto hidden shrink-0 font-mono text-xs text-slate-500 sm:inline">{model.typeName}</span>
                  </summary>
                  <div className="px-4 pb-3">
                    <div className="code-scroll overflow-x-auto rounded-md border border-slate-200">
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <caption className="sr-only">Columns of {qualified}</caption>
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th scope="col" className="px-2.5 py-1.5 font-medium">Column</th>
                            <th scope="col" className="px-2.5 py-1.5 font-medium">SQL type</th>
                            <th scope="col" className="px-2.5 py-1.5 font-medium">TS type</th>
                            <th scope="col" className="px-2.5 py-1.5 font-medium">Null</th>
                            <th scope="col" className="px-2.5 py-1.5 font-medium">Key / default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {model.fields.map((field) => {
                            const c = field.column;
                            return (
                              <tr key={c.name}>
                                <td className="px-2.5 py-1.5 text-slate-900">
                                  <span className="inline-flex items-center gap-1">
                                    {c.primaryKey && <KeyRound size={11} className="text-amber-600" aria-label="Primary key" />}
                                    {c.name}
                                  </span>
                                </td>
                                <td className="px-2.5 py-1.5 text-slate-700">{c.rawType || (c.generated ? 'computed' : '—')}</td>
                                <td className="max-w-[180px] truncate px-2.5 py-1.5 text-sky-800" title={field.mapped.tsType}>
                                  {field.mapped.tsType}
                                </td>
                                <td className="px-2.5 py-1.5 text-slate-700">{c.nullable ? 'NULL' : 'NOT NULL'}</td>
                                <td className="px-2.5 py-1.5 text-slate-600">
                                  {[
                                    c.primaryKey && 'PK',
                                    c.unique && !c.primaryKey && 'UNIQUE',
                                    c.autoIncrement && 'AUTO',
                                    c.references && `FK → ${c.references.table}`,
                                    c.defaultValue !== undefined && `= ${c.defaultValue}`,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={() => onTestTable(index)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
                    >
                      <FlaskConical size={13} aria-hidden="true" />
                      Test a row against {model.schemaName}
                    </button>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
