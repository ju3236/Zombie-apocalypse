"""데이터팩(items/recipes/loot) → 게임 TS 데이터. 사용: python3 -I convert.py <pack_dir> <src_game_data_dir>"""
import json, re, sys, os

PACK, OUT = sys.argv[1], sys.argv[2]
items = json.load(open(os.path.join(PACK, 'items.json')))['items']
recipes = json.load(open(os.path.join(PACK, 'recipes.json')))['recipes']
loot = json.load(open(os.path.join(PACK, 'loot_tables.json')))['locations']
BY = {i['id']: i for i in items}

# ── 이미 있는 아이템과 같은 것 (팩 id → 게임 id)
ALIAS = {
    'wood_plank': 'plank', 'nail': 'nails', 'metal_scrap': 'scrap', 'battery_cell': 'battery', 'plastic_scrap': 'plastic',
    'cloth_scrap': 'cloth', 'tape': 'duct_tape', 'ceramic_tile': 'tile_pack', 'fuel_can': 'gasoline', 'cooking_gas': 'gas_can',
    'water_dirty': 'dirty_water', 'water_clean': 'boiled_water', 'bottle_empty': 'empty_bottle', 'soil': 'dirt_bag', 'circuit': 'electronics',
    'meat_raw': 'raw_meat', 'fish_raw': 'fish', 'instant_ramen': 'instant_noodles', 'berry': 'berries', 'meat_stew': 'stew',
    'bibimbap': 'rice_bowl', 'spicy_ramen': 'ramen', 'antibiotic_game': 'antibiotics', 'first_aid_kit': 'first_aid',
    'lockpick_game': 'lockpick', 'baseball_bat': 'bat', 'nailed_bat': 'nail_bat', 'metal_pipe_weapon': 'pipe', 'spear_wood': 'spear',
    'kitchen_knife_weapon': 'kitchen_knife', 'crowbar_weapon': 'crowbar', 'handgun': 'pistol', 'ammo_handgun': 'ammo_9mm',
    'ammo_shotgun': 'ammo_shell', 'tshirt': 'w_tshirt', 'hoodie': 'w_hoodie', 'pants_jeans': 'w_jeans', 'shoes_sneakers': 'w_sneakers',
    'shoes_boots': 'w_work_boots', 'hat_cap': 'w_cap', 'hat_beanie': 'w_beanie', 'gloves_cotton': 'w_work_gloves', 'gloves_leather': 'w_leather_gloves',
    'backpack_small': 'school_bag', 'backpack_large': 'hiking_pack', 'helmet_military': 'w_army_helmet', 'respirator_game': 'gas_mask',
    'research_keycard': 'lab_keycard', 'map_fragment': 'area_map', 'prop_walkie_talkie': 'walkie_talkie', 'herb': 'herbs',
    'water_filter_station': 'f_water_filter', 'watch_platform': 'f_watchtower', 'wallpaper_flower': 'wallpaper_roll', 'wallpaper_stripe': 'wallpaper_roll',
    'floor_mat': 'f_rug', 'work_jacket': 'w_work_jacket', 'fertilizer': 'fertilizer', 'wire': 'wire', 'honey': 'honey', 'rice': 'rice',
}
for i in items:
    if i['id'].startswith('furn_'): ALIAS[i['id']] = 'f_' + i['id'][5:]
    if i['id'].startswith('prop_p_'): ALIAS[i['id']] = i['id'][5:]
ALIAS.pop('work_jacket')  # 새로 만든다

# ── 건축 구간 → 설치 가구 (나머지 벽·바닥 구간은 기존 건축 방식과 겹쳐 뺀다)
CONSTRUCTION_FURN = {
    'fence_wood': dict(w=1, h=1, color=0x8a6a3a, accent=0x6a4a2a, def_=2, H=14, desc='거점 둘레를 막는 울타리. 방어력 +2'),
    'fence_metal': dict(w=1, h=1, color=0x6a6e74, accent=0x4a4e54, def_=3, H=16, desc='철제 울타리. 방어력 +3'),
    'gate_wood': dict(w=2, h=1, color=0x7b5634, accent=0x5f4127, def_=2, H=18, desc='드나들 수 있는 나무 대문. 방어력 +2'),
    'storage_shed': dict(w=2, h=2, color=0x6a5a4a, accent=0x4a3a2a, container=60, H=30, desc='짐을 잔뜩 넣을 수 있는 간이 창고 (60kg)'),
    'storage_rack': dict(w=2, h=1, color=0x5a5e64, accent=0x3a3e44, container=40, H=28, desc='튼튼한 선반 설비 (40kg)'),
    'solar_panel_game': dict(w=2, h=1, color=0x2a3a5a, accent=0x9ab0d0, light=3, H=10, desc='낮에 모은 빛으로 주변을 밝힌다'),
    'lighting_fixture': dict(w=1, h=1, color=0xd8d0b0, accent=0xf5d76e, light=4.5, H=34, desc='방 전체를 환하게 밝히는 조명'),
    'trap_alarm': dict(w=1, h=1, color=0x5a4a3a, accent=0xc9a23a, H=10, desc='깡통과 줄로 만든 경보기. 습격을 일찍 알아챈다 (+5분)'),
    'rain_cover': dict(w=2, h=2, color=0x3a5a7a, accent=0x2a4a6a, H=22, desc='빗물 수집 속도 +30%, 비가 새는 일을 막는다'),
    'crop_irrigation': dict(w=1, h=1, color=0x4a7a9a, accent=0x6a6e74, H=12, desc='텃밭·온실 생산 +25%'),
    'wood_stairs': None, 'window_barricade': dict(w=1, h=1, color=0x8a6a3a, accent=0x5a4a2a, def_=2, H=20, desc='창문을 판자로 덧대 막는다. 방어력 +2'),
}
SKIP = {i['id'] for i in items if i['category'] == 'construction' and i['id'] not in CONSTRUCTION_FURN or CONSTRUCTION_FURN.get(i['id'], 1) is None}

def gid(pid):
    if pid in SKIP: return None
    if pid in CONSTRUCTION_FURN: return 'f_' + pid.replace('_game', '')
    return ALIAS.get(pid, pid)

RAR = {'common': None, 'uncommon': None, 'rare': 2, 'epic': 3, 'legendary': 3}

ICON_KW = [
    ('통나무|판자|목재|나무 막대|나뭇가지|나무껍질|톱밥', '🪵'), ('못|나사|볼트|경첩|스프링|기어', '🔩'), ('금속|철근|철사|고철|파이프', '🔧'),
    ('전선|케이블|구리선', '➰'), ('회로|퓨즈|LED|전구|모터|부품|분석기|냉각|전원', '📟'), ('배터리|건전지', '🔋'),
    ('유리|렌즈|거울판', '🔍'), ('플라스틱', '🧪'), ('고무', '⚫'), ('천|원단|실|솜|충전재|지퍼|단추|버클|깃털', '🧵'), ('가죽', '🟫'),
    ('밧줄', '🪢'), ('접착', '🧴'), ('페인트|잉크', '🎨'), ('시멘트|모래|돌|벽돌|점토', '🧱'), ('숯', '⚫'), ('물', '💧'),
    ('필터', '🫁'), ('시약|샘플|혈청|억제제|해독제|연구', '🧬'), ('그릇|냄비|프라이팬', '🍳'), ('유리병|병', '🫙'), ('자루', '👜'), ('종이|편지|엽서|인화지', '📄'),
    ('밀랍|양초', '🕯️'), ('퇴비|흙|비료', '🟫'),
    ('쌀|밥|죽|주먹밥', '🍚'), ('밀가루|빵|토스트|샌드위치|머핀|파이|쿠키|팬케이크|피자', '🍞'), ('면|라면|국수|파스타', '🍜'),
    ('달걀|계란|오믈렛', '🥚'), ('우유|치즈|버터|요거트|밀크', '🥛'), ('소금|설탕|후추|간장|고추장|된장|식초|식용유', '🧂'), ('꿀', '🍯'),
    ('커피', '☕'), ('차|허브', '🍵'), ('닭', '🍗'), ('고기|육포|햄|소시지|베이컨|꼬치', '🥩'), ('생선|건어물|탕', '🐟'), ('통조림|병조림', '🥫'),
    ('감자|고구마', '🥔'), ('양파|마늘', '🧅'), ('당근', '🥕'), ('양배추|상추|채소|샐러드|피클', '🥬'), ('토마토', '🍅'), ('오이', '🥒'),
    ('고추', '🌶️'), ('버섯', '🍄'), ('옥수수', '🌽'), ('콩', '🫘'), ('사과', '🍎'), ('바나나', '🍌'), ('딸기|베리', '🍓'), ('레몬', '🍋'),
    ('오렌지|과일', '🍊'), ('김|해조|미역', '🌿'), ('김치', '🥬'), ('견과', '🥜'), ('초코|핫초코', '🍫'), ('수프|스튜|찌개', '🍲'), ('카레', '🍛'),
    ('잼', '🍓'), ('전', '🥞'), ('주스|레모네이드|셰이크', '🧃'),
    ('붕대', '🩹'), ('소독', '🧴'), ('부목', '🦴'), ('진통제|감기약|약', '💊'), ('장갑', '🧤'), ('마스크', '😷'), ('핫팩', '🔥'), ('냉찜질', '🧊'), ('검사', '🧪'),
    ('망치', '🔨'), ('톱', '🪚'), ('드라이버|렌치|펜치|멀티툴|수리', '🛠️'), ('삽|괭이|곡괭이', '⛏️'), ('도끼', '🪓'), ('바느질|가위', '✂️'),
    ('손전등|헤드램프', '🔦'), ('쌍안경', '🔭'), ('라이터|성냥', '🔥'), ('물뿌리개', '🚿'), ('붓', '🖌️'),
    ('몽둥이|방망이|봉|경찰봉', '🏏'), ('칼|마체테', '🔪'), ('창', '🔱'), ('방패', '🛡️'), ('권총|리볼버|소총|산탄|기관단총', '🔫'), ('활|석궁', '🏹'),
    ('화살|볼트', '➹'), ('탄약', '🟡'),
    ('티셔츠|셔츠|니트|후드|원피스|점프슈트', '👕'), ('재킷|코트|점퍼|우비|조끼|작업복', '🧥'), ('바지|치마', '👖'), ('운동화|작업화|장화|슬리퍼|부츠', '👢'),
    ('모자|헬멧|안전모', '⛑️'), ('목도리', '🧣'), ('양말', '🧦'), ('벨트', '🪢'), ('보호대', '🦺'),
    ('씨앗|씨감자|종구|모종', '🌱'), ('지도', '🗺️'), ('기술서|요리책|교본|설명서|자료집|만화책', '📘'), ('사진', '🖼️'), ('동전', '🪙'),
    ('디스크', '💿'), ('사료', '🦴'), ('비누', '🧼'), ('세제', '🧴'), ('울타리|대문|창고|선반|창문 보호판', '🚧'), ('태양광', '🔆'), ('조명', '💡'),
    ('경보기', '🔔'), ('천막', '⛺'), ('관수', '🚿'),
]

def icon(name, cat):
    for kw, ic in ICON_KW:
        if re.search(kw, name): return ic
    return {'food_raw': '🥫', 'food_cooked': '🍲', 'drink': '🥤', 'medicine': '💊', 'tool': '🛠️', 'material': '📦', 'misc': '📦', 'research': '🧬', 'seed': '🌱'}.get(cat, '📦')

# ── 무기 (게임 수치로 직접 맞춤): damage, acc, noise, wear, skill, push, ammo, block, durability
WEAP = {
    'wooden_club': ([1, 2], 0.08, 3, 1, 'melee', 0.12, None, 0, 25),
    'reinforced_club': ([1, 3], 0.08, 3, 1, 'melee', 0.15, None, 0, 45),
    'metal_baton': ([1, 3], 0.1, 3, 1, 'melee', 0.12, None, 0, 70),
    'hatchet': ([2, 3], 0.08, 3, 1, 'melee', 0, None, 0, 50),
    'spear_reinforced': ([2, 4], 0.12, 2, 1, 'melee', 0.22, None, 0, 50),
    'hunting_knife': ([1, 3], 0.18, 1, 1, 'melee', 0, None, 0, 70),
    'folding_knife': ([1, 2], 0.16, 1, 1, 'melee', 0, None, 0, 30),
    'shovel_weapon': ([2, 3], 0.04, 4, 1, 'melee', 0.2, None, 0, 70),
    'police_baton': ([1, 2], 0.14, 2, 1, 'melee', 0.18, None, 0, 90),
    'frying_pan_weapon': ([1, 2], 0.1, 5, 1, 'melee', 0.15, None, 0, 60),
    'wooden_shield': ([1, 1], 0.05, 2, 1, 'melee', 0.3, None, 0.18, 40),
    'metal_shield': ([1, 2], 0.03, 3, 1, 'melee', 0.35, None, 0.28, 90),
    'hunting_rifle': ([5, 7], 0.25, 50, 1, 'firearm', 0, 'ammo_rifle', 0, 110),
    'revolver': ([3, 6], 0.15, 32, 1, 'firearm', 0, 'ammo_9mm', 0, 140),
    'submachine_gun': ([3, 4], 0.3, 40, 1, 'firearm', 0, 'ammo_smg', 0, 90),
    'crossbow': ([3, 5], 0.2, 3, 1, 'firearm', 0, 'bolt_crossbow', 0, 80),
    'bow': ([2, 4], 0.15, 2, 1, 'firearm', 0, 'arrow', 0, 60),
}
WEAP_DESC = {
    'wooden_shield': '한 손에 들면 좀비의 손톱을 막아 준다 (맞을 확률 −18%).', 'metal_shield': '무겁지만 거의 모든 걸 막는다 (맞을 확률 −28%).',
    'bow': '거의 소리가 나지 않는 원거리 무기. 화살은 절반쯤 다시 주울 수 있다.', 'crossbow': '조용하고 강력하다. 볼트는 절반쯤 다시 주울 수 있다.',
    'hunting_rifle': '한 방이 무겁지만 소리가 매우 크다.', 'submachine_gun': '정확하지만 탄을 많이 먹고 시끄럽다.', 'revolver': '9mm 탄을 쓴다.',
}

# ── 옷 (칸, 방어율, 보온, 방수, 내구)
WEAR = {
    'shirt': ('top', 0.05, 1, 0, 20), 'long_sleeve': ('top', 0.06, 1, 0, 20), 'sweater': ('top', 0.06, 2, 0, 25), 'jacket': ('top', 0.15, 2, 0, 40),
    'coat': ('top', 0.12, 3, 0, 40), 'raincoat': ('top', 0.06, 1, 1, 30), 'winter_coat': ('top', 0.14, 4, 0, 45), 'w_work_jacket': ('top', 0.18, 2, 0, 50),
    'dress': ('top', 0.03, 1, 0, 15), 'jumpsuit': ('top', 0.16, 2, 0, 45),
    'pants_cargo': ('bottom', 0.12, 1, 0, 40), 'pants_slacks': ('bottom', 0.06, 1, 0, 25), 'shorts': ('bottom', 0.02, 0, 0, 15), 'skirt': ('bottom', 0.02, 0, 0, 15),
    'shoes_rubber': ('shoes', 0.1, 1, 1, 35), 'shoes_slippers': ('shoes', 0.01, 0, 0, 10),
    'hat_sun': ('hat', 0.02, 0, 0, 15), 'helmet_bike': ('hat', 0.22, 0, 0, 40), 'helmet_hard': ('hat', 0.25, 0, 0, 50), 'helmet_fire': ('hat', 0.3, 1, 0, 60),
    'vest_padded': ('top', 0.2, 2, 0, 50), 'vest_protective': ('top', 0.3, 1, 0, 60), 'vest_ballistic': ('top', 0.42, 1, 0, 90),
    'arm_guard': ('gloves', 0.3, 0, 0, 50), 'leg_guard': ('bottom', 0.3, 0, 0, 50), 'boots_reinforced': ('shoes', 0.3, 1, 0, 70),
}
# 칸이 없는 액세서리: 챙기기만 하면 효과
ACCESSORY = {
    'scarf': ('목에 두르면 따뜻하다. 소지품에 있으면 보온 +1', {'warm': 1}),
    'socks': ('마른 양말 한 켤레. 소지품에 있으면 보온 +1, 기력 소모 −3%', {'warm': 1, 'energy': 0.03}),
    'belt': ('허리춤에 도구를 건다. 소지 무게 +1kg', {'carry': 1}),
    'mask_dust': ('먼지를 막는다. 먼지 민감·알레르기 특성이 사라진다', {}),
}

# ── 의약품
MED = {
    'sterile_bandage': dict(treat='bandage', desc='깨끗하고 소독까지 된 붕대. 감으면 소독도 같이 된다.'),
    'alcohol_pad': dict(treat='disinfect', desc='상처를 닦는 소독솜.'),
    'splint': dict(consume={'health': 5}, desc='깊은 상처(열상)를 고정해 회복을 크게 앞당긴다.'),
    'cold_medicine': dict(consume={'health': 3}, desc='먹으면 몸이 따뜻해진다 (4시간 추위 걱정 없음).'),
    'medical_gloves': dict(desc='의료품 재료. 손을 깨끗하게.'),
    'surgical_mask': dict(desc='먼지와 병균을 막는다. 소지품에 있으면 먼지 민감·알레르기가 사라지고 감염 진행 −10%.'),
    'heat_pack': dict(consume={}, desc='흔들면 뜨거워진다. 4시간 동안 추위를 막는다.'),
    'ice_pack': dict(consume={'health': 2}, desc='폭염 속에서 몸을 식힌다 (4시간 더위 걱정 없음).'),
    'herbal_poultice': dict(treat='disinfect', desc='약초를 천에 싸 상처에 붙인다. 소독 대신 쓸 수 있다.'),
    'recovery_tea': dict(consume={'energy': 15, 'thirst': 20}, desc='마시면 마음이 가라앉고 기운이 난다. 겁에 질림을 풀어 준다.'),
    'infection_test_kit': dict(desc='감염 연구 재료. (연구실에서 쓴다)'),
    'experimental_serum': dict(consume={'infection': -45, 'health': -5}, desc='감염을 크게 늦추는 시험용 억제제. 부작용이 있다.'),
    'antidote': dict(consume={'infection': -100, 'health': 10}, desc='완성형 해독제. 감염을 완전히 없앤다.'),
}

TOOL = {
    'cooking_pot': (['pot'], '국물 요리(수프·찌개·스튜·죽)에 쓴다.'),
    'pliers': (['pliers'], '전선을 자르고 구부린다.'), 'shovel': (['dig'], '땅을 판다. 지렁이(미끼)를 구할 수 있다.'), 'hoe': (['hoe'], '밭을 간다. 거점 창고에 있으면 텃밭 생산 +10%.'),
    'axe_tool': (['axe'], '나무를 벤다.'), 'pickaxe': (['pickaxe'], '돌을 캔다.'), 'sewing_kit': (['sewing'], '옷을 수선하고 재봉한다. 해진 옷 수리에 쓴다.'),
    'scissors': (['scissors'], '천을 자른다.'), 'headlamp': (['light'], '머리에 쓰는 손전등. 두 손이 자유롭다.'), 'multitool': (['screwdriver', 'pliers', 'scissors'], '드라이버·펜치·가위가 한 몸에.'),
    'binoculars': (['binoculars'], '멀리 본다. 소지품에 있으면 좀비를 먼저 발견 +12%.'), 'matches': (['fire'], '불을 붙인다.'), 
    'water_can': (['watering'], '물을 준다. 거점 창고에 있으면 텃밭 생산 +10%.'), 'repair_kit': (['repair'], '무기·도구를 제대로 수리한다 (5회).'), 'paint_brush': (['paint'], '칠을 한다.'),
}
TOOL_DUR = {'repair_kit': 5, 'sewing_kit': 8}

SEED_CROP = {
    'seed_potato': 'potato', 'seed_carrot': 'carrot', 'seed_tomato': 'tomato', 'seed_cabbage': 'cabbage', 'seed_lettuce': 'lettuce',
    'seed_cucumber': 'cucumber', 'seed_pepper': 'pepper', 'seed_corn': 'corn', 'seed_bean': 'beans', 'seed_strawberry': 'strawberry',
    'seed_herb': 'herbs', 'seed_onion': 'onion', 'seed_garlic': 'garlic', 'seed_flower': 'p_flowers', 'seed_sunflower': 'nuts', 'seed_wheat': 'flour',
}

BOOK = {
    'manual_carpentry': ('crafting', '목공 기술서'), 'manual_cooking': ('cooking', '요리책'), 'manual_medical': ('medical', '의료 교본'),
    'manual_mechanics': ('crafting', '정비 설명서'), 'manual_electronics': ('crafting', '전자 공학 교본'), 'manual_farming': ('farming', '농사 교본'),
    'manual_research': ('medical', '연구 자료집'),
}
FUN = {'comic_book': '읽으면 기분이 좋아진다.', 'game_disc': '오락기가 있으면… 아니, 보기만 해도 즐겁다.', 'photo_memory': '오래된 추억 사진. 보면 마음이 놓인다.', 'postcard': '어딘가의 풍경. 보고 있으면 기분이 좋아진다.'}

MISC_DESC = {
    'letter_paper': '편지를 쓰면 상대의 호감이 조금 더 오른다 (소지품에 있을 때).', 'old_coin': '행운의 동전. 소지품에 있으면 희귀품 발견 +2%.',
    'pet_food': '떠돌이 동물을 길들이는 데 쓴다.', 'soap': '씻으면 상쾌하다. 감염 −2, 기분 좋음.', 'cleaning_liquid': '소독약 재료로 쓸 수 있다.', 'photo_paper': '사진 인화지.',
}

def ts(v):
    return json.dumps(v, ensure_ascii=False)

def tsobj(d):
    parts = []
    for k, v in d.items():
        if v is None: continue
        if isinstance(v, dict): parts.append(f"{k}: {tsobj(v)}")
        elif isinstance(v, list): parts.append(f"{k}: [{', '.join(tsobj(x) if isinstance(x, dict) else ts(x) for x in v)}]")
        else: parts.append(f"{k}: {ts(v)}")
    return '{ ' + ', '.join(parts) + ' }'

EXISTING = set(re.findall(r"id: '([a-z_0-9]+)'", open(os.path.join(OUT, 'items.ts')).read()))
out_items = []
new_ids = set()
crops = set(SEED_CROP.values())
for i in items:
    pid, cat, name = i['id'], i['category'], i['name']
    g = gid(pid)
    if pid == 'work_jacket': g = 'w_work_jacket'
    if g is None or g in EXISTING or (g != pid and pid not in CONSTRUCTION_FURN and pid != 'work_jacket'):
        continue  # 기존 아이템과 같거나 뺀 것
    d = {'id': g, 'name': name, 'category': None, 'weight': round(i.get('weight_kg', 0.2), 2), 'icon': icon(name, cat), 'desc': i.get('description') or ''}
    r = RAR.get(i.get('rarity'))
    eff = i.get('effects') or {}
    if cat in ('food_raw', 'food_cooked', 'drink'):
        d['category'] = 'drink' if cat == 'drink' else 'food'
        con = {}
        if eff.get('hunger'): con['hunger'] = -eff['hunger']
        if eff.get('thirst'): con['thirst'] = -eff['thirst']
        if eff.get('fatigue'): con['energy'] = -eff['fatigue']
        if pid in ('chicken_raw',): con['sick'] = 0.5
        if pid in ('egg',): con['sick'] = 0.15
        if pid in ('flour', 'salt', 'sugar', 'pepper_powder', 'cooking_oil', 'soy_sauce', 'gochujang', 'doenjang', 'vinegar', 'coffee_beans', 'tea_leaf', 'noodle_dry'):
            con = {'hunger': 3 if pid != 'sugar' else 6}
            d['desc'] = d['desc'] or '그대로 먹기보다 요리 재료로 쓰자.'
        if pid.startswith('canned_'): con['leaves'] = 'jar_empty' if pid in ('canned_vegetables', 'canned_meat') else 'empty_can'
        if pid in ('jerky', 'dried_fish', 'canned_vegetables', 'canned_meat', 'pickled_vegetables', 'fruit_jam'): d['desc'] = d['desc'] or '오래 보관할 수 있다.'
        d['consume'] = con
        sh = i.get('spoil_hours')
        if sh and sh <= 200: d['spoil'] = round(sh * 1.5)
        if not d['desc']:
            d['desc'] = '직접 만든 요리.' if cat == 'food_cooked' else ('마시면 목이 축여진다.' if cat == 'drink' else ('밭에서 거둔 작물.' if pid in crops else '요리 재료.'))
    elif cat == 'medicine':
        d['category'] = 'medical'
        m = MED.get(pid, {})
        if 'treat' in m: d['treat'] = m['treat']
        if 'consume' in m: d['consume'] = m['consume']
        d['desc'] = m.get('desc', d['desc'])
        if pid == 'surgical_mask': d['carry'] = {'infect': 0.1}
    elif cat == 'tool':
        d['category'] = 'tool'
        tags, desc = TOOL.get(pid, ([pid], ''))
        d['tags'] = tags
        d['desc'] = desc or d['desc']
        if pid in TOOL_DUR: d['durability'] = TOOL_DUR[pid]
        if pid == 'binoculars': d['carry'] = {'detect': 0.12}
        if pid in ('shovel', 'axe_tool', 'pickaxe'):
            d['weapon'] = {'damage': [1, 3] if pid != 'shovel' else [1, 2], 'acc': 0.04, 'noise': 4, 'wear': 1, 'skill': 'melee', 'push': 0.12}
            d['durability'] = 60
    elif cat == 'weapon':
        d['category'] = 'weapon'
        dm, acc, noise, wear, skill, push, ammo, block, dur = WEAP[pid]
        w = {'damage': dm, 'acc': acc, 'noise': noise, 'wear': wear, 'skill': skill}
        if push: w['push'] = push
        if ammo: w['ammo'] = ammo
        if block: w['block'] = block
        d['weapon'] = w
        d['durability'] = dur
        d['desc'] = WEAP_DESC.get(pid, d['desc']) or '쓸 만한 무기.'
        if pid == 'frying_pan_weapon': d['tags'] = ['pan']; d['desc'] = '휘두르면 묵직하다. 볶음 요리에도 쓴다.'
        if pid in ('crossbow', 'bow', 'hunting_rifle', 'submachine_gun', 'revolver'): r = r or 2
    elif cat == 'ammo':
        d['category'] = 'material'
        d['desc'] = {'ammo_rifle': '사냥용 소총 탄약.', 'ammo_smg': '기관단총 탄약.', 'arrow': '활에 쓴다. 쏜 화살은 절반쯤 다시 줍는다.', 'bolt_crossbow': '석궁에 쓴다. 쏜 볼트는 절반쯤 다시 줍는다.'}.get(pid, '탄약.')
    elif cat in ('clothing', 'armor'):
        if pid in ACCESSORY:
            d['category'] = 'clothing'
            desc, cm = ACCESSORY[pid]
            d['desc'] = desc
            if cm: d['carry'] = cm
        else:
            slot, prot, warm, rain, dur = WEAR[g if g in WEAR else pid]
            d['category'] = 'clothing'
            d['wear'] = {'slot': slot, 'protect': prot}
            if warm: d['warm'] = warm
            if rain: d['rainproof'] = True
            d['durability'] = dur
            bits = []
            if warm >= 3: bits.append('아주 따뜻하다')
            elif warm == 2: bits.append('따뜻하다')
            if rain: bits.append('비에 젖지 않는다')
            if pid == 'hat_sun': bits.append('폭염 속 더위를 덜어 준다')
            if prot >= 0.25: bits.append('물림을 잘 막는다')
            d['desc'] = ', '.join(bits) + '.' if bits else '입을 수 있다.'
    elif cat == 'seed':
        d['category'] = 'material'
        crop = SEED_CROP[pid]
        d['seed'] = crop
        d['desc'] = '텃밭·온실에 심을 수 있다.'
    elif cat == 'research':
        d['category'] = 'rare'
        if pid.startswith('antidote_data'): d['tags'] = ['research' + pid[-1]]
        d['desc'] = {'antidote_data_1': '감염 연구의 첫 기록. 연구실에서 시험용 억제제를 만들 실마리.', 'antidote_data_2': '연구 기록 II. 안정화 혈청의 실마리.', 'antidote_data_3': '연구 기록 III. 완성형 해독제를 만들 수 있게 된다 (창고에 있으면).',
                     'lab_station_kit': '간이 연구실을 설치하는 키트. (제작 → 시설에서 연구실로)'}.get(pid, '감염 연구 재료. 연구실에서 쓴다.')
        if pid.startswith('antidote_data'): r = 3
    elif cat == 'misc':
        if pid in BOOK:
            d['category'] = 'prop'
            d['read'] = {'skill': BOOK[pid][0]}
            d['desc'] = '읽으면 ' + {'crafting':'제작','cooking':'요리','medical':'의료','farming':'농업'}[BOOK[pid][0]] + ' 숙련 경험치를 크게 얻는다 (한 사람당 한 번, 책은 남는다). 진열 소품으로도 쓴다.'
        elif pid in FUN:
            d['category'] = 'prop'
            d['read'] = {'fun': True}
            d['desc'] = FUN[pid]
        elif pid in ('soap',):
            d['category'] = 'medical'
            d['consume'] = {'infection': -2}
            d['desc'] = MISC_DESC[pid]
        elif pid == 'pet_food':
            d['category'] = 'food'
            d['consume'] = {'hunger': 8, 'sick': 0.2}
            d['desc'] = MISC_DESC[pid]
        else:
            d['category'] = 'material' if pid in ('photo_paper', 'cleaning_liquid', 'letter_paper') else 'prop'
            d['desc'] = MISC_DESC.get(pid, d['desc'] or '잡동사니.')
            if pid == 'old_coin': d['carry'] = {'rare': 0.02}
    elif cat == 'material':
        d['category'] = 'material'
        if not d['desc']: d['desc'] = '제작 재료.'
        if pid == 'pot_empty': d['tags'] = ['pot']; d['desc'] = '국물 요리(수프·찌개·스튜·죽)에 쓴다.'
        if pid == 'pan_empty': d['tags'] = ['pan']; d['desc'] = '볶고 굽는 요리에 쓴다.'
        if pid == 'water_filter': d['desc'] = '더러운 물을 걸러 깨끗하게 만든다 (제작 재료).'
    elif cat == 'construction':
        f = CONSTRUCTION_FURN[pid]
        d['category'] = 'furniture'
        d['desc'] = f['desc']
    else:
        continue
    if r: d['rarity'] = r
    out_items.append(d)
    new_ids.add(d['id'])

# ── 내가 더한 아이템
EXTRA = [
    dict(id='f_lab_station', name='간이 연구실', category='furniture', weight=20, icon='🔬', desc='감염 연구 설비. 혈청·해독제를 만들 수 있다.', rarity=2),
    dict(id='earplugs', name='귀마개', category='tool', weight=0.01, icon='🎧', desc='소지품에 있으면 잠귀가 밝음 특성이 사라진다.'),
    dict(id='sleeping_pill', name='수면제', category='medical', weight=0.01, icon='💤', desc='먹고 자면 잠의 질이 크게 오른다 (8시간).', consume={}),
    dict(id='sedative', name='안정제', category='medical', weight=0.01, icon='💊', desc='겁에 질림을 풀고 한동안 차분해진다.', consume={}),
    dict(id='motion_pill', name='멀미약', category='medical', weight=0.01, icon='💊', desc='먹으면 8시간 동안 멀미를 하지 않는다.', consume={}),
    dict(id='antihistamine', name='항히스타민제', category='medical', weight=0.01, icon='💊', desc='8시간 동안 알레르기·먼지 민감 특성이 사라진다.', consume={}),
    dict(id='antidiarrheal', name='지사제', category='medical', weight=0.01, icon='💊', desc='배탈을 바로 멈춘다.', consume={}),
    dict(id='vitamins', name='종합 비타민', category='medical', weight=0.05, icon='💊', desc='하루 동안 자연 회복 +15%, 배탈·병 확률 감소.', consume={'health': 2}),
    dict(id='suture_kit', name='봉합 키트', category='medical', weight=0.1, icon='🪡', desc='깊은 상처를 꿰맨다. 가장 심한 상처가 붕대·소독되고 회복이 크게 빨라진다.', consume={'health': 3}, rarity=2),
    dict(id='purify_tablet', name='정수 알약', category='material', weight=0.01, icon='💊', desc='더러운 물에 넣으면 바로 깨끗한 물이 된다 (불 없이).'),
    dict(id='mask_filter', name='교체용 필터', category='material', weight=0.1, icon='🫁', desc='방독면 필터를 새것으로 갈아 끼운다 (창고에서 수리).', rarity=2),
    dict(id='worm', name='지렁이', category='material', weight=0.01, icon='🪱', desc='미끼로 만든다. 삽으로 텃밭을 파거나 흙 포대를 뒤지면 나온다.'),
    dict(id='gift_wrap', name='선물 포장지', category='material', weight=0.05, icon='🎁', desc='소지품에 있으면 선물할 때 호감이 두 배로 오른다 (하나 씀).'),
    dict(id='lucky_charm', name='행운의 부적', category='prop', weight=0.02, icon='🧿', desc='소지품에 있으면 희귀품 발견 +3%, 담력 +5%.', carry={'rare': 0.03, 'nerve': 0.05}),
    dict(id='compass', name='나침반', category='tool', weight=0.1, icon='🧭', desc='소지품에 있으면 이동 시간 −5%. 방향치·길치 특성이 사라진다.', carry={'travel': 0.05}),
    dict(id='whistle', name='호루라기', category='tool', weight=0.02, icon='📯', desc='파티원을 부른다. 소지품에 있으면 파티 엄호 +8%.', carry={'cover': 0.08}),
    dict(id='thermos', name='보온병', category='tool', weight=0.4, icon='🫖', desc='소지품에 있으면 탐험 중 목마름 −10%.', carry={'thirst': 0.1}),
    dict(id='hardtack', name='건빵', category='food', weight=0.2, icon='🍘', desc='딱딱하지만 오래가는 비상식량.', consume={'hunger': 22, 'thirst': -4}),
    dict(id='canned_fish_home', name='생선 통조림(수제)', category='food', weight=0.4, icon='🥫', desc='직접 담근 생선 통조림.', consume={'hunger': 26, 'leaves': 'empty_can'}),
    dict(id='smoked_fish', name='훈제 생선', category='food', weight=0.3, icon='🐟', desc='연기에 훈연해 오래간다.', consume={'hunger': 30, 'thirst': -3}),
    dict(id='p_scented_candle', name='향초', category='prop', weight=0.2, icon='🕯️', desc='은은한 향. 진열하면 아늑함에 보탬이 된다.'),
    dict(id='p_frame', name='손그림 액자', category='prop', weight=0.3, icon='🖼️', desc='누군가 그린 그림을 넣은 액자.'),
    dict(id='p_succulent', name='다육이 화분', category='prop', weight=0.3, icon='🪴', desc='물을 거의 안 줘도 잘 자란다.'),
    dict(id='p_dreamcatcher', name='드림캐처', category='prop', weight=0.1, icon='🪶', desc='악몽을 걸러 준다던가.'),
    dict(id='p_wind_chime', name='풍경', category='prop', weight=0.2, icon='🎐', desc='바람이 불면 맑은 소리가 난다.'),
    dict(id='diary_book', name='빈 일기장', category='prop', weight=0.2, icon='📓', desc='진열해 두는 일기장. 쓰는 건 오너의 몫.'),
]
for e in EXTRA:
    out_items.append(e)
    new_ids.add(e['id'])

def lines_items():
    return '\n'.join('  ' + tsobj(d) + ',' for d in out_items)

all_known = new_ids | set(re.findall(r"id: '([a-z_0-9]+)'", open(os.path.join(OUT, 'items.ts')).read()))

# ── 레시피
GROUP = {'food_cooked': 'food', 'food_raw': 'food', 'drink': 'food', 'medicine': 'medical', 'weapon': 'weapon', 'ammo': 'weapon', 'tool': 'tool',
         'clothing': 'clothing', 'armor': 'clothing', 'furniture': 'furniture', 'prop': 'furniture', 'construction': 'facility', 'material': 'building', 'research': 'research', 'misc': 'building'}
STATION = {'hand': None, 'kitchen': 'stove', 'campfire': 'stove', 'preserving': 'stove', 'water_station': None, 'workbench': 'workbench', 'construction': 'workbench',
           'sewing_table': 'workbench', 'medical_station': 'medical', 'research_lab': 'lab', 'garden': None}
SKILL = {'cooking': 'cooking', 'carpentry': 'crafting', 'tailoring': 'crafting', 'crafting': 'crafting', 'electronics': 'crafting', 'metalwork': 'crafting',
         'mechanics': 'crafting', 'research': 'medical', 'survival': 'scavenge', 'construction': 'crafting', 'first_aid': 'medical', 'farming': 'farming'}
TOOL_TAG = {'screwdriver': 'screwdriver', 'wrench': 'wrench', 'flashlight': 'light'}

existing_recipes = open(os.path.join(OUT, 'recipes.ts')).read()
existing_out = set(re.findall(r"output: \{ itemId: '([a-z_0-9]+)'", existing_recipes))
out_recipes = []
dropped = []
for rcp in recipes:
    o = gid(rcp['output']['item_id'])
    if o is None or o not in all_known: dropped.append(rcp['id']); continue
    if o in existing_out: continue
    inputs, tools = [], []
    ok = True
    for ing in rcp['ingredients']:
        pid = ing['item_id']
        if pid in TOOL_TAG: tools.append(TOOL_TAG[pid]); continue
        g = gid(pid)
        if g is None or g not in all_known: ok = False; break
        ex = next((x for x in inputs if x['itemId'] == g), None)
        if ex: ex['qty'] += ing['qty']
        else: inputs.append({'itemId': g, 'qty': ing['qty']})
    if not ok: dropped.append(rcp['id']); continue
    if rcp['station'] == 'sewing_table': tools.append('sewing')
    nm = rcp['name']
    if BY[rcp['output']['item_id']]['category'] == 'food_cooked':
        if re.search('수프|스튜|찌개|탕|미역국|죽', nm): tools.append('pot')
        elif re.search('볶음|프라이|튀김|전 |전$|팬케이크|오믈렛|토스트', nm.replace(' 제작', '')): tools.append('pan')
    if rcp['id'] == 'recipe_antidote': tools.append('research3')
    if rcp['id'] == 'recipe_serum_stable_game': tools.append('research2')
    if rcp['id'] == 'recipe_experimental_serum': tools.append('research1')
    oc = BY[rcp['output']['item_id']]['category']
    grp = GROUP.get(oc, 'building')
    lvl = min(6, rcp.get('skill_level', 0))
    r = {'id': 'p_' + rcp['id'].replace('recipe_', ''), 'name': rcp['name'].replace(' 제작', ''), 'group': grp, 'inputs': inputs}
    if tools: r['tools'] = sorted(set(tools))
    st = STATION[rcp['station']]
    if st: r['station'] = st
    r['output'] = {'itemId': o, 'qty': rcp['output']['qty']}
    r['skill'] = SKILL[rcp['skill']]
    r['level'] = lvl
    r['minutes'] = rcp.get('craft_minutes', 20)
    out_recipes.append(r)
    existing_out.add(o)

# 내 레시피
MY = [
    ('p_lab_station', '간이 연구실 설치', 'facility', [('lab_station_kit', 1), ('electronics', 2)], 'f_lab_station', 1, 'crafting', 2, 'workbench', []),
    ('p_repair_kit', '수리 도구 세트', 'tool', [('scrap', 3), ('duct_tape', 2), ('nails', 4)], 'repair_kit', 1, 'crafting', 2, 'workbench', ['screwdriver']),
    ('p_sewing_kit', '바느질 도구', 'tool', [('thread', 2), ('scrap', 1), ('cloth', 1)], 'sewing_kit', 1, 'crafting', 1, None, []),
    ('p_earplugs', '귀마개', 'tool', [('foam', 1)], 'earplugs', 2, 'crafting', 0, None, []),
    ('p_earplugs2', '귀마개 (천)', 'tool', [('cloth', 1), ('wax', 1)], 'earplugs', 2, 'crafting', 0, None, []),
    ('p_mask_filter', '교체용 필터', 'tool', [('charcoal', 2), ('cloth', 1), ('plastic', 1)], 'mask_filter', 1, 'crafting', 2, 'workbench', []),
    ('p_purify_water', '정수 알약으로 물 정화', 'food', [('dirty_water', 2), ('purify_tablet', 1)], 'water_bottle', 2, 'scavenge', 0, None, []),
    ('p_filter_water', '정수 필터로 물 거르기', 'food', [('dirty_water', 3), ('water_filter', 1)], 'water_bottle', 3, 'scavenge', 0, None, []),
    ('p_bottle_water', '끓인 물 병에 담기', 'food', [('boiled_water', 1), ('empty_bottle', 1)], 'water_bottle', 1, 'cooking', 0, None, []),
    ('p_recycle_bottle', '페트병 재활용', 'building', [('empty_bottle', 3)], 'plastic', 1, 'crafting', 0, None, []),
    ('p_recycle_can', '깡통 재활용', 'building', [('empty_can', 3)], 'scrap', 1, 'crafting', 0, None, []),
    ('p_bait_worm', '지렁이 미끼', 'food', [('worm', 2)], 'bait', 3, 'farming', 0, None, []),
    ('p_dig_worm', '흙 뒤져 지렁이 찾기', 'food', [('dirt_bag', 1)], 'worm', 3, 'farming', 0, None, ['dig']),
    ('p_hardtack', '건빵 굽기', 'food', [('flour', 2), ('salt', 1)], 'hardtack', 4, 'cooking', 1, 'stove', []),
    ('p_smoked_fish', '훈제 생선', 'food', [('fish', 2), ('charcoal', 1)], 'smoked_fish', 2, 'cooking', 1, 'stove', []),
    ('p_canned_fish', '생선 통조림 담그기', 'food', [('fish', 2), ('empty_can', 2), ('salt', 1)], 'canned_fish_home', 2, 'cooking', 2, 'stove', []),
    ('p_vitamins', '비타민 (과일 농축)', 'medical', [('orange', 2), ('lemon', 1)], 'vitamins', 2, 'medical', 2, 'medical', []),
    ('p_sedative', '안정제 (허브 추출)', 'medical', [('herbs', 3), ('chemical_game', 1)], 'sedative', 2, 'medical', 3, 'medical', []),
    ('p_sleeping_pill', '수면제', 'medical', [('herbs', 2), ('chemical_game', 1)], 'sleeping_pill', 2, 'medical', 3, 'medical', []),
    ('p_antidiarrheal', '지사제', 'medical', [('charcoal', 1), ('herbs', 1)], 'antidiarrheal', 2, 'medical', 1, None, []),
    ('p_suture_kit', '봉합 키트', 'medical', [('thread', 2), ('alcohol_pad', 1), ('medical_gloves', 1)], 'suture_kit', 1, 'medical', 3, 'medical', []),
    ('p_gift_wrap', '선물 포장지', 'furniture', [('paper', 2), ('paint_color', 1)], 'gift_wrap', 3, 'crafting', 0, None, []),
    ('p_lucky_charm', '행운의 부적', 'furniture', [('cloth', 1), ('thread', 1), ('old_coin', 1)], 'lucky_charm', 1, 'crafting', 1, None, []),
    ('p_compass', '나침반', 'tool', [('metal_spring', 1), ('glass_shard', 1), ('scrap', 1)], 'compass', 1, 'crafting', 2, 'workbench', []),
    ('p_whistle', '호루라기', 'tool', [('scrap', 1)], 'whistle', 1, 'crafting', 0, None, []),
    ('p_thermos', '보온병', 'tool', [('scrap', 2), ('insulation', 1), ('plastic', 1)], 'thermos', 1, 'crafting', 1, 'workbench', []),
    ('p_scented_candle', '향초', 'furniture', [('wax', 2), ('herbs', 1)], 'p_scented_candle', 1, 'crafting', 0, None, []),
    ('p_frame', '손그림 액자', 'furniture', [('paper', 1), ('plank', 1), ('paint_color', 1)], 'p_frame', 1, 'crafting', 1, None, []),
    ('p_succulent', '다육이 화분', 'furniture', [('pottery_clay', 1), ('dirt_bag', 1), ('seed_flower', 1)], 'p_succulent', 1, 'farming', 0, None, []),
    ('p_dreamcatcher', '드림캐처', 'furniture', [('branch', 1), ('thread', 1), ('feather', 2)], 'p_dreamcatcher', 1, 'crafting', 0, None, []),
    ('p_wind_chime', '풍경', 'furniture', [('scrap', 1), ('thread', 1), ('glass_shard', 1)], 'p_wind_chime', 1, 'crafting', 0, None, []),
    ('p_arrow2', '화살 (깃털)', 'weapon', [('wood_stick', 2), ('feather', 1), ('scrap', 1)], 'arrow', 5, 'crafting', 1, 'workbench', []),
    ('p_planks_scrap', '폐목재로 판자 만들기', 'building', [('scrap_wood', 3)], 'plank', 1, 'crafting', 0, None, []),
    ('p_charcoal_bark', '나무껍질 숯 굽기', 'building', [('bark', 3)], 'charcoal', 1, 'crafting', 0, 'stove', []),
    ('p_board_sawdust', '톱밥 압축 판자', 'building', [('sawdust', 3), ('glue', 1)], 'plank', 2, 'crafting', 1, 'workbench', []),
    ('p_sandbags', '모래주머니 쌓기', 'facility', [('sand', 3), ('bag_empty', 2)], 'f_sandbags', 1, 'crafting', 0, None, []),
    ('p_fireplace_brick', '벽돌 벽난로', 'facility', [('brick', 8), ('cement', 1), ('scrap', 2)], 'f_fireplace', 1, 'crafting', 3, 'workbench', ['hammer']),
    ('p_barricade_rebar', '철근 바리케이드', 'facility', [('rebar', 2), ('cement', 1), ('stone', 2), ('plank', 2)], 'f_barricade', 1, 'crafting', 2, 'workbench', ['hammer']),
    ('p_wire_cable', '케이블 벗겨 전선 얻기', 'building', [('cable', 1)], 'wire', 2, 'crafting', 0, None, ['scissors']),
    ('p_electronics_fuse', '퓨즈로 전자 부품 조립', 'building', [('fuse', 2), ('wire', 1)], 'electronics', 1, 'crafting', 2, 'workbench', ['screwdriver']),
    ('p_wallpaper_white', '흰 벽지 칠하기', 'building', [('paper', 2), ('paint_white', 1)], 'wallpaper_roll', 2, 'crafting', 0, None, ['paint']),
    ('p_wallpaper_black', '검은 벽지 칠하기', 'building', [('paper', 2), ('paint_black', 1)], 'wallpaper_roll', 2, 'crafting', 0, None, ['paint']),
    ('p_glasses', '안경 맞추기', 'tool', [('lens_glass', 2), ('scrap', 1)], 'glasses', 1, 'crafting', 2, 'workbench', ['screwdriver']),
    ('p_binoculars', '쌍안경 조립', 'tool', [('lens_glass', 2), ('spare_lens', 2), ('plastic', 1)], 'binoculars', 1, 'crafting', 3, 'workbench', ['screwdriver']),
    ('p_lockpick_pliers', '자물쇠 따개 (펜치)', 'tool', [('wire', 1)], 'lockpick', 2, 'crafting', 1, None, ['pliers']),
    ('p_photo_print', '추억 사진 인화', 'furniture', [('photo_paper', 1), ('battery', 1)], 'photo_memory', 1, 'crafting', 1, None, []),
    ('p_disinfect_clean', '세제로 소독약 만들기', 'medical', [('cleaning_liquid', 1), ('empty_bottle', 1)], 'disinfectant', 1, 'medical', 1, None, []),
    ('p_research_1', '감염 연구 기록 I 정리', 'research', [('infection_test_kit', 1), ('research_data', 1), ('sample_unknown', 1)], 'antidote_data_1', 1, 'medical', 2, 'lab', []),
    ('p_research_2', '감염 연구 기록 II 정리', 'research', [('antidote_data_1', 1), ('research_data', 2), ('sample_stable', 1)], 'antidote_data_2', 1, 'medical', 3, 'lab', []),
    ('p_research_3', '감염 연구 기록 III 정리', 'research', [('antidote_data_2', 1), ('research_data', 3), ('research_notes', 2)], 'antidote_data_3', 1, 'medical', 4, 'lab', []),
    ('p_heat_pack', '핫팩', 'medical', [('charcoal', 1), ('cloth', 1), ('salt', 1)], 'heat_pack', 2, 'crafting', 0, None, []),
]
for rid, nm, grp, ins, outp, q, sk, lvl, st, tools in MY:
    r = {'id': 'x_' + rid[2:], 'name': nm, 'group': grp, 'inputs': [{'itemId': a, 'qty': b} for a, b in ins]}
    if tools: r['tools'] = tools
    if st: r['station'] = st
    r['output'] = {'itemId': outp, 'qty': q}
    r['skill'] = sk; r['level'] = lvl; r['minutes'] = 20
    for x in r['inputs'] + [r['output']]:
        assert x['itemId'] in all_known or x['itemId'] in ('f_lab_station',), (rid, x)
    out_recipes.append(r)

# ── 파밍
PLACE_LOOT = {}
for place, t in loot.items():
    ents = []
    seen = set()
    for e in t['entries']:
        g = gid(e['item_id'])
        if g is None or g not in all_known or g in seen: continue
        seen.add(g)
        ent = {'itemId': g, 'w': max(1, round(e['weight'] / 30))}
        if e.get('qty_max', 1) > 1: ent['qty'] = [e.get('qty_min', 1), e['qty_max']]
        ents.append(ent)
    PLACE_LOOT[place] = ents
# 내가 더한 것도 어딘가에서 나오게
EXTRA_LOOT = {
    '약국': ['sleeping_pill', 'sedative', 'motion_pill', 'antihistamine', 'antidiarrheal', 'vitamins'], '병원': ['suture_kit', 'sleeping_pill', 'sedative', 'vitamins'],
    '편의점': ['earplugs', 'motion_pill', 'antidiarrheal', 'gift_wrap'], '잡화점': ['glasses', 'earplugs', 'gift_wrap', 'p_scented_candle', 'p_wind_chime', 'p_dreamcatcher', 'lucky_charm', 'compass', 'thermos'],
    '군부대': ['gas_mask', 'purify_tablet', 'mask_filter', 'compass', 'whistle', 'hardtack', 'thermos'], '사냥용품점': ['compass', 'whistle', 'thermos', 'purify_tablet', 'worm'],
    '원예점': ['worm', 'p_succulent'], '식당': ['cooking_pot', 'pan_empty', 'pot_empty'], '대형마트': ['pan_empty', 'pot_empty', 'thread'], '고급 주택': ['pan_empty', 'cooking_pot'], '공사장': ['w_work_jacket'], '공업지구': ['w_work_jacket', 'mask_filter'], '농장': ['worm'], '주택가': ['p_frame', 'diary_book', 'earplugs', 'vitamins', 'cooking_pot', 'glasses', 'p_pet_bowl', 'pan_empty', 'thread'], '백화점': ['p_scented_candle', 'p_frame', 'gift_wrap', 'thermos'],
    '소방서': ['mask_filter', 'whistle', 'gas_mask'], '연구소': ['mask_filter', 'purify_tablet', 'gas_mask'], '학교': ['diary_book', 'whistle'],
}
for place, ids in EXTRA_LOOT.items():
    for i2 in ids: PLACE_LOOT.setdefault(place, []).append({'itemId': i2, 'w': 1})

PLACE_RX = [
    ('고급 주택', '고급|저택'), ('가구점', '가구|인테리어|골동품'), ('편의점', '편의점|슈퍼|휴게소|주유소|이웃집'), ('대형마트', '마트|시장|유통센터|아울렛|쇼핑'),
    ('백화점', '백화점|쇼핑몰|호텔|이웃 도시'), ('식당', '식당|먹자|카페|베이커리|급식|푸드|식품'), ('농장', '농|과수원|축산|양계|곡물|비닐하우스|텃밭'),
    ('원예점', '꽃집|원예|공원|산림|휴양림'), ('병원', '병원|의원|의료|보건|혈액|격리'), ('약국', '약국|제약'), ('연구소', '연구|실험|데이터|화학'),
    ('학교', '학교|대학|유치원|도서관|수련|박물관|미술관|서점|문구'), ('경찰서', '경찰|교도소|법원|해안경비'), ('군부대', '군|검문소|탄약|벙커|방공호|무기고|주둔|보급 투하|대피소|수용소'),
    ('소방서', '소방|방재'), ('철물점', '철물|고철|건설|자재|목재'), ('공업지구', '공장|산업|공단|발전|변전|가스|하수|정수|폐기물|화학'),
    ('창고', '창고|물류|택배|컨테이너|야적|냉동'), ('물류센터', '물류|택배|화물'), ('정비소', '정비|차고|폐차|주차|차량|선박'), ('공사장', '공사|건설'),
    ('의류매장', '의류|세탁|미용|아울렛|쇼핑거리'), ('전자상가', '전자|통신|방송|데이터센터|레코드'), ('사냥용품점', '사냥|캠핑|낚시|등산|산장'), ('잡화점', '잡화|소품|애완|문구|상가'),
    ('주택가', '주택|빌라|아파트|원룸|주거|농가|산장|기숙사|이웃집|숙소|마을'),
]

with open(os.path.join(OUT, 'packItems.ts'), 'w') as f:
    f.write('// 자동 생성: 콘텐츠팩(items.json) + 추가 아이템. tools/convert_pack.py 로 다시 만든다.\n')
    f.write("import type { ItemDef } from './items';\n\n")
    f.write('export const PACK_ITEMS: ItemDef[] = [\n' + lines_items() + '\n];\n\n')
    f.write('/** 씨앗 → 거두는 작물 */\nexport const SEED_CROP: Record<string, string> = ' + ts({gid(k): v for k, v in SEED_CROP.items()}) + ';\n\n')
    f.write('/** 설치하는 건축 시설 (가구 정의용) */\nexport const PACK_FURNITURE = ' + ts({gid(k): {kk: vv for kk, vv in v.items() if kk != 'desc'} for k, v in CONSTRUCTION_FURN.items() if v}) + ';\n')
with open(os.path.join(OUT, 'packRecipes.ts'), 'w') as f:
    f.write("// 자동 생성: 콘텐츠팩(recipes.json) + 추가 레시피\nimport type { Recipe } from './recipes';\n\n")
    f.write('export const PACK_RECIPES: Recipe[] = [\n' + '\n'.join('  ' + tsobj(r) + ',' for r in out_recipes) + '\n];\n')
with open(os.path.join(OUT, 'packLoot.ts'), 'w') as f:
    f.write("// 자동 생성: 콘텐츠팩(loot_tables.json) — 장소 종류별 파밍 목록\nimport type { LootEntry } from './locations';\n\n")
    f.write('export const PLACE_LOOT: Record<string, LootEntry[]> = {\n' + '\n'.join(f'  {ts(k)}: [' + ', '.join(tsobj(e) for e in v) + '],' for k, v in PLACE_LOOT.items()) + '\n};\n\n')
    f.write('/** 장소 이름·종류 → 파밍 장소 종류 */\nexport const PLACE_RX: [string, RegExp][] = [\n' + '\n'.join(f'  [{ts(k)}, /{v}/],' for k, v in PLACE_RX) + '\n];\n')
print('items', len(out_items), 'recipes', len(out_recipes), 'dropped', len(dropped), dropped[:20])
print('places', {k: len(v) for k, v in PLACE_LOOT.items()})
