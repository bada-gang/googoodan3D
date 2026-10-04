/**
 * 나무 표지판. 글자는 캔버스에 그려 질감으로 붙인다.
 *
 * 3D 글자(troika)는 한글 글꼴 파일을 따로 받아야 해서 무겁다. 캔버스는 페이지에 이미 있는
 * Jua 글꼴을 그대로 쓰고, 표지판 수가 적어 부담이 없다.
 */
import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { PALETTE } from '@/config/artTokens';

const FONT = '"Jua", "Noto Sans KR", sans-serif';

function useTextTexture(text: string, width: number, height: number): CanvasTexture | null {
  // 글꼴이 늦게 오면 기본 글꼴로 그려진 채 남는다. 글꼴을 기다렸다가 그린다.
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts
      .load(`64px ${FONT}`, text)
      .catch(() => undefined)
      .finally(() => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, [text]);

  const texture = useMemo(() => {
    if (!fontReady) return null;
    const scale = 128; // 1m 당 픽셀
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 바탕부터 판 나무색으로 채운다. 둥근 모서리 바깥을 투명하게 두면 3D 에서 검게 칠해진다.
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 크림색 판 + 나무 테두리 (2D 판 표지판과 같은 모양)
    const r = canvas.height * 0.22;
    ctx.fillStyle = PALETTE.woodLight;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, r);
    ctx.fill();
    ctx.fillStyle = PALETTE.cream;
    ctx.beginPath();
    const inset = canvas.height * 0.09;
    ctx.roundRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2, r * 0.7);
    ctx.fill();

    let size = canvas.height * 0.52;
    ctx.font = `${size}px ${FONT}`;
    const maxWidth = canvas.width - inset * 4;
    const measured = ctx.measureText(text).width;
    if (measured > maxWidth) {
      size *= maxWidth / measured;
      ctx.font = `${size}px ${FONT}`;
    }
    ctx.fillStyle = PALETTE.outline;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + size * 0.05);

    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [fontReady, text, width, height]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/** 기둥 하나에 판이 달린 표지판. 원점은 기둥 밑 */
export function SignBoard({
  text,
  width = 1.8,
  height = 0.62,
  postHeight = 1.5,
}: {
  text: string;
  width?: number;
  height?: number;
  postHeight?: number;
}): React.ReactElement {
  const texture = useTextTexture(text, width, height);
  return (
    <group>
      <mesh position-y={postHeight / 2} castShadow>
        <boxGeometry args={[0.16, postHeight, 0.16]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.9} />
      </mesh>
      <mesh position={[0, postHeight + height / 2 - 0.1, 0.09]} castShadow>
        <boxGeometry args={[width, height, 0.08]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
      </mesh>
      {texture && (
        <mesh position={[0, postHeight + height / 2 - 0.1, 0.135]}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial map={texture} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}
