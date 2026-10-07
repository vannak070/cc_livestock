/**
 * While the network is small, a page of near-zero numbers and an empty map
 * looks like nobody is here. Until SHOW_NUMBERS_FROM member farms are on the
 * website, the home page shows what members get instead of live numbers, the
 * maps invite farmers to be the first pins, and sections with nothing in them
 * (cattle, stories) are left out. Change the number here.
 */
export const SHOW_NUMBERS_FROM = 3;

export const showLiveNumbers = (farmCount: number): boolean => farmCount >= SHOW_NUMBERS_FROM;
