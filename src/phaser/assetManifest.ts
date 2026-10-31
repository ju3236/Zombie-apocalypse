/**
 * 그래픽 교체 지점.
 *
 * 여기에 `스프라이트 키 → PNG 경로` 를 적으면 임시 도형 대신 해당 PNG 가 사용된다.
 * PNG 는 public/assets/ 아래에 두면 된다. 키 목록은 textures.ts 의 SPRITE_KEYS 참고.
 *
 * 크기 규칙 (1타일 = 32px):
 *   - 바닥/벽:          32x32
 *   - 가구:             (가로 칸 x 32) x (세로 칸 x 32), 회전 0 기준
 *   - 캐릭터 파츠:      char_body / char_legs / char_head / char_hair (흰색으로 그리면 색상 틴트 적용)
 *   - 소품(prop_*):     16x16
 *
 * 예)
 *   furn_bed: 'assets/furniture/bed.png',
 *   floor_wood: 'assets/tiles/floor_wood.png',
 */
export const ASSET_MANIFEST: Record<string, string> = {
  // furn_bed: 'assets/furniture/bed.png',
};
