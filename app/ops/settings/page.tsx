'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOpsPin, opsGet, opsAction } from '../_ops'

type Settings = Record<string, number | boolean>
type Tbl = { id: string; label: string; zone: string; seats: number }
const NUMS: [string, string][] = [
  ['max_capacity', 'Max capacity (pax)'],
  ['target_average_duration', 'Target avg dining (min)'],
  ['cleaning_minutes', 'Cleaning flag after (min)'],
  ['good_day_target_pax', 'Good-day target pax'],
  ['target_utilization', 'Target utilization (%)'],
  ['peak_utilization_target', 'Peak-hour util target (%)'],
  ['lost_pax_good_threshold', 'Lost pax — good ≤'],
  ['lost_pax_bad_threshold', 'Lost pax — bad >'],
  ['no_show_good_threshold', 'No-show rate good ≤ (%)'],
  ['open_hour', 'Open hour (0–23)'],
  ['close_hour', 'Close hour (0–23)'],
]

export default function SettingsPage() {
  const pin = useOpsPin()
  const [s, setS] = useState<Settings | null>(null)
  const [tables, setTables] = useState<Tbl[]>([])
  const [toast, setToast] = useState('')
  const load = useCallback(async () => { const j = await opsGet('/api/ops/state', pin); if (j.ok) { setS(j.settings); setTables(j.tables) } }, [pin])
  useEffect(() => { load() }, [load])
  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2500) }
  async function save(key: string, value: string) { const r = await opsAction(pin, 'set_setting', { key, value }); flash(r.ok ? 'Saved' : 'Failed'); load() }
  async function saveCap(id: string, seats: number) { const r = await opsAction(pin, 'set_capacity', { table_id: id, seats }); flash(r.ok ? 'Saved' : 'Failed'); load() }
  if (!s) return <div className="ops"><p className="qsub" style={{ padding: 24 }}>Loading…</p></div>

  return (
    <div className="ops">
      <h1 className="ph2">Settings</h1>

      <div className="setrow">
        <label className="toggle"><span>Allow splitting a group across tables</span>
          <input type="checkbox" checked={!!s.allow_split_tables} onChange={e => save('allow_split_tables', e.target.checked ? 'true' : 'false')} />
        </label>
      </div>

      <h2 className="sec">Targets &amp; thresholds</h2>
      <div className="setgrid">
        {NUMS.map(([key, lbl]) => (
          <label key={key} className="fld">{lbl}
            <input type="number" defaultValue={Number(s[key])} onBlur={e => { if (e.target.value !== '') save(key, String(Number(e.target.value))) }} />
          </label>
        ))}
      </div>

      <h2 className="sec">Table capacities</h2>
      <p className="qsub">These per-table seats sum to your physical capacity. The <b>Max capacity</b> above is the hard cap the app never exceeds.</p>
      <div className="setgrid">
        {tables.map(t => (
          <label key={t.id} className="fld">{t.label} <span className="qmeta">zone {t.zone}</span>
            <input type="number" min={1} defaultValue={t.seats} onBlur={e => { const n = Number(e.target.value); if (n >= 1) saveCap(t.id, n) }} />
          </label>
        ))}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
