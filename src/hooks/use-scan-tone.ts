import { SCAN_LIMITS } from "@/constants";
import { useAppStore } from "@/lib/store/use-app-store";

/** Tần số (Hz) + thời lượng (ms) tiếng báo: đúng = một tiếng cao ngắn, sai = tiếng trầm dài. */
const TONES = {
  positive: { frequency: 1046, durationMs: 90 },
  danger: { frequency: 220, durationMs: 320 },
} as const;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const legacy: unknown = Reflect.get(window, "webkitAudioContext");
  return (
    window.AudioContext ?? (typeof legacy === "function" ? (legacy as AudioContextCtor) : undefined)
  );
}

/** Một AudioContext cho cả app (tạo lại mỗi lần vào màn quét sẽ rò rỉ context đang chạy). */
let sharedContext: AudioContext | null = null;
/** Tiếng chờ phát khi context đang "suspended" — chỉ giữ tiếng mới nhất, một lần resume duy nhất. */
let pendingTone: keyof typeof TONES | null = null;

/** Tạo context (nếu chưa có) — undefined khi môi trường không có Web Audio. */
function ensureContext(): AudioContext | undefined {
  const Ctor = audioContextCtor();
  if (!Ctor) return undefined;
  sharedContext ??= new Ctor();
  return sharedContext;
}

/**
 * Gọi ĐỒNG BỘ trong thao tác của người dùng (Enter của máy quét): Safari / iOS chỉ cho tạo / mở
 * AudioContext trong lúc có cử chỉ người dùng. Tiếng báo phát sau `await` (kết quả quét) sẽ bị chặn
 * nếu context chưa được mở ở đây.
 */
export function primeScanAudio(): void {
  try {
    const ctx = ensureContext();
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
  } catch {
    /* Không có âm thanh — phản hồi màu + chữ vẫn còn */
  }
}

/**
 * Tiếng báo khi quét (mode-a-backoffice §4.3: phản hồi bằng âm thanh / màu) — người bốc kiện không
 * nhìn màn hình vẫn biết đúng / sai. Đọc cờ `muted` của app store lúc phát (chưa có nút tắt tiếng
 * trên UI — có thì bật cờ đó); trình duyệt chặn âm thanh / không có Web Audio thì im lặng.
 */
export function useScanTone() {
  return (tone: keyof typeof TONES) => {
    if (useAppStore.getState().muted) return;
    try {
      const ctx = ensureContext();
      if (!ctx) return;
      const play = (next: keyof typeof TONES) => {
        const { frequency, durationMs } = TONES[next];
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const end = ctx.currentTime + durationMs / 1000;
        oscillator.frequency.value = frequency;
        // Tắt dần thay vì cắt ngang → không nghe tiếng "tách" cuối mỗi bíp
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, end);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start();
        oscillator.stop(end);
      };
      // Tạo ngoài thao tác người dùng (sau await) → Safari / iOS để "suspended": chỉ phát sau khi
      // resume xong. Quét dồn trong lúc chờ → chỉ phát tiếng mới nhất (không dồn nhiều tiếng cùng
      // lúc); trình duyệt từ chối thì im lặng
      if (ctx.state === "running") {
        play(tone);
        return;
      }
      const waiting = pendingTone !== null;
      pendingTone = tone;
      if (waiting) return;
      // resume() có thể treo mãi (không có cử chỉ người dùng) → quá hạn thì bỏ tiếng đang chờ, lần
      // quét sau thử lại; không thì mọi tiếng sau bị nuốt vì `waiting` kẹt true
      const giveUp = setTimeout(() => {
        pendingTone = null;
      }, SCAN_LIMITS.audioResumeTimeoutMs);
      ctx.resume().then(
        () => {
          clearTimeout(giveUp);
          if (pendingTone) play(pendingTone);
          pendingTone = null;
        },
        () => {
          clearTimeout(giveUp);
          pendingTone = null;
        },
      );
    } catch {
      /* Không phát được âm thanh — phản hồi màu + chữ vẫn còn */
    }
  };
}
