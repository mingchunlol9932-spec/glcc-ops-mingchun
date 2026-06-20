import Nav from '@/app/_components/Nav'
import ConnStatus from '@/app/_components/ConnStatus'

// Layout for the business dashboard tabs. Route groups don't change URLs, so
// every existing page keeps its path — they just gain this sidebar shell.
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><span className="logo" aria-hidden="true" /> Your AI HQ</div>
        <Nav />
        <p className="hint">Most tabs read one <code>records</code> table.</p>
      </aside>
      <main className="main"><ConnStatus />{children}</main>
    </div>
  )
}
