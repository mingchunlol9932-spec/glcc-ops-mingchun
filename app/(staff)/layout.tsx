import Link from 'next/link'

export const metadata = { title: 'Staff — Gepuklah' }

// Open staff section (HR + Timetable). By request these are NOT behind the /ops
// PIN, so they live in their own route group with a simple top nav.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="opsnav">
        <span className="opsbrand">👥 Staff</span>
        <div className="opstabs">
          <Link href="/hr">HR</Link>
          <Link href="/timetable">Timetable</Link>
          <Link href="/ops">Ops →</Link>
        </div>
      </nav>
      <main className="main">{children}</main>
    </>
  )
}
