/**
 * 이미지 생성 프롬프트. 키는 src/config/assets.ts 의 ASSET_MANIFEST 와 같아야 한다.
 * 빠지거나 남는 키가 있으면 생성 스크립트가 시작하지 않는다.
 *
 * 규칙은 ART_DIRECTION.md 6번. 프롬프트는 영어로 쓴다 (생성 품질이 더 안정적이다).
 * 각 항목에는 "무엇"만 쓰고, 화풍·빛·배경은 종류(kind)별 공통 문장이 붙인다.
 */
import { ASSETS } from '@/config/assets';
import type { AssetKind } from '@/config/assets';

/** 모든 그림에 붙는 화풍 문장. ART_DIRECTION 1, 4 */
export const STYLE =
  'Stylized 3D game art for a cozy farming game for young children. ' +
  'Soft rounded low-poly shapes with smooth bevelled edges, matte clay-like materials, ' +
  'bright warm pastel colors, soft key light from the upper left, gentle soft shading toward the lower right. ' +
  'Simple, clean, toy-like, charming but not babyish. ' +
  'Absolutely no text, letters, numbers, logos, labels or watermarks anywhere in the image.';

/** 종류별 공통 문장 */
export const KIND_PROMPT: Record<Exclude<AssetKind, 'thumbnail'>, (subject: string) => string> = {
  icon: (subject) =>
    `${STYLE} A single game item icon: ${subject}. ` +
    'Seen from slightly above in three-quarter view, centered, filling about 80% of the frame. ' +
    'Isolated object only: no ground, no floor, no cast shadow, no frame, no border.',
  particle: (subject) =>
    `${STYLE} A single small visual effect sprite: ${subject}. ` +
    'Centered, filling about 70% of the frame, simple flat-ish shape that reads clearly when tiny. ' +
    'Isolated, no ground, no shadow, no border.',
  texture: (subject) =>
    `${STYLE} A seamless tileable square texture, viewed straight from above: ${subject}. ` +
    'Perfectly even, flat lighting across the whole image: no directional shadows, no vignette, ' +
    'no darker corners, no single focal point. Low detail, soft hand-painted look, gentle color variation. ' +
    'The pattern must continue naturally across all four edges.',
  background: (subject) =>
    `${STYLE} A wide landscape scene: ${subject}. ` +
    'Bright daytime, soft clouds, slight depth haze toward the horizon.',
};

/**
 * 생성 후 색 보정. 다시 생성하지 않고 후처리(--reprocess)만으로 바뀐다.
 * saturation / brightness 는 1 이 그대로.
 */
export const ART_ADJUST: Record<string, { saturation?: number; brightness?: number }> = {
  // 생성된 잔디가 팔레트(#a8d66f)보다 쨍하다
  [ASSETS.textures.grass]: { saturation: 0.82 },
};

/** 키별 "무엇" */
export const ART_PROMPTS: Record<string, string> = {
  /* ---- 이름 목록 아바타: 동물 얼굴 ---- */
  [ASSETS.avatars.rabbit]: 'the head of a cute cream-white rabbit with long upright ears and pink inner ears, front view, friendly smile',
  [ASSETS.avatars.bear]: 'the head of a cute light-brown teddy bear with round ears, front view, friendly smile',
  [ASSETS.avatars.cat]: 'the head of a cute orange tabby cat with pointed ears, front view, friendly smile',
  [ASSETS.avatars.fox]: 'the head of a cute orange fox with a white muzzle and pointed ears, front view, friendly smile',
  [ASSETS.avatars.bird]: 'the head of a cute round sky-blue bird with a small yellow beak, front view, friendly',
  [ASSETS.avatars.frog]: 'the head of a cute bright-green frog with big round eyes on top, front view, wide friendly smile',

  /* ---- 수확물 ---- */
  [ASSETS.crops.apple]: 'one glossy red apple (#e8524a) with a short brown stem and one small green leaf',
  [ASSETS.crops.orange]: 'one round orange fruit (#f2953a) with dimpled peel and a small green leaf',
  [ASSETS.crops.peach]: 'one soft pink peach (#f7a3a0) with a blush of red and one green leaf',
  [ASSETS.crops.cherry]: 'a pair of shiny dark-red cherries (#d1385c) joined by green stems with one leaf',
  [ASSETS.crops.grape]: 'one bunch of purple grapes (#8f6fc4) with a short vine stem and one green leaf',
  [ASSETS.crops.persimmon]: 'one orange persimmon fruit (#ea8034), slightly flattened, with a green four-petal calyx on top',
  [ASSETS.crops.banana]: 'one hand of three plump curved yellow bananas (#f6d24a) joined at a short green stem, with small brown tips',
  [ASSETS.crops.blueberry]: 'a small cluster of five round dusty-blue blueberries (#4f6fc4) with tiny star-shaped crowns, on a short twig with one small green leaf',
  [ASSETS.crops.egg]: 'one smooth cream-white chicken egg standing upright',
  [ASSETS.crops.goatMilk]: 'a small round clay jug of goat milk with a light-brown body and a cream rim, with a little rope tied around the neck',
  [ASSETS.crops.wool]: 'a fluffy bundle of soft white sheep wool, like a cloud, tied with a pink ribbon',
  [ASSETS.crops.milk]: 'a glass bottle of fresh white milk with a sky-blue cap',

  /* ---- 물고기: 옆모습, 머리가 왼쪽 ---- */
  [ASSETS.crops.minnow]: 'one tiny slender silver-gray minnow fish (#b9c9d6) with a pale belly and big round eye, side view, head pointing left',
  [ASSETS.crops.loach]: 'one long slim wiggly olive-brown pond loach fish (#a08a5c) with small speckles and tiny whiskers around the mouth, side view, head pointing left',
  [ASSETS.crops.crucian]: 'one round chubby golden-olive crucian carp fish (#b8a36a) with a tall back and soft fins, side view, head pointing left',
  [ASSETS.crops.catfish]: 'one smooth dark gray-brown catfish (#6f6a5e) with a wide flat head and long whiskers, side view, head pointing left',
  [ASSETS.crops.trout]: 'one rainbow trout fish with a silver body, a soft pink-red stripe along its side (#e59a9a) and small dark spots, side view, head pointing left',
  [ASSETS.crops.carp]: 'one big plump Japanese nishikigoi koi carp fish with a glossy pearly white body covered in bold bright orange-red patches (#e8743b) and a few small black patches, large shiny scales, long flowing graceful fins and tail, two short whiskers, side view, head pointing left',
  [ASSETS.crops.goldfish]: 'one bright orange goldfish (#f08a3c) with a round body and a long flowing double tail fin, side view, head pointing left',
  [ASSETS.crops.mackerel]: 'one sleek mackerel fish with a shiny blue-green back with dark wavy stripes (#5f8fae) and a bright silver belly, a forked tail, side view, head pointing left',
  [ASSETS.crops.squid]: 'one cute pale pink-cream squid (#f0c9b8) seen from the side at a slight diagonal, head pointing up-right: a slender tall torpedo-shaped mantle (much longer than wide) with two small triangular fins at its pointed tip, big round friendly eyes near the bottom of the mantle. From under the eyes the arms flow down-left, spread out like an open fan with a clear gap between every arm: EXACTLY TEN in total, eight shorter tapered arms and two clearly longer thin tentacles ending in small diamond-shaped club tips. No arm overlaps or hides behind another, so a child can count exactly 10',
  [ASSETS.crops.eel]: 'one long smooth wavy eel with a dark blue-teal body (#3f6f8a) and a pale yellow belly, a cheeky wide-eyed grinning face, curved in a lively S shape, with a few small bright yellow cartoon lightning-bolt sparks and tiny electric zigzags crackling around its body as if it gives a tingly electric zap, side view, head pointing left',
  [ASSETS.crops.octopus]: 'one cute round reddish-orange octopus (#d9775f) with a big soft head, friendly eyes and EXACTLY EIGHT curly tentacles with small pale suction cups, front view, perfectly left-right symmetrical: EXACTLY FOUR tentacles on the left half and EXACTLY FOUR on the right half, eight in total, fanned out evenly around the lower body with clear gaps between them, none overlap or hide behind another, so a child can count exactly 8',
  [ASSETS.crops.treasureMap]: 'one old rolled-open parchment treasure map (#d9b77a) with slightly torn edges, a dotted path and a big red X mark, tied with a small brown string, a few water drops on it',
  [ASSETS.crops.bottle]: 'one small clear sea-green glass bottle (#9fd3c7) with a cork, a rolled paper letter tied with a red string inside it',
  [ASSETS.crops.pearl]: 'one huge giant clam shell, open, with a thick wavy pink-and-cream rim (#f3d9e2), holding one very big shiny round white pearl inside, with a soft glow and sparkles',
  [ASSETS.crops.crown]: 'one magnificent golden crown of the Dragon King of the sea from Korean folk tales: a gold crown with a small coiled friendly dragon on the front, decorated with sea-blue jade, pink coral and white pearls, with a soft golden glow and a few sparkles',
  [ASSETS.crops.salmon]: 'one big majestic legendary salmon fish with silver-pink scales and a coral-orange belly (#f2785a), a soft golden glow and a few small sparkles around it, leaping in a gentle arc, side view, head pointing left',
  // 2026-11 추가: 물고기 8 + 보물 4
  [ASSETS.crops.paleChub]: 'one small slender Korean pale chub fish (Zacco platypus, pirami) with a shiny silver body, several soft vertical pastel blue-green and pink bands on its sides (#9cc7c0), a big round eye and a slightly long lower fin, side view, head pointing left',
  [ASSETS.crops.crab]: 'one cute orange-red Korean swimming crab (kkotge, #e0674a) seen from the front and slightly above: a wide flat shell with a sharp point on each side, friendly eyes on short stalks, two big claws raised up happily, perfectly left-right symmetrical with EXACTLY FOUR legs on the left side and EXACTLY FOUR legs on the right side, the last pair of legs flat like small paddles, clear gaps between all legs so a child can count them',
  [ASSETS.crops.hairtail]: 'one very long thin ribbon-like cutlassfish (hairtail fish) with a shiny bright metallic silver body (#d7dde6), no tail fin: the body tapers into a long thin pointed thread, a long low fin running along its whole back, a big round eye and a cheeky grin with tiny sharp teeth, curved in a gentle wave, side view, head pointing left',
  [ASSETS.crops.pufferfish]: 'one cute pufferfish fully puffed up into a round ball (#efd98c): cream-yellow body with a few brown spots on its back, many small soft rounded spikes all over, tiny fins, a small pouty mouth and big round surprised eyes, side view, head pointing left',
  [ASSETS.crops.flounder]: 'one flat oval flounder fish (#b8996f) seen from above lying flat: sandy brown with soft darker speckles, BOTH round eyes close together on the same side of its head, a frilly fin running all around the edge of its body, a small fan-shaped tail, head pointing left',
  [ASSETS.crops.stingray]: 'one cute stingray (#8fa9bd) seen from above: a wide flat diamond-shaped body like a kite with soft wavy wing-like fins, pale blue-gray with a lighter edge, two small friendly eyes on top, a long thin whip-like tail',
  [ASSETS.crops.tuna]: 'one big powerful bluefin tuna fish with a dark navy-blue back (#355c8a) and a shiny silver belly, a thick torpedo-shaped body, a row of small yellow finlets near the tail, a stiff crescent-moon-shaped tail fin, side view, head pointing left',
  [ASSETS.crops.sturgeon]: 'one big long ancient-looking sturgeon fish (#7f8c8e): a long pointed shovel-like snout with four small whiskers underneath, rows of bony diamond-shaped plates along its gray back and sides, a shark-like tail with a longer upper lobe, side view, head pointing left',
  [ASSETS.crops.rubberDuck]: 'one classic bright yellow rubber duck bath toy (#f6d24a) with an orange beak and small black eyes, shiny and wet with a few water drops on it, side view, facing left',
  [ASSETS.crops.baleen]: 'one handful of blue whale baleen: a bundle of five long gently curved flat baleen plates with fine hair-like fringes at their tips, tied together in the middle with a thin rope, shimmering sky-blue and pearly silver (#bfe3f2) with a soft magical glow and a few sparkles around it',
  [ASSETS.crops.coinPouch]: 'one plump brown leather coin pouch of a pirate king, tied with a red cord, its top open and overflowing with shiny gold coins (#f6c453) and one small red gem, a little gold anchor charm hanging from the cord, a soft golden shine',
  [ASSETS.crops.mermaidComb]: 'one magical hair comb of a mermaid princess: a handle shaped like a pearly pink scallop seashell (#f4b8d0) decorated with small white pearls and a tiny aqua starfish, with neat fine comb teeth, a soft pink-and-aqua magical glow and a few sparkles',

  /* ---- 씨앗 봉투: 글자 대신 열매 그림 ---- */
  [ASSETS.seeds.apple]: 'a small kraft-paper seed packet, folded at the top, with a picture of a red apple printed on the front',
  [ASSETS.seeds.orange]: 'a small kraft-paper seed packet, folded at the top, with a picture of an orange fruit printed on the front',
  [ASSETS.seeds.peach]: 'a small kraft-paper seed packet, folded at the top, with a picture of a pink peach printed on the front',
  [ASSETS.seeds.cherry]: 'a small kraft-paper seed packet, folded at the top, with a picture of two red cherries printed on the front',
  [ASSETS.seeds.grape]: 'a small kraft-paper seed packet, folded at the top, with a picture of a bunch of purple grapes printed on the front',
  [ASSETS.seeds.persimmon]: 'a small kraft-paper seed packet, folded at the top, with a picture of an orange persimmon printed on the front',
  [ASSETS.seeds.banana]: 'a small kraft-paper seed packet, folded at the top, with a picture of a bunch of yellow bananas printed on the front',
  [ASSETS.seeds.blueberry]: 'a small kraft-paper seed packet, folded at the top, with a picture of a cluster of blue blueberries printed on the front',

  /* ---- UI ---- */
  [ASSETS.ui.coin]: 'one thick shiny gold coin (#f6c453) with a simple embossed star in the middle, tilted slightly',
  [ASSETS.ui.star]: 'one chunky puffy gold star (#f6c453) with rounded points',
  [ASSETS.ui.basket]: 'a small woven wicker basket with a handle, light wood color, empty',
  [ASSETS.ui.waterCan]: 'a small sky-blue (#7fb8e6) watering can with a long spout',
  [ASSETS.ui.feedBag]: 'a small burlap sack of animal feed, tied at the top, with a few golden grains spilling out',
  [ASSETS.ui.chest]: 'a closed wooden treasure chest with rounded lid, gold trim and a gold clasp',
  [ASSETS.ui.chestOpen]: 'an open wooden treasure chest with gold trim, soft golden glow and small sparkles rising from inside',

  /* ---- 질감 ---- */
  [ASSETS.textures.grass]: 'short soft lawn grass, fresh light green (#a8d66f) with slightly lighter and darker green tufts',
  [ASSETS.textures.soil]: 'tilled farm soil, warm brown (#a9764c) with soft furrows and tiny pebbles',
  [ASSETS.textures.path]: 'a packed sandy dirt path, pale beige (#e3cfa4) with a few small smooth pebbles',
  [ASSETS.textures.wall]: 'plain interior wallpaper, almost pure white (#f6f6f6) with an extremely faint paper grain',
  [ASSETS.textures.wallStar]: 'interior wallpaper, almost pure white (#f6f6f6) background with a scattered pattern of small light-gray five-pointed stars',
  [ASSETS.textures.floor]: 'light wooden floor planks running horizontally, very pale near-white wood (#f2f2f2) with faint light-gray grain lines',
  [ASSETS.textures.floorCheck]: 'floor tiles in a checkerboard pattern of near-white (#f6f6f6) and light gray (#d8d8d8) squares, 4 by 4 squares',
  [ASSETS.textures.water]:
    'clear stylized pond water surface like the water in a cozy toy fountain: bright clear turquoise (#4fc3e0) with soft lighter cyan wavy ripple highlights and gentle rounded caustic light patterns, a few tiny white sparkles',
  [ASSETS.textures.floorCarpet]: 'a soft woven carpet, near-white (#f4f4f4) with a subtle light-gray diamond weave pattern',

  /* ---- 배경 ---- */
  [ASSETS.environment.title]:
    'a cozy little farm village seen from a slightly elevated angle: a small cream house with a coral-red roof on the left, ' +
    'a row of round fruit trees, a fenced pen with chickens and fluffy sheep on the right, rolling green hills behind, ' +
    'blue sky. Keep the center of the image calm and open (a menu panel will cover the center)',

  /* ---- 연출 ---- */
  [ASSETS.particles.star]: 'one small glowing golden yellow star',
  [ASSETS.particles.sparkle]: 'one four-pointed white and pale-gold twinkle sparkle',
};
