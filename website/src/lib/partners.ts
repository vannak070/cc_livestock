/**
 * The CamCow network shown on the home page and (as a logo strip) above the footer.
 * Change names, roles and links here only. Set `show: false` to hide a partner.
 *
 * Before the site goes live: the owner confirms that each partner agrees to have its name and logo shown
 * (a logo can look like an endorsement). Never add money, prices or loan details here, only the role.
 */
export interface Partner {
  key: 'techo' | 'camcow' | 'ardb';
  show: boolean;
  name: { en: string; km: string };
  /** A short label above the name, e.g. "Agricultural bank". */
  tag: { en: string; km: string };
  role: { en: string; km: string };
  /** A file in website/public/partners/ (or /logo.png). */
  logo: string;
  /** The partner's own page; empty = no link. */
  link: string;
}

export const PARTNERS: Partner[] = [
  {
    key: 'techo',
    show: true,
    name: { en: 'Techo Farmers Network Association', km: 'សមាគមបណ្តាញកសិករតេជោ' },
    tag: { en: 'Farmers\' network', km: 'បណ្តាញកសិករ' },
    role: { en: 'A network of Cambodian farmers who learn and grow together.', km: 'បណ្តាញកសិករកម្ពុជាដែលរៀនសូត្រ និងរីកចម្រើនជាមួយគ្នា។' },
    logo: '/partners/techo.jpg',
    link: 'https://www.facebook.com/profile.php?id=61578858306768',
  },
  {
    key: 'camcow',
    show: true,
    name: { en: 'CamCow', km: 'ខេម ខោវ' },
    tag: { en: 'Our company', km: 'ក្រុមហ៊ុនរបស់យើង' },
    role: { en: 'Supplies cattle and feed, supports member farms and buys the cattle back.', km: 'ផ្គត់ផ្គង់គោ និងចំណី គាំទ្រកសិដ្ឋានសមាជិក ហើយទិញគោត្រឡប់មកវិញ។' },
    logo: '/logo.png',
    link: '',
  },
  {
    key: 'ardb',
    show: true,
    name: { en: 'Agricultural and Rural Development Bank', km: 'ធនាគារអភិវឌ្ឍន៍ជនបទ និងកសិកម្ម' },
    tag: { en: 'Agricultural bank', km: 'ធនាគារកសិកម្ម' },
    role: { en: 'Cambodia\'s agricultural bank, supporting farmers across the country.', km: 'ធនាគារកសិកម្មរបស់កម្ពុជា ដែលគាំទ្រកសិករទូទាំងប្រទេស។' },
    logo: '/partners/ardb.jpg',
    link: 'https://www.facebook.com/ardbcambodia',
  },
];

export const shownPartners = () => PARTNERS.filter(p => p.show);
