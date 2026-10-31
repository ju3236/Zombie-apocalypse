/**
 * 그래픽 교체 지점. 자세한 규격은 docs/SPRITES.md, 크기가 맞는 밑그림은 docs/sprite-templates/.
 *
 * `키 → PNG 경로` 를 적으면 임시 도트 대신 그 PNG 가 쓰인다. PNG 는 public/assets/ 아래에 둔다.
 *
 *   - 바닥 타일 (floor_*):   32×16 마름모
 *   - 벽/벽지/문/창 (wall_*, window_*, door_*): 정면 16×70 (게임이 기울여 붙인다)
 *   - 가구 (furn_*):         가로 = (가로칸+세로칸)×16, 바닥 마름모가 그림 맨 아래. 세로 자유
 *                            회전 모습을 따로 그리면 furn_*_r1 (없으면 좌우 반전)
 *   - 소품 (prop_p_*):       12×12
 *   - 캐릭터:                게임 안 프로필에서 캐릭터마다 올린다 (26×38 권장)
 */
export const ASSET_MANIFEST: Record<string, string> = {
  // furn_bed: 'assets/furniture/bed.png',
};
