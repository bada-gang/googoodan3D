/**
 * 모델 시안 그리기: 3D 로 바꾸기 전에 원본 그림 후보를 여러 장 그려 사용자에게 고르게 한다.
 * 고른 시안은 scripts/model-prompts.ts 의 프롬프트로 옮기고 npm run model -- --only 키 --force 로 다시 만든다.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/gen-drafts.ts <출력 폴더> <이름>=<설명> [<이름>=<설명> ...]
 *
 * 설명에는 "무엇"만 쓴다. 화풍 · 배경 문장(MODEL_CONCEPT_STYLE)은 여기서 붙인다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { findCodex, generateImageWithCodex } from './lib/codex';
import { MODEL_CONCEPT_STYLE } from './model-prompts';

async function main(): Promise<void> {
  const [outDir, ...pairs] = process.argv.slice(2);
  if (!outDir || pairs.length === 0) throw new Error('사용법: gen-drafts.ts <출력 폴더> <이름>=<설명> ...');
  mkdirSync(outDir, { recursive: true });
  const codex = findCodex();
  const drafts = pairs.map((pair) => {
    const at = pair.indexOf('=');
    return { name: pair.slice(0, at), description: pair.slice(at + 1) };
  });
  // 한꺼번에 그린다 (시안은 서로 상관없다)
  await Promise.all(
    drafts.map(async ({ name, description }) => {
      try {
        const result = await generateImageWithCodex(
          codex,
          { description: `${MODEL_CONCEPT_STYLE} ${description}`, aspect: 'square', transparent: false },
          path.join(outDir, `.work-${name}`),
        );
        writeFileSync(path.join(outDir, `${name}.png`), result.image);
        console.log(`완료 ${name}`);
      } catch (error) {
        console.error(`실패 ${name}: ${(error as Error).message}`);
      }
    }),
  );
}

void main();
