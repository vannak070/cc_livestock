import { NotFoundContent } from '@/components/shared/NotFoundContent';

/** Unknown farm, story or page (the [lang] layout's own boundary does not catch nested ones). */
export default function NotFound() {
  return <NotFoundContent />;
}
