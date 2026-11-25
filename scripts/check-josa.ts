/**
 * 조사 점검 (개발용): 게임에 나오는 이름마다 실제로 보일 문장을 찍어 본다.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/check-josa.ts
 */
import { ANIMAL_LIST, FURNITURE, SUPPLY_LIST, TREE_LIST, WALLPAPERS } from '@/config/catalog';
import { FISH_ORDER, caughtMessage } from '@/config/fishing';
import { josa, particle } from '@/config/josa';

const line = (...parts: string[]) => console.log('  ' + parts.join('   '));

console.log('동물');
for (const a of ANIMAL_LIST)
  line(`${josa(a.name, '이/가')} 우리에 왔어요!`, `${josa(a.name, '을/를')} 데려와 볼까요?`, `${josa(a.name, '은/는')} 2마리까지`, `${josa(a.produceName, '이/가')} 준비됐어요!`, `${josa(a.produceName, '을/를')} 받아 볼까요?`);
console.log('나무');
for (const t of TREE_LIST)
  line(`${josa(t.seedName, '을/를')} 심어 볼까요?`, `${josa(t.name, '을/를')} 키워 볼까요?`, `${josa(t.fruitName, '을/를')} 따 볼까요?`, `${josa(t.name, '이/가')} 열매를 다 맺었어요`);
console.log('가게 물건 · 가구 · 벽지');
for (const s of SUPPLY_LIST) line(`${josa(s.packName, '을/를')} 샀어요`);
line(...FURNITURE.map((f) => josa(f.name, '을/를')));
line(...WALLPAPERS.map((w) => josa(w.name, '을/를')));
console.log('낚시');
for (const id of FISH_ORDER) line(caughtMessage(id));
console.log('레벨 · 숫자');
line(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20].map((n) => `레벨 ${josa(String(n), '이/가')}`));
line(...['12', '7 … 3', '10', '6', '24'].map((a) => `${a}${particle(a, '이에요/예요')}`));
