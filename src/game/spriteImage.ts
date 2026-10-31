/**
 * 캐릭터 그림 정리: 배경 지우기 → 여백 자르기 → 게임용 크기로 줄이기.
 * - 작은 도트 그림(세로 96px 이하)은 그대로 둔다.
 * - 큰 일러스트는 세로 SPRITE_H 로 부드럽게 줄인다 (게임에서는 캐릭터 키에 맞춰 보여 준다).
 */

export const SPRITE_H = 160;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('그림을 읽지 못했어요.'));
    img.src = src;
  });
}

/** 테두리에서 이어진 배경색을 투명하게 (윤곽선 안쪽의 흰색은 남는다) */
function clearBackground(d: ImageData) {
  const { width: w, height: h, data } = d;
  // 네 모서리 중 가장 흔한 색을 배경으로 본다
  const at = (x: number, y: number) => (y * w + x) * 4;
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const bg = corners.map((i) => [data[i], data[i + 1], data[i + 2]]).sort((a, b) => b[0] + b[1] + b[2] - (a[0] + a[1] + a[2]))[0];
  const near = (i: number) => data[i + 3] > 0 && Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 60;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!near(i)) continue;
    data[i + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  // 경계의 연한 테두리(안티에일리어싱 흰 띠)를 조금 정리
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] === 0 || seen[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    const touches = (x > 0 && data[i - 4 + 3] === 0) || (x < w - 1 && data[i + 4 + 3] === 0) || (y > 0 && data[i - w * 4 + 3] === 0) || (y < h - 1 && data[i + w * 4 + 3] === 0);
    if (touches && Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 140) data[i + 3] = 110;
  }
}

function hasTransparency(d: ImageData) {
  for (let i = 3; i < d.data.length; i += 4 * 7) if (d.data[i] < 250) return true;
  return false;
}

export async function prepareSprite(file: File, removeBg: 'auto' | 'yes' | 'no' = 'auto'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('그림 파일만 올릴 수 있어요.');
  if (file.size > 8 * 1024 * 1024) throw new Error('파일이 너무 커요 (최대 8MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await load(url);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    if (removeBg === 'yes' || (removeBg === 'auto' && !hasTransparency(d))) clearBackground(d);
    // 여백 자르기
    let x0 = c.width;
    let y0 = c.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d.data[(y * c.width + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) throw new Error('그림이 비어 있어요.');
    ctx.putImageData(d, 0, 0);
    const tw = x1 - x0 + 1;
    const th = y1 - y0 + 1;
    // 작은 도트 그림은 그대로
    const small = th <= 96 && tw <= 64;
    const scale = small ? 1 : Math.min(1, SPRITE_H / th);
    // 큰 그림은 반씩 여러 번 줄여야 깨끗하다
    let src: HTMLCanvasElement = document.createElement('canvas');
    src.width = tw;
    src.height = th;
    src.getContext('2d')!.drawImage(c, x0, y0, tw, th, 0, 0, tw, th);
    let cw = tw;
    let ch = th;
    const fw = Math.max(1, Math.round(tw * scale));
    const fh = Math.max(1, Math.round(th * scale));
    while (cw / 2 > fw && ch / 2 > fh) {
      const n = document.createElement('canvas');
      n.width = Math.round(cw / 2);
      n.height = Math.round(ch / 2);
      const nx = n.getContext('2d')!;
      nx.imageSmoothingQuality = 'high';
      nx.drawImage(src, 0, 0, n.width, n.height);
      src = n;
      cw = n.width;
      ch = n.height;
    }
    const out = document.createElement('canvas');
    out.width = fw;
    out.height = fh;
    const ox = out.getContext('2d')!;
    ox.imageSmoothingEnabled = !small;
    ox.imageSmoothingQuality = 'high';
    ox.drawImage(src, 0, 0, fw, fh);
    return out.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 도트 그림인지 (작으면 도트로 보고 또렷하게, 크면 일러스트로 보고 부드럽게) */
export const isPixelSprite = (h: number) => h <= 96;
