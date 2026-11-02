'use client';

import { CONTACT } from '@/lib/contact';

/**
 * Last resort when even the page frame (layout) fails: a plain bilingual page with a retry button and the phone,
 * so a visitor never gets a blank screen or a raw server error. Styles are inline because the site CSS may not load.
 */
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f7faf8', color: '#12241a' }}>
        <main style={{ maxWidth: 560, margin: '12vh auto', padding: '0 20px', textAlign: 'center', display: 'grid', gap: 14 }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>This page could not load.</h1>
          <p lang="km" style={{ margin: 0, fontSize: 20 }}>ទំព័រនេះមិនអាចបើកបានទេ។</p>
          <p style={{ margin: 0 }}>Please try again, or call CamCow · សូមព្យាយាមម្តងទៀត ឬទូរស័ព្ទមក ខេម ខោវ</p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}><a href={`tel:${CONTACT.phoneTel}`} style={{ color: '#231f59' }}>{CONTACT.phone}</a></p>
          <div>
            <button type="button" onClick={() => unstable_retry()} style={{ background: '#138e46', color: '#fff', border: 0, borderRadius: 999, padding: '12px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>Try again · ព្យាយាមម្តងទៀត</button>
          </div>
        </main>
      </body>
    </html>
  );
}
