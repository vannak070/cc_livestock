import { permanentRedirect } from 'next/navigation';
import { pageLang } from '@/lib/page';

/** The farm loan now lives on the For farmers page; old links to /loans forward there. */
export default async function LoansPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await pageLang(params);
  permanentRedirect(`/${lang}/for-farmers#loans`);
}
