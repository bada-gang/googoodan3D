/**
 * 카메라: 캐릭터를 비스듬히 뒤쪽 위에서 따라간다.
 * fixed 를 주면 그 자리에 고정한다 (집 안: 방 전체가 한 화면에 들어오게).
 */
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { player } from '../state/runtime';

/** 캐릭터에서 카메라까지 (뒤쪽 위). 동물의 숲처럼 비스듬히 내려다본다 */
const CAMERA_OFFSET = new Vector3(0, 5.6, 7.6);
/** 캐릭터보다 조금 위를 본다 (머리가 화면 가운데쯤) */
const LOOK_OFFSET = new Vector3(0, 0.9, 0);
/** 카메라가 따라붙는 빠르기. 너무 빠르면 어지럽고 느리면 캐릭터가 화면 밖으로 나간다 */
const FOLLOW = 5;

/** 고정 카메라: 카메라 자리와 바라보는 점 */
export interface FixedView {
  position: [number, number, number];
  target: [number, number, number];
}

export function CameraRig({ fixed }: { fixed?: FixedView }): null {
  const camera = useThree((s) => s.camera);
  const look = useRef(new Vector3());
  const first = useRef(true);

  useFrame((_, rawDelta) => {
    if (fixed) {
      camera.position.set(...fixed.position);
      camera.lookAt(...fixed.target);
      return;
    }
    const dt = Math.min(rawDelta, 1 / 20);
    const desired = player.position.clone().add(CAMERA_OFFSET);
    const lookAt = player.position.clone().add(LOOK_OFFSET);
    if (first.current) {
      // 처음에는 바로 그 자리에. 날아오는 카메라는 시작부터 어지럽다
      camera.position.copy(desired);
      look.current.copy(lookAt);
      first.current = false;
    } else {
      const k = 1 - Math.exp(-FOLLOW * dt);
      camera.position.lerp(desired, k);
      look.current.lerp(lookAt, k);
    }
    camera.lookAt(look.current);
  });
  return null;
}
