// Species and palette are independent of job, personality and company.
// One appearance is drawn for each creation draft and saved on the fish itself.
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
export function rollAppearance(rng = random) {
  const sprite = Math.min(11, Math.floor(rng() * 12));
  const draw = rng();
  return { sprite, skin: draw < 0.08 ? 16 : Math.min(15, Math.floor((draw - 0.08) / 0.92 * 16)) };
}
