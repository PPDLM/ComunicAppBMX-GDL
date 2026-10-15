import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';

/** Sends each user to their role's home screen. */
export default function Index() {
  const session = useSession();
  if (session.status !== 'signedIn') return <Loading />;
  switch (session.user.role) {
    case 'ADMIN':
      return <Redirect href="/admin" />;
    case 'DRIVER':
      return <Redirect href="/driver" />;
    case 'WAREHOUSE':
      return <Redirect href="/warehouse" />;
    case 'INSPECTION':
      return <Redirect href="/inspection" />;
    default:
      return <Loading />;
  }
}
