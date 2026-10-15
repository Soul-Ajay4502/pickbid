import type { CSSProperties } from 'react';
import {
  ArrowLeftRight, Award, BadgeCheck, Bomb, BookOpen, Boxes, Briefcase, Building2, CalendarCheck,
  CalendarClock, CalendarDays, CalendarPlus, CalendarRange, Camera, Cast, ChartPie, CheckCheck,
  ChevronsUp, CircleCheckBig, ClipboardCheck, ClipboardList, ClipboardPen, CloudRain, CloudSun,
  Coins, Crosshair, Crown, DoorClosed, DoorOpen, Eye, FileCheck, Flag, Flame, Gauge, Gavel, Gem,
  Globe, GraduationCap, Hammer, Hand, HandCoins, HandHelping, Handshake, Heart, HeartHandshake,
  History, ImageIcon, InfinityIcon, Layers, Link, ListOrdered, Lock, LogIn, MapIcon, Medal, Megaphone,
  MessagesSquare, Mountain, Network, NotebookPen, Orbit, Palette, Phone, Pickaxe, PiggyBank,
  PlaneTakeoff, Radio, Receipt, RefreshCcw, Ribbon, Rocket, Route, Scale, ScrollText, Shield,
  ShieldCheck, ShieldPlus, Shirt, Shuffle, Snowflake, Sparkle, Sparkles, Sprout, Star, Sun,
  Sunrise, Swords, Tag, Target, ThermometerSun, Ticket, Timer, TrendingUp, Trophy, UserCheck,
  Users, UsersRound, Wallet, WandSparkles, Wind, Zap, type LucideIcon,
} from 'lucide-react';
import { medalTone, type BadgeDefinition, type BadgeIcon } from '@/lib/badges';

const ICONS: Record<BadgeIcon, LucideIcon> = {
  sparkles: Sparkles,
  shirt: Shirt,
  'shield-check': ShieldCheck,
  phone: Phone,
  camera: Camera,
  'file-check': FileCheck,
  receipt: Receipt,
  sprout: Sprout,
  route: Route,
  map: MapIcon,
  'heart-handshake': HeartHandshake,
  sunrise: Sunrise,
  'door-open': DoorOpen,
  ticket: Ticket,
  eye: Eye,
  'calendar-days': CalendarDays,
  link: Link,
  'messages-square': MessagesSquare,
  briefcase: Briefcase,
  'scroll-text': ScrollText,
  'hand-coins': HandCoins,
  'chevrons-up': ChevronsUp,
  sparkle: Sparkle,
  'trending-up': TrendingUp,
  gem: Gem,
  coins: Coins,
  tag: Tag,
  crown: Crown,
  heart: Heart,
  radio: Radio,
  target: Target,
  crosshair: Crosshair,
  shuffle: Shuffle,
  hand: Hand,
  wind: Wind,
  orbit: Orbit,
  'arrow-left-right': ArrowLeftRight,
  'calendar-check': CalendarCheck,
  trophy: Trophy,
  'refresh-ccw': RefreshCcw,
  'plane-takeoff': PlaneTakeoff,
  mountain: Mountain,
  bomb: Bomb,
  scale: Scale,
  swords: Swords,
  gauge: Gauge,
  ribbon: Ribbon,
  medal: Medal,
  shield: Shield,
  sun: Sun,
  'thermometer-sun': ThermometerSun,
  'cloud-rain': CloudRain,
  snowflake: Snowflake,
  flag: Flag,
  history: History,
  image: ImageIcon,
  palette: Palette,
  globe: Globe,
  'clipboard-check': ClipboardCheck,
  'list-ordered': ListOrdered,
  'door-closed': DoorClosed,
  layers: Layers,
  'clipboard-list': ClipboardList,
  'clipboard-pen': ClipboardPen,
  handshake: Handshake,
  'building-2': Building2,
  'users-round': UsersRound,
  'hand-helping': HandHelping,
  users: Users,
  timer: Timer,
  megaphone: Megaphone,
  network: Network,
  'user-check': UserCheck,
  wallet: Wallet,
  'piggy-bank': PiggyBank,
  'wand-sparkles': WandSparkles,
  gavel: Gavel,
  cast: Cast,
  hammer: Hammer,
  boxes: Boxes,
  'badge-check': BadgeCheck,
  'shield-plus': ShieldPlus,
  'calendar-plus': CalendarPlus,
  'notebook-pen': NotebookPen,
  'check-check': CheckCheck,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  flame: Flame,
  infinity: InfinityIcon,
  'calendar-range': CalendarRange,
  'log-in': LogIn,
  'calendar-clock': CalendarClock,
  rocket: Rocket,
  'circle-check-big': CircleCheckBig,
  zap: Zap,
  award: Award,
  pickaxe: Pickaxe,
  'cloud-sun': CloudSun,
  star: Star,
  'chart-pie': ChartPie,
};

/**
 * A badge as a struck medal: its metal is the highest tier earned (bronze,
 * silver, gold — emerald for one-off badges), and an unearned badge is a flat
 * grey blank with a lock. Pass `progress` to ring it with how far along the
 * *next* tier is, drawn in that tier's metal.
 *
 * Decorative — the name and tier are always printed beside it, so it's hidden
 * from assistive tech. Pure CSS (see "Reward medals" in globals.css), so it
 * renders on the server and costs nothing to animate.
 */
export default function BadgeMedal({
  def,
  tier,
  size = 64,
  progress,
  ringTier,
  celebrate = false,
  className = '',
}: {
  def: BadgeDefinition;
  /** Highest earned tier, 0 while locked. */
  tier: number;
  size?: number;
  /** 0–1 towards the next tier. Omit for no ring, e.g. once every tier is earned. */
  progress?: number;
  /** The tier the ring is progress towards, when it isn't `tier + 1`. */
  ringTier?: number;
  /** Strike-in animation, for a tier unlocked just now. */
  celebrate?: boolean;
  className?: string;
}) {
  const tone = medalTone(def, tier);
  const ringTone = medalTone(def, ringTier ?? tier + 1);
  const Icon = ICONS[def.icon];
  const showRing = progress !== undefined;
  const filled = Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 100);

  return (
    <span
      aria-hidden="true"
      className={`medal ${className}`}
      data-medal={tone}
      data-celebrate={celebrate || undefined}
      style={{ '--medal-size': `${size}px` } as CSSProperties}
    >
      {showRing && (
        <svg className="medal-ring" viewBox="0 0 100 100" data-medal={ringTone}>
          <circle cx="50" cy="50" r="47" className="medal-ring-track" />
          {filled > 0 && (
            <circle
              cx="50"
              cy="50"
              r="47"
              pathLength={100}
              strokeDasharray={`${filled} 100`}
              className="medal-ring-fill"
            />
          )}
        </svg>
      )}
      <span className="medal-face">
        <Icon className="medal-icon" strokeWidth={2.1} />
      </span>
      {tone === 'locked' && size >= 44 && (
        <span className="medal-lock">
          <Lock strokeWidth={2.5} />
        </span>
      )}
    </span>
  );
}

/**
 * Bronze · silver · gold pips under a tiered badge, lit up to the tier earned.
 * One-off badges have no tiers, so they get none.
 */
export function TierPips({ def, tier }: { def: BadgeDefinition; tier: number }) {
  if (def.thresholds.length < 2) return null;
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {def.thresholds.map((_, i) => (
        <span
          key={i}
          className="tier-pip"
          data-medal={i < tier ? medalTone(def, i + 1) : undefined}
        />
      ))}
    </span>
  );
}
