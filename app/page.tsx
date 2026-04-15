import { redirect } from 'next/navigation';

// TODO: delete this page once the redirect is no longer needed
export default function HomePage() {
  redirect('/internal');
}
