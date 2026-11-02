/** CamCow's public contact details (shown on every page). Change here only. */
export const CONTACT = {
  phone: '096 908 12 23',
  phoneTel: '+855969081223',
  telegram: 'https://t.me/camcow',
  telegramHandle: '@CAMCOW',
  facebook: 'https://www.facebook.com/profile.php?id=61584225716508',
  facebookName: 'ខេម ខោវ Cam Cow',
  website: 'www.camcow.com.kh',
  websiteUrl: 'https://www.camcow.com.kh',
  /** The office, as printed on CamCow's contact card (Khmer) and in English. */
  address: {
    km: 'អគារលេខ៩ និងលេខ១៣ ជាន់ទី១ ផ្លូវលេខ៩ ភូមិ៣ សង្កាត់ចតុមុខ ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ',
    en: 'Building No. 9 and No. 13, 1st floor, Street 9, Village 3, Sangkat Chaktomuk, Khan Daun Penh, Phnom Penh',
  },
  /** A QR code (in website/public) that opens CamCow's Telegram. */
  qr: '/contact-qr.svg',
};

export const contactAddress = (lang: 'km' | 'en') => CONTACT.address[lang];
export const contactMapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.address.en)}`;
