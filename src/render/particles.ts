/**
 * render/particles — 앰비언트 파티클 시스템(사전할당 객체 풀, m2-render-plan §5·V2 스펙).
 *  부팅 시 MAX_PARTICLES개를 1회 사전할당. 스폰=비활성 슬롯 재설정, 소멸=active=false(객체 버리지 않음)
 *  → 프레임당 추가 힙 할당 0(tech §6.1). 형태별 draw(원=arc+fill, 아크=arc+stroke).
 *
 *  L1 circle: 브라운 운동 중밀도 페이드소멸. L6 arc: 간섭 파면 저밀도, 위상 전환 시 재생성.
 *  속도 ∝ rateCLog10(로그 압축 1~2배) — Decimal 미접근(snapshot이 number로 제공, §5.5).
 *  reduced-motion이면 운동 정지(위치 고정, 알파만 유지).
 */
import type { ParticlesConfig } from './layer-visuals';
import { rgba, type RGB } from './color';

/** 풀 상한(§8). L1 중밀도 ≈48, L6 ≈14 → 여유. */
export const MAX_PARTICLES = 128;

/** 모든 필드 number/boolean 고정(V8 hidden class 안정 — 객체 형태 불변). */
interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number; // circle=반경, arc=호 반경
  age: number;
  life: number;
  /** arc 전용: 시작 각도·호 길이(rad). circle은 미사용. */
  arcStart: number;
  arcLen: number;
  /** 페이드 위상 안정용 시드(무작위 위상 오프셋). */
  seed: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 속도 로그압축: rateCLog10(클 수 있음)을 1~2배로 압축. 생산 빠를수록 약간 더 활발(방치 살아있음). */
function speedFactor(rateCLog10: number): number {
  // rateCLog10이 음수(rateC<1)거나 0이면 1배. 0.05/decade로 완만, 상한 2.
  const f = 1 + Math.max(0, rateCLog10) * 0.05;
  return f > 2 ? 2 : f;
}

export class ParticleSystem {
  private readonly pool: Particle[] = [];
  private config: ParticlesConfig | null = null;
  private color: RGB = { r: 139, g: 195, b: 74 };
  /** 현재 활성 목표 수(density). 저사양 LOD에서 동적 하향 가능(차기). */
  private targetDensity = 0;
  /** 화면 크기(CSS px) — 스폰 범위. */
  private w = 0;
  private h = 0;
  /** L6 위상 신호: 마지막으로 본 phaseState. 변하면 아크 무리 재생성(regen). */
  private lastPhaseState = '';

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0,
        age: 0,
        life: 0,
        arcStart: 0,
        arcLen: 0,
        seed: 0,
      });
    }
  }

  get active(): boolean {
    return this.config != null;
  }

  /** 활성 파티클 수(dev HUD·검증용). */
  get activeCount(): number {
    let n = 0;
    for (let i = 0; i < this.pool.length; i++) if (this.pool[i].active) n++;
    return n;
  }

  /**
   * config·색 설정(onLayerChange). config=null이면 파티클 비활성(전부 소거).
   *  density는 MAX_PARTICLES로 클램프.
   */
  setConfig(config: ParticlesConfig | null, color: RGB): void {
    const prev = this.config;
    this.config = config;
    this.color = color;
    if (!config) {
      this.deactivateAll();
      this.targetDensity = 0;
      return;
    }
    this.targetDensity = Math.min(config.density, MAX_PARTICLES);
    // 형태/패턴이 바뀌면 기존 파티클 소거(층 교체 시 잔상 방지 — App 페이드는 캔버스 알파로 차기).
    if (!prev || prev.shape !== config.shape || prev.spawnPattern !== config.spawnPattern) {
      this.deactivateAll();
    }
  }

  /** 화면 크기 갱신(리사이즈). 스폰 범위·기존 파티클 클램프엔 영향 없음(다음 스폰부터 새 범위). */
  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  private deactivateAll(): void {
    for (let i = 0; i < this.pool.length; i++) this.pool[i].active = false;
  }

  /** 비활성 슬롯 찾기(없으면 -1). 풀 상한이라 스폰은 예산 내에서만. */
  private freeSlot(): number {
    for (let i = 0; i < this.pool.length; i++) if (!this.pool[i].active) return i;
    return -1;
  }

  /** 한 파티클을 config에 맞춰 스폰(슬롯 재설정 — 새 객체 생성 없음). */
  private spawn(p: Particle): void {
    const cfg = this.config;
    if (!cfg) return;
    p.active = true;
    p.age = 0;
    p.life = rand(cfg.lifeRange[0], cfg.lifeRange[1]);
    p.size = rand(cfg.sizeRange[0], cfg.sizeRange[1]);
    p.seed = Math.random() * Math.PI * 2;
    p.x = rand(0, this.w);
    p.y = rand(0, this.h);
    if (cfg.shape === 'arc') {
      // 간섭 파면: 화면 곳곳에서 천천히 확장하는 호. 시작 반경 작게 → life 동안 확장.
      p.size = rand(cfg.sizeRange[0] * 0.4, cfg.sizeRange[0]);
      p.arcStart = rand(0, Math.PI * 2);
      p.arcLen = rand(Math.PI * 0.3, Math.PI * 0.9);
      // 확장 속도(반경/s)를 vx에 저장(arc는 vx를 확장률로 전용).
      p.vx = cfg.speedBase;
      p.vy = 0;
    } else {
      // 브라운: 작은 무작위 초기 속도.
      const ang = rand(0, Math.PI * 2);
      const sp = cfg.speedBase * rand(0.3, 1);
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp;
    }
  }

  /**
   * 위상 신호(L6 regen). phaseState가 바뀌면 아크 무리를 새로 스폰(이전 무리는 자연 페이드).
   *  이번 슬라이스: snapshot.phase.state 변화 감지로 충분(이벤트 구독은 차기).
   */
  signalPhase(phaseState: string): void {
    if (!this.config || this.config.fade !== 'regen') return;
    if (phaseState && phaseState !== this.lastPhaseState) {
      this.lastPhaseState = phaseState;
      // 활성 아크의 절반쯤을 즉시 재스폰(무리 교체 느낌). 나머지는 수명대로 사라짐.
      let reset = 0;
      const budget = Math.ceil(this.targetDensity / 2);
      for (let i = 0; i < this.pool.length && reset < budget; i++) {
        if (this.pool[i].active) {
          this.spawn(this.pool[i]);
          reset++;
        }
      }
    }
  }

  /**
   * 업데이트: 활성 파티클 적분 + 수명 소멸 + 예산 내 재스폰.
   *  dt=클램프된 delta(s). rateCLog10=속도 매핑. reducedMotion이면 운동 정지(위치 고정).
   */
  update(dt: number, rateCLog10: number, reducedMotion: boolean): void {
    const cfg = this.config;
    if (!cfg) return;
    const sf = reducedMotion ? 0 : speedFactor(rateCLog10);

    let activeNow = 0;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        continue;
      }
      if (!reducedMotion) {
        if (cfg.shape === 'arc') {
          // 호 반경 확장(vx=확장률). 천천히 바깥으로.
          p.size += p.vx * sf * dt;
        } else {
          // 브라운: 위치 적분 + 작은 무작위 가속 + 감쇠.
          p.x += p.vx * sf * dt;
          p.y += p.vy * sf * dt;
          p.vx += rand(-1, 1) * cfg.speedBase * dt;
          p.vy += rand(-1, 1) * cfg.speedBase * dt;
          p.vx *= 0.96; // 감쇠(폭주 방지)
          p.vy *= 0.96;
          // 화면 밖으로 나가면 반대편으로 랩(wrap) — 끊김 없는 앰비언트.
          if (p.x < -p.size) p.x = this.w + p.size;
          else if (p.x > this.w + p.size) p.x = -p.size;
          if (p.y < -p.size) p.y = this.h + p.size;
          else if (p.y > this.h + p.size) p.y = -p.size;
        }
      }
      activeNow++;
    }

    // 예산 내 재스폰(목표 density까지). reduced-motion이어도 채워두되(정적 점), 운동만 멈춤.
    let deficit = this.targetDensity - activeNow;
    while (deficit > 0) {
      const slot = this.freeSlot();
      if (slot < 0) break;
      this.spawn(this.pool[slot]);
      deficit--;
    }
  }

  /** 페이드 알파: age/life 기준 부드러운 in/out(삼각). seed로 위상 분산은 안 함(소멸 일관). */
  private fadeAlpha(p: Particle): number {
    const t = p.age / p.life; // 0~1
    // 0→0.15 페이드인, 0.15~0.7 유지, 0.7→1 페이드아웃.
    if (t < 0.15) return t / 0.15;
    if (t > 0.7) return (1 - t) / 0.3;
    return 1;
  }

  /**
   * 드로우. ctx는 dpr setTransform 적용 상태(CSS px 좌표). 합성(add/normal)은 호출자(글로우와 별도로
   *  파티클은 항상 normal — 배경 위 부드러운 점/아크)가 정한 globalCompositeOperation 하에서 그린다.
   *  형태별: circle=radial fill(가장자리 부드럽게), arc=stroke.
   */
  draw(ctx: CanvasRenderingContext2D): void {
    const cfg = this.config;
    if (!cfg) return;
    const c = this.color;

    if (cfg.shape === 'arc') {
      ctx.lineWidth = 1.5;
      for (let i = 0; i < this.pool.length; i++) {
        const p = this.pool[i];
        if (!p.active) continue;
        const a = this.fadeAlpha(p) * 0.5; // 아크는 더 은은하게
        if (a <= 0.001) continue;
        ctx.strokeStyle = rgba(c, a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, p.arcStart, p.arcStart + p.arcLen);
        ctx.stroke();
      }
      return;
    }

    // circle: 가장자리 부드러운 원(작은 radialGradient는 비싸므로 알파 단색 + 약한 외곽).
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const a = this.fadeAlpha(p) * 0.6;
      if (a <= 0.001) continue;
      ctx.fillStyle = rgba(c, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 전체 소거(dispose). 풀 객체는 유지(재사용 가능 상태) — 참조만 비활성. */
  destroy(): void {
    this.deactivateAll();
    this.config = null;
  }
}
