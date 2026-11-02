import React from 'react';
import { getDbData } from '@/lib/db';
import { getSessionActor, getSessionTiming } from '@/lib/session';
import { scopeDataForActor } from '@/lib/data-scope';
import { scopeFor } from '@/lib/farm-scope';
import DashboardContainer from '@/components/DashboardContainer';
import LoginScreen from '@/components/LoginScreen';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // No data is loaded until the session cookie has been verified — whatever
  // this component returns is sent to the browser.
  const currentUser = await getSessionActor();
  const session = await getSessionTiming();
  if (!currentUser || !session) {
    return <LoginScreen />;
  }

  const data = scopeDataForActor(await getDbData(scopeFor(currentUser)), currentUser);

  return <DashboardContainer initialData={data} currentUser={currentUser} session={session} />;
}
