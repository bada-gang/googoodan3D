/**
 * 3D 모델 원본 그림 프롬프트. 이미 만든 이미지를 쓰지 않는(fromArt 가 없는) 모델만 여기 둔다.
 *
 * 3D 변환이 잘 되는 그림의 조건:
 *  - 물건 전체가 잘리지 않고 보인다
 *  - 흰 배경, 바닥 그림자 없음, 고른 빛 (그림자가 질감에 구워지면 게임 조명과 겹친다)
 *  - 표면의 잔무늬(껍질 오돌토돌함 등)는 모양이 아니라 색으로만 (면이 줄지 않는다)
 *  - 잎·귀처럼 얇은 부분은 도톰하게, 몸통에 붙여서 (얇으면 찢어진다)
 */
import { MODELS, furnitureModelKey } from '@/config/models';
import { STYLE } from './art-prompts';

export const MODEL_CONCEPT_STYLE =
  `${STYLE} A single subject for conversion into a 3D model: ` +
  'the whole subject fully visible and not cropped, centered, ' +
  'on a plain pure white background, no ground, no cast shadow, soft even lighting, no strong highlights.';

/** 물건: 정면에서 살짝 비스듬히 위에서 (뒷면은 AI 가 추측한다. 너무 옆이면 반대쪽이 엉터리가 된다) */
function item(description: string): string {
  return `Front three-quarter view from slightly above. ${description}`;
}

/**
 * 캐릭터: 정면 전신, 똑바로 선 자세.
 * 뼈대 없이 통째로 움직이므로(튀며 걷기) 팔다리가 몸에서 살짝 떨어진 차렷 자세가 가장 자연스럽다.
 * 비율은 ART_DIRECTION 2번 — 머리:몸 = 1:1.5~2, 지나친 SD 금지.
 */
function figure(description: string): string {
  return (
    'Full body front view, a cute toy-like child figure standing upright and facing the viewer, ' +
    'arms relaxed slightly away from the body, legs slightly apart, feet flat, happy friendly face. ' +
    'Head to body ratio about 1 to 1.7 (not super-deformed). Chunky simple shapes like a vinyl toy, ' +
    `clean smooth surfaces, no thin dangling parts. ${description}`
  );
}

/**
 * 동물: 옆모습(머리가 오른쪽). 앞에서 그리면 몸 길이를 AI 가 짐작해서 짧고 뭉툭해진다.
 * 경량화 때 -90° 돌려 머리를 앞(+z)으로 맞춘다 (models.ts 의 yaw).
 * 다리는 뼈대 없이 통째로 움직이므로 네 다리가 땅에 붙은 서 있는 자세로.
 */
function animal(description: string): string {
  return (
    'Exact side view profile, the animal faces to the RIGHT, standing calmly on all legs with every foot flat on the ground, ' +
    'chunky cute toy-like proportions (slightly big head, short sturdy legs), friendly face, no thin dangling parts. ' +
    description
  );
}

/** 문이 정면을 보는 건물. 비스듬히 그리면 3D 로 바꿨을 때 건물이 돌아가 있다 */
function facade(description: string): string {
  return `Straight-on front view slightly from above, the front door facing the viewer directly. ${description}`;
}

/** 나무: 열매 없이. 열매는 게임이 따로 단다 */
/**
 * 실제 식물 모양을 따르는 나무 (바나나 · 블루베리). 둥근 잎 덩어리 틀(tree)을 쓰면 다 같은 나무처럼 보인다.
 * 얇은 잎은 3D 변환에서 찢어지므로 잎을 두툼하게 그리게 한다.
 */
function realPlant(description: string): string {
  return (
    'Front view of a young fruit plant for a small farm, cute chunky toy-like 3D style that still clearly shows the real shape ' +
    `of the plant, thick chunky leaves (not paper-thin), NO fruits at all, no flowers, no ground, no grass, no pot. ${description}`
  );
}

function tree(description: string): string {
  return (
    'Front view of a young fruit tree for a small farm: short sturdy trunk, a big soft rounded leafy crown made of a few puffy ' +
    `cloud-like lumps, NO fruits at all, no flowers, no ground or grass. ${description}`
  );
}

/**
 * 가구: 앞면이 정면을 보게. 놓았을 때 앞면이 카메라(+z)를 봐야 해서다 (비스듬히 그리면 돌아가 있다).
 * 2학년이 고르기 쉽게 장난감처럼 단순하고 통통하게 (ART_DIRECTION 10).
 */
function furniture(description: string): string {
  return (
    'Straight-on front view slightly from above, the front of the furniture facing the viewer directly. ' +
    `Chunky cute toy-like furniture with soft rounded edges and simple shapes, no thin spindly parts. ${description}`
  );
}

/** 벽에 거는 물건: 정면. 뒤가 평평해야 벽에 붙는다 */
function wallItem(description: string): string {
  return `Straight-on front view, a flat wall decoration with a flat back, facing the viewer directly. ${description}`;
}

/** 바닥에 까는 물건: 비스듬히 위에서 본 납작한 판 */
function flatItem(description: string): string {
  return `Seen from above at a 45 degree angle, lying completely flat on the floor, very thin. ${description}`;
}

/** 키별 "무엇" */
export const MODEL_PROMPTS: Record<string, string> = {
  /* ---- 캐릭터 ---- */
  [MODELS.characters.boy]: figure(
    'A boy with short fluffy brown hair, a sunny yellow t-shirt (#f3c74f), sky-blue shorts and white sneakers.',
  ),
  [MODELS.characters.girl]: figure(
    'A girl with brown hair in two short pigtails tied with pink ribbons, a soft pink top (#f6a8bd), ' +
      'a white skirt over shorts and pink sneakers.',
  ),
  [MODELS.characters.farmer]: figure(
    'A child farmer wearing a round straw hat, mint-green overalls (#8fd8c4) over a white shirt, ' +
      'and small brown rubber boots.',
  ),
  [MODELS.characters.dino]: figure(
    'A child wearing a green dinosaur costume onesie (#8ed486) with the hood up: the hood has a friendly dino face, ' +
      'soft rounded spikes run down the back, and a short thick tail touches the ground behind. The child face is visible.',
  ),
  [MODELS.characters.bunny]: figure(
    'A child wearing a cream-white bunny hoodie (#fdfaf2) with the hood up: two thick upright bunny ears with pink inner ears, ' +
      'soft pink pants and white sneakers.',
  ),
  [MODELS.characters.astro]: figure(
    'A child astronaut in a chunky white and lavender (#b8a0e0) space suit with a small round chest panel, ' +
      'no helmet (the face and short dark hair are visible), a short thick antenna headband, and big white boots.',
  ),

  /* ---- 건물 ---- */
  [MODELS.buildings.house]: item(
    'A cozy small one-story cottage: cream walls (#f7e6cd), a rounded coral-red tiled roof (#e07f63), ' +
      'a round-top wooden front door in the middle of the front wall, two round windows with wooden frames, ' +
      'a small brick chimney, and flower boxes under the windows. Simple chunky shapes.',
  ),

  [MODELS.buildings.barn]: facade(
    'A small cute red barn (#d65f4f) with white trim, a big double door in the middle of the front wall, a hay loft window above, ' +
      'a rounded dark-brown roof, and a little bit of hay peeking out. Simple chunky shapes.',
  ),
  /* 시장 가게. 글자는 넣지 않는다 (AI 글씨는 깨진다 — 게임이 표지판을 따로 단다) */
  [MODELS.buildings.seedShop]: facade(
    'A small cute farm shop: a cozy wooden shop with mint-green walls (#8fd8c4), a green and cream striped awning ' +
      'over a wide open front counter, wooden crates of seed bags and small potted saplings on the counter, ' +
      'a rounded warm-brown roof, and a round wooden sign with a green sprout picture above the awning. No text. Simple chunky shapes.',
  ),
  [MODELS.buildings.furnitureShop]: facade(
    'A small cute furniture shop: a cozy cottage-style shop with warm peach walls (#f6b98a), a rounded lavender-blue roof (#8f9be0), ' +
      'a round-top wooden door in the middle of the front wall, a big display window on each side showing a tiny armchair and a lamp, ' +
      'and a round wooden sign with a little chair picture above the door. No text. Simple chunky shapes.',
  ),
  [MODELS.buildings.trough]: item(
    'A long low wooden feeding trough on short legs, filled with golden hay and grains (#f6c453). Simple chunky shapes.',
  ),
  /* 목장 물통. 건초 여물통과 짝을 이루게 같은 나무 통 모양으로 */
  /* 꿀벌 양봉 통. 꿀벌은 코드로 그린다 (world/scenes/yard/apiary) */
  [MODELS.buildings.beehive]: item(
    'A cute wooden beehive box for a small farm: two stacked pale honey-yellow wooden boxes (#f2c14e) with a slightly overhanging soft white lid roof, ' +
      'a small slot entrance at the bottom front with a tiny landing board, standing on a short sturdy wooden stand, ' +
      'a little golden honey drip painted on one side. Simple chunky shapes, no bees.',
  ),
  [MODELS.buildings.waterTrough]: item(
    'A long low wooden water trough on short legs, the same chunky wooden style as a farm feeding trough, ' +
      'filled almost to the brim with clear light-blue water (#7cc6e8) with a few soft white highlights. Simple chunky shapes.',
  ),

  /* ---- 나무 (열매 없이) ---- */
  [MODELS.trees.apple]: tree('An apple tree: round crown of fresh green leaves (#6fbf6a), warm brown trunk (#a3714a).'),
  [MODELS.trees.orange]: tree('An orange tree: dense rounded crown of glossy dark-green leaves (#529c50), light brown trunk.'),
  [MODELS.trees.peach]: tree('A peach tree: soft rounded crown of light green leaves (#8ed486) with a slightly wider spreading shape, brown trunk.'),
  [MODELS.trees.cherry]: tree('A cherry tree: wide round crown of bright green leaves (#6fbf6a), reddish-brown trunk.'),
  // 아치 모양 덩굴 시렁은 가운데 가로대가 얇아 3D 변환에서 사라졌다 (기둥 둘만 남음).
  // 다른 나무처럼 기둥 하나 + 둥근 잎 덩어리로 그린다.
  [MODELS.trees.grape]: tree(
    'A grapevine trained like a small tree: a thick twisted brown vine trunk wrapped around one sturdy wooden post, ' +
      'with a big round canopy of broad grape leaves (#6fbf6a) on top.',
  ),
  [MODELS.trees.persimmon]: tree(
    'A persimmon tree: slightly taller oval crown of deep green leaves (#529c50) with a few warm orange-tinted leaves, dark brown trunk.',
  ),
  [MODELS.trees.banana]: realPlant(
    'A banana plant: one thick smooth upright pseudo-stem trunk made of wrapped leaf sheaths (light olive green #a8b86a with soft brown streaks), ' +
      'and at the top a crown of seven or eight very large long paddle-shaped bright green leaves (#6fbf6a) with a pale midrib, ' +
      'arching outward in every direction and drooping at the tips like a fountain. Taller than wide.',
  ),
  [MODELS.trees.tangerine]: tree(
    'A small mandarin tangerine tree: a compact very round dense crown of small glossy dark-green leaves (#4f9a4c), short sturdy light-brown trunk. Smaller and rounder than an orange tree.',
  ),
  // 키위는 덩굴이라 포도처럼 기둥 하나 + 넓은 잎 덩어리로 (시렁은 3D 변환에서 가로대가 사라진다)
  [MODELS.trees.kiwi]: tree(
    'A kiwi vine trained like a small tree: a thick twisting fuzzy brown vine trunk wrapped around one sturdy wooden post, ' +
      'with a wide slightly flat-topped canopy of large round heart-shaped green leaves (#6fae4f).',
  ),
  [MODELS.trees.blueberry]: realPlant(
    'A blueberry bush: a rounded shrub that is wider than tall, with several thin brown woody stems rising from one base and branching, ' +
      'densely covered with many small oval blue-green leaves (#5f9e55), a few leaf edges tinted soft red.',
  ),
  /* ---- 맵 가장자리 숲 (열매 없는 숲 나무) ---- */
  [MODELS.scenery.tree]: realPlant(
    'A big wild forest tree (not a fruit tree): a sturdy brown trunk and a large lush rounded crown made of several soft leafy clumps, ' +
      'rich natural greens (#4f8f4a with lighter #6fbf6a highlights). Full and dense, no fruits, no flowers.',
  ),
  [MODELS.scenery.pine]: realPlant(
    'A tall cone-shaped pine tree: a short brown trunk and layered tiers of dark green needle branches (#2f6b45) narrowing to a point. ' +
      'Chunky soft tiers, no snow, no cones.',
  ),
  [MODELS.scenery.bush]: realPlant(
    'A wide low round wild bush: a dense mound of small leafy clumps in fresh greens (#5f9e55 and #7cbf6a), wider than tall, no flowers, no berries.',
  ),
  /* ---- 마굿간 안 장식 ---- */
  [MODELS.barnProps.hayBale]: item(
    'A neat rectangular bale of golden straw hay (#e8c36a) tied with two brown twine bands around it, ' +
      'soft rounded chunky edges, the straw texture shown only by color streaks, a few short straw tufts. Simple chunky block shape.',
  ),
  [MODELS.barnProps.hayPile]: item(
    'A big soft rounded mound of loose golden hay (#e8c36a) like a small fluffy haystack, wide at the bottom, ' +
      'the straw shown by color streaks, a few short chunky tufts on top. Simple chunky rounded shape.',
  ),
  [MODELS.barnProps.toolRack]: furniture(
    'A simple wooden farm tool rack (#a3714a): a low wooden stand with a top rail, and three farm tools standing upright side by side ' +
      'with clear gaps between them, heads at the top: a garden hoe, a pitchfork with three thick blunt tines, and a shovel. ' +
      'Thick chunky wooden handles and grey metal heads. Flat back so it can stand against a wall.',
  ),
  [MODELS.barnProps.bucket]: item(
    'A small wooden bucket made of planks (#b57f4a) with two dark metal bands and a thick rope handle, filled with clear blue water.',
  ),
  [MODELS.barnProps.appleCrate]: item(
    'A sturdy wooden crate (#c49a6c) made of thick planks, filled with a heap of shiny red apples piled above the rim.',
  ),
  [MODELS.barnProps.wheelbarrow]: item(
    'A cute wooden wheelbarrow (#b57f4a) with one big thick wheel at the front, two sturdy handles at the back and two short legs, ' +
      'filled with a heap of golden hay (#e8c36a). Chunky sturdy parts.',
  ),
  [MODELS.barnProps.lantern]: wallItem(
    'An old-fashioned farm oil lantern hanging from a short dark iron wall bracket: a dark iron frame (#4a4a4a) with a round glass ' +
      'chimney and a warm glowing yellow flame inside (#ffd36b), a ring handle on top. Chunky simple shapes.',
  ),
  [MODELS.barnProps.milkCan]: item(
    'An old-fashioned tall metal milk churn, soft silver grey (#c8ccd2) with a rounded shoulder, a lid on top and two small side handles. ' +
      'Chunky and simple.',
  ),
  [MODELS.sprout]: item(
    'A tiny young seedling: a short thick green stem with two plump round leaves opening like a little V, no soil, no pot.',
  ),

  /* ---- 동물 ---- */
  [MODELS.animals.chicken]: animal(
    'A plump round white hen (#fdfaf2) with a small red comb and wattle (#e8524a), a short yellow beak (#f4b942), tiny orange legs.',
  ),
  [MODELS.animals.goat]: animal(
    'A small light-brown goat (#c08a52) with a cream belly, two short backward-curving horns, a little beard, and a short tail. ' +
      'Clearly a goat, not a sheep.',
  ),
  [MODELS.animals.sheep]: animal(
    'A fluffy round sheep with thick puffy white wool (#fbf7ef) like a cloud, a soft beige face and legs (#d8b79b), small ears.',
  ),
  [MODELS.animals.cow]: animal(
    'A friendly dairy cow, white (#fdfbf6) with a few big dark-brown spots (#5c5148), a pink nose and udder (#f4b1ae), ' +
      'short rounded horns and a small bell on a collar.',
  ),

  /* ---- 가구 (집) ---- */
  [furnitureModelKey('bed_basic')]: furniture(
    'A single wooden bed (#c08a52) with a tall rounded headboard at the back, a fluffy white pillow and a soft cream blanket.',
  ),
  [furnitureModelKey('desk_basic')]: furniture(
    'A small wooden study desk (#c08a52) with one drawer and four sturdy legs, a closed book and a pencil cup on top.',
  ),
  [furnitureModelKey('chair_basic')]: furniture('A small wooden chair (#b57f4a) with a rounded backrest and four sturdy legs.'),
  [furnitureModelKey('table_basic')]: furniture(
    'A round wooden table (#c9955f) on one thick central leg with a round foot, a small vase with a flower on top.',
  ),
  [furnitureModelKey('drawer_basic')]: furniture(
    'A wooden chest of drawers (#b8834f) with three drawers and round knobs, short legs.',
  ),
  [furnitureModelKey('sofa_cozy')]: furniture(
    'A puffy two-seat sofa in soft coral pink (#f0a6a0) with thick rounded arms and two plump seat cushions.',
  ),
  [furnitureModelKey('cushion_cozy')]: furniture('A big round fluffy floor cushion in sunny yellow (#f6c453) with a button in the middle.'),
  [furnitureModelKey('carpet_cozy')]: flatItem(
    'A soft rectangular rug in warm coral (#e8998f) with a cream border and a simple heart pattern in the middle.',
  ),
  [furnitureModelKey('lamp_cozy')]: furniture(
    'A floor lamp with a warm pale-yellow (#f6d78a) rounded lampshade on a straight thick wooden pole and a round base.',
  ),
  [furnitureModelKey('bookshelf_nature')]: furniture(
    'A tall wooden bookshelf painted soft leaf green (#8aa86a) with three shelves full of chunky colorful books and a tiny plant on top.',
  ),
  [furnitureModelKey('plant_nature')]: furniture(
    'A big leafy green houseplant (#6fbf6a) with broad round leaves in a round terracotta pot.',
  ),
  [furnitureModelKey('frame_nature')]: wallItem(
    'A wooden picture frame (#a3714a) holding a simple painting of green hills and a round tree under a blue sky.',
  ),
  [furnitureModelKey('doll_colorful')]: furniture(
    'A cute sitting plush bunny doll in soft pink (#f6a8bd) with long floppy ears folded down against its head and a little bow.',
  ),
  [furnitureModelKey('clock_colorful')]: wallItem(
    'A round wall clock with a sky-blue (#7fb8e6) rim, a cream face with simple dots instead of numbers, and two hands.',
  ),
  [furnitureModelKey('carpet_colorful')]: flatItem(
    'A soft rectangular rug in mint green (#8fd8c4) with colorful rainbow stripes and a scalloped border.',
  ),
  [furnitureModelKey('bed_starlight')]: furniture(
    'A dreamy single bed in lavender (#b8a0e0) with a rounded headboard decorated with little gold stars, ' +
      'a white pillow and a starry dark-blue blanket.',
  ),
  [furnitureModelKey('lamp_starlight')]: furniture(
    'A floor lamp shaped like a tall stand with a glowing lavender (#cbb6ef) star-shaped lampshade on top and a round base.',
  ),

  /* ---- 장식 (마당) ---- */
  [furnitureModelKey('fence_wood')]: furniture('One short section of a wooden picket fence (#c08a52): three rounded pickets on two rails.'),
  [furnitureModelKey('flower_bed')]: furniture(
    'A small low oval flower bed edged with round stones, full of pink (#f6a8bd), yellow and white flowers.',
  ),
  [furnitureModelKey('flower_bed_long')]: furniture(
    'A long low rectangular flower bed, about three times as wide as it is deep, running left to right, ' +
      'edged with a neat row of round stones, full of pink (#f6a8bd), yellow and white flowers with green leaves. Same style as a round flower bed.',
  ),
  [furnitureModelKey('bench_wood')]: furniture('A wooden garden bench (#b57f4a) with a backrest and thick rounded legs.'),
  [furnitureModelKey('stonepath')]: flatItem('Three flat round stepping stones (#cfc6b4) in a short row, lying flat.'),
  [furnitureModelKey('streetlamp')]: furniture(
    'An old-fashioned street lamp: a straight dark brown (#6a5445) post with a round base and a warm glowing lantern on top.',
  ),
  [furnitureModelKey('fountain')]: furniture(
    'A small round stone garden fountain with two tiers, light blue water (#9ed4ea) in the basins and a water spout on top.',
  ),

  /* ---- 2026-11 추가: 집 안 ---- */
  [furnitureModelKey('beanbag')]: furniture(
    'A big squishy round beanbag chair in sunny yellow (#f6c453), slumped into a comfy seat shape with a soft dent in the middle.',
  ),
  [furnitureModelKey('rocking_chair')]: furniture(
    'A wooden rocking chair (#b57f4a) with two thick curved rockers on the floor, a tall slatted backrest, armrests and a small red checkered seat cushion.',
  ),
  [furnitureModelKey('toy_box')]: furniture(
    'A chunky sky-blue (#7fb8e6) wooden toy chest with a rounded lid slightly open, a red ball, a yellow toy block and a teddy ear peeking out over the edge.',
  ),
  [furnitureModelKey('cactus_pot')]: furniture(
    'A cute round green cactus (#7cbf6a) with two short rounded arms and one small pink flower on top, in a round white pot with a terracotta band.',
  ),
  [furnitureModelKey('big_bear')]: furniture(
    'A big sitting plush teddy bear in light caramel brown (#c99a6a) with round ears, a cream muzzle and tummy, and a red bow tie, legs stretched forward.',
  ),
  [furnitureModelKey('fish_tank')]: furniture(
    'A small rounded rectangular fish tank on a short wooden stand: thick light-blue tinted glass (#8fd3e8) filled with blue water, ' +
      'two orange goldfish, green water plants and pebbles at the bottom, a wooden lid on top. The glass is clearly blue, not clear.',
  ),
  [furnitureModelKey('piano')]: furniture(
    'A small cute upright piano in deep plum purple (#5a4a6a) with rounded corners, white and black keys at the front, ' +
      'a small bench in front of it and a little music book on the stand.',
  ),
  [furnitureModelKey('chalkboard')]: wallItem(
    'A rectangular green chalkboard (#3f6b55) in a light wooden frame with a small ledge at the bottom holding chalk and an eraser, ' +
      'a simple white chalk drawing of a sun and a flower on it.',
  ),

  /* ---- 2026-11 추가: 마당 (놀이터 · 정원 · 쉼터) ---- */
  // 정사각형 큰 모래 놀이터 (사용자 요청: 두 배 · 정사각형). 크기는 furniture3d 에서 가로 2.4m 로 맞춘다
  [furnitureModelKey('sandbox')]: item(
    'A big low SQUARE wooden sandbox (#c08a52), exactly as wide as it is deep, with a low thick wooden frame and small corner seats, ' +
      'filled with smooth pale sand (#e9cf8f), a red toy bucket, a yellow shovel and a small sand castle in it.',
  ),
  [furnitureModelKey('seesaw')]: furniture(
    'A playground seesaw seen from the side: one long thick yellow (#f6d24a) plank balanced on a short sturdy red pivot in the middle, ' +
      'a chunky round handle and a seat at each end. Simple solid shapes.',
  ),
  // 시안 4개 중 사용자가 고른 코끼리 미끄럼틀 (scripts/gen-drafts.ts 로 그린 B)
  [furnitureModelKey('slide')]: furniture(
    'A cute elephant-shaped playground slide: a big friendly light blue (#8fc8ea) elephant standing sideways, with chunky solid steps ' +
      'on its back side going up to the top of its head, and its long trunk curving down to the ground as a smooth wide slide. ' +
      'Big round ears, small smiling eyes. Simple solid shapes, no thin parts.',
  ),
  [furnitureModelKey('merry_go_round')]: furniture(
    'A playground merry-go-round: a wide low round mint-green (#8fd8c4) spinning platform with colorful segments, ' +
      'a thick central post and four chunky curved handle loops. Solid thick shapes.',
  ),
  [furnitureModelKey('birdhouse')]: furniture(
    'A cute little orange (#f2a65a) wooden birdhouse with a red pointed roof, a round hole and a small perch, on top of one straight wooden post.',
  ),
  // 처음 것은 소매 끝 짚 다발 때문에 3D 변환에서 팔이 앞뒤로 두 겹씩(4겹) 생겼다.
  // 비스듬히 본 그림 + 짚 다발 없는 단순한 소매 끝(둥근 장갑)으로 다시 그린다
  [furnitureModelKey('scarecrow')]: item(
    'A friendly farm scarecrow on one wooden post: a smiling burlap face, a wide straw hat (#e3bf68), ' +
      'a patched blue shirt. Exactly ONE pair of arms: two thick simple sleeves stretched straight out sideways, ' +
      'each ending in one plain round brown glove. No straw tufts on the sleeves, no extra arms. Chunky simple toy-like shapes.',
  ),
  [furnitureModelKey('mailbox')]: furniture(
    'A cute wooden mailbox with a rounded red top (#d65f4f), a small raised yellow flag on the side, on one thick wooden post.',
  ),
  [furnitureModelKey('tent')]: furniture(
    'A small triangular camping tent in mint green (#8fd8c4) with the front door flaps tied open, a little orange pennant flag on top, ' +
      'a cozy blanket and pillow visible inside.',
  ),

  /* ---- 열매 ---- */
  [MODELS.fruits.tangerine]: item(
    'One small round bright orange mandarin tangerine fruit (#f59a2a), slightly flattened, with a perfectly smooth rounded surface ' +
      '(peel texture only as subtle color, not bumps) and a tiny green stem nub on top. No leaves.',
  ),
  // 처음 문구('fuzzy brown ... oval')는 그림 생성기가 거절했다. 과일 이름과 색 위주로 쓴다
  [MODELS.fruits.kiwi]: item(
    'One whole kiwifruit, a small egg-shaped fruit with light brown skin (#9a7a4a) and a tiny dry tip at one end, ' +
      'a perfectly smooth simple surface, not cut open. No leaves. A cute fruit icon for a farming game.',
  ),
  [MODELS.fruits.orange]: item(
    'One round orange fruit (#f2953a) with a perfectly smooth rounded surface (peel texture only as subtle color, ' +
      'not as bumps), a short thick brown stem on top and one small, thick, plump green leaf lying close against the fruit.',
  ),
};
