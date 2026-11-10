import { useState } from 'react';
import { Check, LockKeyhole, Shuffle, Sparkles } from 'lucide-react';
import { FishPortrait, PageHeading } from './components';
import { initialFish, type Fish } from './data';
import { speciesNames, palettes, internetPalettes, skinName, type Appearance } from './appearance';
import './skins.css';

function preview(a: Appearance): Fish { return { ...initialFish[a.sprite], ...a, id: `skin-preview-${a.sprite}-${a.skin}` }; }
export function SkinStudio({ value, onChange }: { value: Appearance; onChange: (a: Appearance) => void }) {
  const [collection, setCollection] = useState(value.skin === 16 ? 'internet' : 'classic');
  const colors = value.skin === 16 ? internetPalettes[value.sprite] : palettes[value.skin];
  const choices = collection === 'internet' ? initialFish.map((_, sprite) => ({ sprite, skin: 16 })) : palettes.map((_, skin) => ({ sprite: value.sprite, skin }));
  return <div className="skin-studio">
    <aside className="skin-species"><small>十二种相遇</small>{initialFish.map((fish, sprite) => <button key={fish.id} className={value.sprite === sprite ? 'selected' : ''} onClick={() => onChange({ sprite, skin: value.skin })}><FishPortrait fish={{ ...fish, id: `species-${sprite}` }} size={48} /><span>{speciesNames[sprite]}<small>所有岗位均可出现</small></span><em>17 款</em></button>)}</aside>
    <section className="skin-wardrobe"><div className="skin-toolbar"><div role="tablist" aria-label="皮肤系列"><button role="tab" aria-selected={collection === 'classic'} onClick={() => setCollection('classic')}>四季幻彩 <span>192</span></button><button role="tab" aria-selected={collection === 'internet'} onClick={() => setCollection('internet')}>互联网灵感 <span>12</span></button></div><button className="icon-button" aria-label="随机浏览外观" onClick={() => onChange(choices[Math.floor(Math.random() * choices.length)])}><Shuffle size={19} /></button></div>
      <div className={`skin-grid ${collection === "internet" ? "internet-grid" : ""}`}>{choices.map(a => <button key={`${a.sprite}-${a.skin}`} className={`skin-card ${value.sprite === a.sprite && value.skin === a.skin ? 'selected' : ''}`} aria-label={`查看${skinName(a)}`} aria-pressed={value.sprite === a.sprite && value.skin === a.skin} onClick={() => onChange(a)}><FishPortrait fish={preview(a)} size={collection === "internet" ? 140 : 111} /><span>{skinName(a).split(' · ').pop()}</span>{a.skin === 16 && <small className="skin-brand">{internetPalettes[a.sprite][0].split('灵感')[0]}</small>}{value.sprite === a.sprite && value.skin === a.skin && <i><Check size={13} /></i>}</button>)}</div>
      <p className="skin-caption">{collection === 'internet' ? '熟悉的品牌色，新的鱼塘故事 · 配色灵感创作，非官方联名' : '16 种配色 × 12 种角色 · 每一款都有自己的细节与光泽'}</p>
    </section>
    <aside className="skin-inspector"><span className="eyebrow"><Sparkles size={16} /> {value.skin === 16 ? '互联网灵感' : '四季幻彩'}</span><div className="skin-showcase"><div className="skin-halo" /><FishPortrait fish={preview(value)} size={270} /><div className="skin-pedestal" /></div><h2>{skinName(value).split(' · ').pop()}</h2><p>{speciesNames[value.sprite]} · 所有岗位均有机会</p><div className="skin-swatches"><i style={{ background: colors[1] }} /><i style={{ background: colors[2] }} /><span>双彩细节 · 立体光泽</span></div><blockquote>独特的相遇，<br />在出生那一刻定格。</blockquote><small>此处仅浏览外观，不改变已有伙伴。</small></aside>
  </div>;
}
export default function SkinGallery({ go }: { go: (path: string) => void }) {
  const [selected, setSelected] = useState<Appearance>({ sprite: 1, skin: 15 });
  return <div className="custom-page skin-page"><PageHeading title="皮肤图鉴" subtitle="十二种鱼型，二百零四种相遇。每个新生命，都有属于自己的颜色。" onBack={() => go('atlas')} /><div className="glass-panel skin-gallery"><SkinStudio value={selected} onChange={setSelected} /><footer><div className="skin-birth-rule"><LockKeyhole size={21} /><div><strong>出生即定格</strong><small>鱼种等概率出现 · 岗位不限制外观 · 确认入塘后不可更换</small></div></div><span>四季幻彩 92%（每款 5.75%） · 互联网灵感 8%<br />以上为选定鱼种后的皮肤概率</span><button className="gold-button" onClick={() => go('add')}><Sparkles size={19} /> 去邂逅一位新伙伴</button></footer></div></div>;
}
