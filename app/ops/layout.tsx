import { OpsProvider } from './_ops'

export const metadata = { title: 'Gepuklah Ops' }

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <OpsProvider>{children}</OpsProvider>
}
