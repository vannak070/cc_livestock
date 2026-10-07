/** Cambodia's provinces (same list as CC Livestock src/lib/website/places.ts). */
export interface Province { key: string; km: string; lat: number; lng: number }

export const PROVINCES: readonly Province[] = [
  { key: 'Banteay Meanchey', km: 'បន្ទាយមានជ័យ', lat: 13.59, lng: 102.97 },
  { key: 'Battambang', km: 'បាត់ដំបង', lat: 13.1, lng: 103.2 },
  { key: 'Kampong Cham', km: 'កំពង់ចាម', lat: 12.0, lng: 105.46 },
  { key: 'Kampong Chhnang', km: 'កំពង់ឆ្នាំង', lat: 12.25, lng: 104.67 },
  { key: 'Kampong Speu', km: 'កំពង់ស្ពឺ', lat: 11.45, lng: 104.52 },
  { key: 'Kampong Thom', km: 'កំពង់ធំ', lat: 12.71, lng: 104.89 },
  { key: 'Kampot', km: 'កំពត', lat: 10.61, lng: 104.18 },
  { key: 'Kandal', km: 'កណ្តាល', lat: 11.48, lng: 104.95 },
  { key: 'Kep', km: 'កែប', lat: 10.48, lng: 104.32 },
  { key: 'Koh Kong', km: 'កោះកុង', lat: 11.62, lng: 102.98 },
  { key: 'Kratie', km: 'ក្រចេះ', lat: 12.49, lng: 106.02 },
  { key: 'Mondulkiri', km: 'មណ្ឌលគិរី', lat: 12.45, lng: 107.19 },
  { key: 'Oddar Meanchey', km: 'ឧត្តរមានជ័យ', lat: 14.18, lng: 103.52 },
  { key: 'Pailin', km: 'ប៉ៃលិន', lat: 12.85, lng: 102.61 },
  { key: 'Phnom Penh', km: 'ភ្នំពេញ', lat: 11.56, lng: 104.92 },
  { key: 'Preah Sihanouk', km: 'ព្រះសីហនុ', lat: 10.63, lng: 103.52 },
  { key: 'Preah Vihear', km: 'ព្រះវិហារ', lat: 13.8, lng: 104.98 },
  { key: 'Prey Veng', km: 'ព្រៃវែង', lat: 11.48, lng: 105.33 },
  { key: 'Pursat', km: 'ពោធិ៍សាត់', lat: 12.54, lng: 103.92 },
  { key: 'Ratanakiri', km: 'រតនគិរី', lat: 13.74, lng: 106.99 },
  { key: 'Siem Reap', km: 'សៀមរាប', lat: 13.36, lng: 103.86 },
  { key: 'Stung Treng', km: 'ស្ទឹងត្រែង', lat: 13.53, lng: 105.97 },
  { key: 'Svay Rieng', km: 'ស្វាយរៀង', lat: 11.09, lng: 105.8 },
  { key: 'Takeo', km: 'តាកែវ', lat: 10.99, lng: 104.79 },
  { key: 'Tbong Khmum', km: 'ត្បូងឃ្មុំ', lat: 11.91, lng: 105.65 },
];

export const provinceOf = (key: string): Province | undefined => PROVINCES.find(p => p.key === key);
