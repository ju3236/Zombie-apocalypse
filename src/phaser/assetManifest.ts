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
  // 가구 (직접 그린 도트)
  furn_aquarium: 'assets/furniture/furn_aquarium.png',
  furn_arcade: 'assets/furniture/furn_arcade.png',
  furn_armchair: 'assets/furniture/furn_armchair.png',
  furn_barricade: 'assets/furniture/furn_barricade.png',
  furn_bathtub: 'assets/furniture/furn_bathtub.png',
  furn_bbq: 'assets/furniture/furn_bbq.png',
  furn_bean_bag: 'assets/furniture/furn_bean_bag.png',
  furn_bed: 'assets/furniture/furn_bed.png',
  furn_bookcase: 'assets/furniture/furn_bookcase.png',
  furn_bunk_bed: 'assets/furniture/furn_bunk_bed.png',
  furn_campfire: 'assets/furniture/furn_campfire.png',
  furn_chair: 'assets/furniture/furn_chair.png',
  furn_coat_rack: 'assets/furniture/furn_coat_rack.png',
  furn_coffee_table: 'assets/furniture/furn_coffee_table.png',
  furn_crate: 'assets/furniture/furn_crate.png',
  furn_desk: 'assets/furniture/furn_desk.png',
  furn_double_bed: 'assets/furniture/furn_double_bed.png',
  furn_dresser: 'assets/furniture/furn_dresser.png',
  furn_fireplace: 'assets/furniture/furn_fireplace.png',
  furn_floor_cushion: 'assets/furniture/furn_floor_cushion.png',
  furn_fridge: 'assets/furniture/furn_fridge.png',
  furn_gas_range: 'assets/furniture/furn_gas_range.png',
  furn_generator: 'assets/furniture/furn_generator.png',
  furn_gun_locker: 'assets/furniture/furn_gun_locker.png',
  furn_jukebox: 'assets/furniture/furn_jukebox.png',
  furn_lamp: 'assets/furniture/furn_lamp.png',
  furn_locker: 'assets/furniture/furn_locker.png',
  furn_mattress: 'assets/furniture/furn_mattress.png',
  furn_medcab: 'assets/furniture/furn_medcab.png',
  furn_mirror: 'assets/furniture/furn_mirror.png',
  furn_neon: 'assets/furniture/furn_neon.png',
  furn_nightstand: 'assets/furniture/furn_nightstand.png',
  furn_pet_bed: 'assets/furniture/furn_pet_bed.png',
  furn_piano: 'assets/furniture/furn_piano.png',
  furn_plant: 'assets/furniture/furn_plant.png',
  furn_planter: 'assets/furniture/furn_planter.png',
  furn_radio_desk: 'assets/furniture/furn_radio_desk.png',
  furn_rain: 'assets/furniture/furn_rain.png',
  furn_rug: 'assets/furniture/furn_rug.png',
  furn_sandbags: 'assets/furniture/furn_sandbags.png',
  furn_shelf: 'assets/furniture/furn_shelf.png',
  furn_sink: 'assets/furniture/furn_sink.png',
  furn_sleeping_bag: 'assets/furniture/furn_sleeping_bag.png',
  furn_sofa: 'assets/furniture/furn_sofa.png',
  furn_stove: 'assets/furniture/furn_stove.png',
  furn_table: 'assets/furniture/furn_table.png',
  furn_tv: 'assets/furniture/furn_tv.png',
  furn_vanity: 'assets/furniture/furn_vanity.png',
  furn_wardrobe: 'assets/furniture/furn_wardrobe.png',
  furn_workbench: 'assets/furniture/furn_workbench.png',
  // 벽·문·창 (정면 16×70)
  door_wood: 'assets/walls/door_wood.png',
  wall_concrete: 'assets/walls/wall_concrete.png',
  wall_paper_flower: 'assets/walls/wall_paper_flower.png',
  wall_paper_stripe: 'assets/walls/wall_paper_stripe.png',
  wall_wood: 'assets/walls/wall_wood.png',
  window_wood: 'assets/walls/window_wood.png',
  // 바닥·땅 (32×16)
  floor_carpet: 'assets/floors/floor_carpet.png',
  floor_concrete: 'assets/floors/floor_concrete.png',
  floor_tile: 'assets/floors/floor_tile.png',
  floor_wood: 'assets/floors/floor_wood.png',
  ground_dirt: 'assets/floors/ground_dirt.png',
  ground_grass: 'assets/floors/ground_grass.png',
};
