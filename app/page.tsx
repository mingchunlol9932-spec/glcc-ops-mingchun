import { redirect } from 'next/navigation'

// Gepuklah is a queue-only app. The bare URL sends customers to the join page;
// staff go to /ops directly.
export default function Home() {
  redirect('/queue')
}
