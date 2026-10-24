/**
 * The establishment's own doctor, shown in «Шифокор фикри» (Doctor.tsx); edit this file, not the component.
 *
 * Only a real doctor of «Оромгоҳ даволаш маскани» who agreed in writing to appear here, with a
 * real photograph of them. Never a generated or stock picture: the readers are older people
 * deciding about their heart, and a made-up doctor is a false medical endorsement.
 *
 * The section stays hidden until BOTH are present:
 *   1. a photo saved as  src/sites/main/photos/doctor.jpg  (or .jpeg / .png / .webp);
 *   2. `name` below filled in.
 * The photo is cropped to a 3:4 portrait from the top, so any size works; under 400 KB loads fast.
 */
export const doctor = {
  /** e.g. 'Алишер Каримов' */
  name: '',
  /** e.g. 'Кардиолог, олий тоифали шифокор' */
  title: '',
  /** What the doctor says, one paragraph per line, in their own words. */
  quote: [] as string[],
};
