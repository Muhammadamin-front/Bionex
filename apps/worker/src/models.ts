import ANDROID from './android-models.json';

/**
 * A phone's model code as its browser gives it ("SM-A175F · Android 16", "iPhone16,2 · iOS 18.7")
 * in the words people know, keeping the code for anyone who needs the exact one:
 * "Samsung Galaxy A17 (SM-A175F) · Android 16". Android names come from Google Play's list of
 * devices (scripts/android-models.py rebuilds it); a code not in it is shown as it is.
 */
const IPHONE: Record<string, string> = {
  'iPhone10,3': 'iPhone X', 'iPhone10,6': 'iPhone X',
  'iPhone11,2': 'iPhone XS', 'iPhone11,4': 'iPhone XS Max', 'iPhone11,6': 'iPhone XS Max', 'iPhone11,8': 'iPhone XR',
  'iPhone12,1': 'iPhone 11', 'iPhone12,3': 'iPhone 11 Pro', 'iPhone12,5': 'iPhone 11 Pro Max', 'iPhone12,8': 'iPhone SE (2)',
  'iPhone13,1': 'iPhone 12 mini', 'iPhone13,2': 'iPhone 12', 'iPhone13,3': 'iPhone 12 Pro', 'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,4': 'iPhone 13 mini', 'iPhone14,5': 'iPhone 13', 'iPhone14,2': 'iPhone 13 Pro', 'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,6': 'iPhone SE (3)', 'iPhone14,7': 'iPhone 14', 'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro', 'iPhone15,3': 'iPhone 14 Pro Max', 'iPhone15,4': 'iPhone 15', 'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro', 'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,1': 'iPhone 16 Pro', 'iPhone17,2': 'iPhone 16 Pro Max', 'iPhone17,3': 'iPhone 16', 'iPhone17,4': 'iPhone 16 Plus', 'iPhone17,5': 'iPhone 16e',
};

export function readableModel(model: string | undefined): string | undefined {
  if (!model) return model;
  const [code = '', ...rest] = model.split(' · ');
  const name = IPHONE[code] ?? (ANDROID as Record<string, string>)[code];
  return name ? [`${name} (${code})`, ...rest].join(' · ') : model;
}
