/**
 * 레어템 그림: 뒤에서 금빛이 숨 쉬듯 빛나고, 작은 별이 번갈아 반짝인다.
 * big(잡은 카드)일 때만 빛줄기가 천천히 돈다 — 작은 칸이 여럿 모인 도감에서 모두 돌면 어지럽다.
 * 효과는 styles/index.css 의 rare-* (반복은 2.4초 이상, ART_DIRECTION 8).
 */

/** 별 자리 (그림 크기 대비 %) · 크기 · 시작 시각 */
const SPARKS = [
  { left: '4%', top: '10%', size: 0.16, delay: 0 },
  { left: '82%', top: '4%', size: 0.12, delay: 0.8 },
  { left: '88%', top: '70%', size: 0.14, delay: 1.6 },
  { left: '6%', top: '76%', size: 0.1, delay: 1.2 },
];

export function RareIcon({
  src,
  size,
  alt = '',
  big = false,
}: {
  src: string;
  size: number;
  alt?: string;
  big?: boolean;
}): React.ReactElement {
  return (
    <span className="rare-frame" style={{ width: size, height: size }}>
      {big && <span aria-hidden className="rare-rays" />}
      <span aria-hidden className="rare-halo" />
      {/* ui.tsx 의 Icon 과 같은 모양. ui.tsx 가 이 파일을 쓰므로 거꾸로 가져오지 않는다 */}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        className="rare-img select-none object-contain"
        style={{ width: size, height: size }}
      />
      {SPARKS.map((spark, index) => (
        <span
          key={index}
          aria-hidden
          className="rare-spark"
          style={{
            left: spark.left,
            top: spark.top,
            width: size * spark.size,
            height: size * spark.size,
            animationDelay: `${spark.delay}s`,
          }}
        />
      ))}
    </span>
  );
}