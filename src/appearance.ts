

export type Appearance = { sprite: number; skin: number };
export const species = ['bai', 'lan', 'cheng', 'zi', 'fan', 'yue', 'zhe', 'hai', 'lanfeng', 'xing', 'tang', 'jiao'];
export const palettes = [
  ['初见本色', '#78a8ee', '#efcdb3'], ['香槟珍珠', '#f7e7c3', '#c99a45'],
  ['樱花来信', '#f59fc8', '#fff0e8'], ['翡翠微风', '#65c9ad', '#f2e9cb'],
  ['落日珊瑚', '#f37f66', '#ffc4a5'], ['深海潮汐', '#3378dc', '#5de1e8'],
  ['薰衣草梦', '#a47cdd', '#e1bcfb'], ['曜石鎏金', '#363847', '#e3b75d'],
  ['冰川初雪', '#d8ecfa', '#73c9f1'], ['青柠汽水', '#eddb50', '#a0c84f'],
  ['杏桃花语', '#ffc7a8', '#ec9eac'], ['青铜时光', '#bc8058', '#3e9e9a'],
  ['银河夜航', '#5256bd', '#c281ed'], ['可可拿铁', '#926049', '#f0dbc3'],
  ['莓果心事', '#c84676', '#f49caf'], ['极光漫游', '#62d6ce', '#b7a2f0'],
] as const;
export const internetPalettes = [
  ['腾讯灵感 · 蓝白晴空', '#1677ed', '#f5faff'], ['字节灵感 · 青粉脉冲', '#42e1dd', '#fa4d81'],
  ['阿里灵感 · 橙光闪耀', '#ff6a00', '#fff4e6'], ['网易灵感 · 朱红书信', '#e53545', '#fff6ef'],
  ['美团灵感 · 柠黄出发', '#ffd100', '#282b34'], ['哔哩哔哩灵感 · 蓝粉梦', '#45b9e5', '#fb8db3'],
  ['京东灵感 · 赤焰先锋', '#ee2638', '#343844'], ['拼多多灵感 · 红金好运', '#ed3435', '#ffd76c'],
  ['滴滴灵感 · 橙黑疾风', '#ff8b20', '#343c42'], ['百度灵感 · 蓝红星轨', '#3869ed', '#f55365'],
  ['小米灵感 · 橙白晨光', '#ff720c', '#fff3e3'], ['华为灵感 · 红银远航', '#d72f44', '#dae0e9'],
] as const;
export function skinName(a: Appearance) { return a.skin === 16 ? internetPalettes[a.sprite][0] : palettes[a.skin][0]; }

export const speciesNames = ["圆镜斑点鱼", "方镜领带鱼", "耳机鳍鱼", "抱书鱼", "条纹长吻鱼", "卷鳍圆镜鱼", "墨镜鱼", "圆滚河豚", "薄荷飘鳍鱼", "星纹鱼", "花瓣尾鱼", "珊瑚海龟"];
