/** 사진첩: 거점 화면을 찍어 이 브라우저에만 저장한다 (서버에는 올리지 않는다) */

export interface Photo {
  id: string;
  /** 찍은 실제 시각 */
  at: number;
  /** 찍은 게임 시각 */
  gameT: number;
  base: string;
  caption: string;
  data: string;
}

const KEY = 'zsb-album-v1';
export const ALBUM_MAX = 30;

export function loadAlbum(): Photo[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Photo[];
  } catch {
    return [];
  }
}

export function saveAlbum(list: Photo[]): boolean {
  let l = list.slice(-ALBUM_MAX);
  // 저장 공간이 모자라면 오래된 것부터 지운다
  while (l.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(l));
      return true;
    } catch {
      l = l.slice(1);
    }
  }
  return false;
}

/** 캔버스 이미지를 줄여 JPEG 로 */
export function shrink(img: HTMLImageElement | HTMLCanvasElement, maxW = 520): string {
  const w = img.width;
  const h = img.height;
  const k = Math.min(1, maxW / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.78);
}

export function addPhoto(p: Omit<Photo, 'id'>): Photo {
  const photo = { ...p, id: Math.random().toString(36).slice(2, 10) };
  saveAlbum([...loadAlbum(), photo]);
  return photo;
}
