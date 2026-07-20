import { useEffect, useRef, useState } from "react";

interface ConfirmButtonProps {
  label: string;
  confirmLabel: string;
  disabled?: boolean;
  tone?: "accent" | "danger";
  /** true면 대기 상태에서도 primary(accent)로 강조한다 — 현재 단계의 주 액션일 때 사용. */
  emphasis?: boolean;
  onConfirm: () => void;
}

/** 파괴적·비가역 액션용 2단계 버튼: 첫 클릭은 확인 상태로 전환, 4초 내 재클릭 시 실행. */
export default function ConfirmButton({ label, confirmLabel, disabled, tone = "danger", emphasis = false, onConfirm }: ConfirmButtonProps) {
  const [arming, setArming] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  useEffect(() => { if (disabled) setArming(false); }, [disabled]);

  function click() {
    if (!arming) {
      setArming(true);
      timer.current = window.setTimeout(() => setArming(false), 4000);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    setArming(false);
    onConfirm();
  }

  return (
    <button
      className={arming ? `confirm-armed confirm-${tone}` : emphasis ? "" : "secondary"}
      disabled={disabled}
      aria-live="polite"
      onClick={click}
      onBlur={() => setArming(false)}
    >
      {arming ? confirmLabel : label}
    </button>
  );
}
