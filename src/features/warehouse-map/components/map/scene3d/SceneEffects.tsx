"use client";

import { EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Hậu kỳ của cảnh: bóng góc (ambient occlusion, N8AO) làm tối khe giữa pallet và beam, chân cột, đáy thùng —
 * thứ khiến cảnh hết trông như đồ chơi. Chỉ chạy khi cảnh vẽ lại (`frameloop="demand"`), nửa độ phân giải.
 * Qua composer, tone mapping của renderer không còn áp → bật lại bằng hiệu ứng Neutral (cùng loại renderer dùng).
 */
export function SceneEffects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.6} distanceFalloff={0.7} intensity={2.2} halfRes quality="medium" />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}
