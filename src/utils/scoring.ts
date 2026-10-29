/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VERTIKAL SMA JAWARA 28
 * Rumus Penilaian 7 Kebiasaan Anak Indonesia Hebat (7 KAIH)
 * Sesuai Spesifikasi Final & Addendum SMAN 28 Jakarta
 */

import { PRAYER_SCHEDULE, SCORING_RULES } from '../config/scoringConfig';
import { timeToMinutes } from './timeClassifier';

export interface ScoreBreakdownResult {
  baseScore: number;      // Nilai dasar sebelum bonus
  bonusScore: number;     // Total bonus yang diperoleh (Adiwiyata, Sunnah, dsb.)
  nilaiCapaian: number;   // Nilai Capaian akhir kebiasaan (Maksimal 100)
  overflowBonus: number;  // Bonus berlebih di atas 100 yang dialihkan ke Poin Hebat
}

/**
 * Mekanisme Bonus Final (Pasal 9.2):
 * 1. Nilai Capaian suatu kebiasaan maksimal 100.
 * 2. Bonus menambah Nilai Capaian selama hasil akhirnya belum mencapai 100.
 * 3. Jika Nilai Capaian sudah 100, bonus yang berlebih dialihkan ke Poin Hebat.
 * 4. Nilai Capaian tidak boleh menjadi 101, 105, atau angka lain di atas 100.
 */
export function applyBonusCapAndOverflow(baseScore: number, bonusScore: number): ScoreBreakdownResult {
  const cleanBase = Math.max(0, Math.round(baseScore * 100) / 100);
  const cleanBonus = Math.max(0, Math.round(bonusScore * 100) / 100);
  const combined = cleanBase + cleanBonus;
  const nilaiCapaian = Math.min(100, Math.round(combined * 10) / 10);
  const overflowBonus = Math.max(0, Math.round((combined - 100) * 10) / 10);
  return {
    baseScore: Math.min(100, cleanBase),
    bonusScore: cleanBonus,
    nilaiCapaian,
    overflowBonus,
  };
}

// ============================================================================
// 1. BANGUN PAGI (Pasal 3)
// Ketepatan waktu bangun (Maks 75):
// 04.00-04.20 = 75, 04.21-04.40 = 70, 04.41-05.00 = 65, 05.01-06.20 = 60, 06.21-06.40 = 55, >06.40 = 50
// Kondisi saat bangun (Maks 25):
// Sangat segar = 25, Cukup segar = 20, Kurang segar = 15, Lemas/mengantuk = 10, Pusing/kelelahan = 5
// Tidak ada pengurangan 5 poin karena fleksibel atau terlewat!
// ============================================================================
export interface BangunPagiInput {
  timeStr?: string; // e.g. "04:15"
  timeSlot?: string; // e.g. "04.00-04.20"
  kebugaranLevel?: number; // 1 to 5 (5=25, 4=20, 3=15, 2=10, 1=5)
  isMissed?: boolean;
}

export function classifyBangunPagiTime(timeStr: string): { slotId: string; score: number; label: string } {
  const min = timeToMinutes(timeStr);
  if (min < 240) {
    return { slotId: '04.00-04.20', score: 75, label: '04.00 – 04.20 WIB' };
  }
  for (const b of SCORING_RULES.bangunPagi.brackets) {
    if (min >= b.minMin && min <= b.maxMin) {
      return { slotId: b.id, score: b.score, label: b.label };
    }
  }
  return { slotId: '>06.40', score: 50, label: 'Lebih dari 06.40 WIB' };
}

export function calculateBangunPagiScore(input: BangunPagiInput): number {
  let timeScore = 50;
  if (input.timeSlot) {
    const found = SCORING_RULES.bangunPagi.brackets.find((b) => b.id === input.timeSlot);
    if (found) timeScore = found.score;
  } else if (input.timeStr) {
    timeScore = classifyBangunPagiTime(input.timeStr).score;
  }

  const level = input.kebugaranLevel !== undefined ? Math.max(1, Math.min(5, Number(input.kebugaranLevel))) : 5;
  const kebugaranScore = level * 5; // 1=5, 2=10, 3=15, 4=20, 5=25

  return Math.min(100, timeScore + kebugaranScore);
}

// ============================================================================
// 2. BERIBADAH (ISLAM, KRISTEN/KATOLIK, HINDU) (Pasal 2 & Addendum B)
// ============================================================================
export type TimeCategoryChoice = 'awal' | 'tengah' | 'akhir';

export interface ShalatDetailResult {
  score: number;
  category: TimeCategoryChoice;
  categoryLabel: string;
  menitLewat: number;
  waktuSisa: number;
  waktuToleransi: number;
  selangTotal: number;
  formulaText: string;
}

export function getPrayerCategoryScore(category: TimeCategoryChoice): number {
  if (category === 'awal') return SCORING_RULES.shalat.awalWaktu; // 100
  if (category === 'tengah') return SCORING_RULES.shalat.tengahWaktu; // 85
  return SCORING_RULES.shalat.akhirWaktu; // 70
}

export function calculateShalatScoreDetailed(
  prayerKey: 'subuh' | 'zuhur' | 'asar' | 'magrib' | 'isya',
  checkInTimeStr: string,
  isMissed = false,
  manualCategory?: TimeCategoryChoice
): ShalatDetailResult {
  const sched = PRAYER_SCHEDULE[prayerKey] || PRAYER_SCHEDULE.zuhur;
  const adzanMin = timeToMinutes(sched.adzanTime);
  let checkInMin = timeToMinutes(checkInTimeStr || sched.adzanTime);

  if (prayerKey === 'isya' && checkInMin < 240) {
    checkInMin += 1440;
  }

  const selangTotal = sched.totalMinutes;
  const waktuToleransi = Math.max(1, selangTotal - SCORING_RULES.shalat.toleranceDeductionMinutes);
  const akhirShalatMin = adzanMin + selangTotal;
  const menitLewat = Math.max(0, checkInMin - adzanMin);
  const waktuSisa = Math.max(0, akhirShalatMin - checkInMin);

  // Determine category: manual choice takes priority per Spec 2.1 ("Pengguna memilih kategori awal, tengah, atau akhir secara manual")
  let cat: TimeCategoryChoice = manualCategory || 'awal';
  if (!manualCategory) {
    const third = selangTotal / 3;
    if (menitLewat <= third) cat = 'awal';
    else if (menitLewat <= third * 2) cat = 'tengah';
    else cat = 'akhir';
  }

  const score = getPrayerCategoryScore(cat);
  const categoryLabel = cat === 'awal' ? 'Awal Waktu (100)' : cat === 'tengah' ? 'Tengah Waktu (85)' : 'Akhir Waktu (70)';
  const formulaText = `Kategori ${categoryLabel} • Jadwal Adzan ${sched.adzanTime} WIB`;

  return {
    score,
    category: cat,
    categoryLabel,
    menitLewat,
    waktuSisa,
    waktuToleransi,
    selangTotal,
    formulaText,
  };
}

/**
 * Tri Sandhya Hindu (Pasal 2.3):
 * Pagi (06.00), Siang (12.00), Sore (18.00)
 * Awal (0-2 jam): 100, Tengah (2-4 jam): 85, Akhir (4-6 jam): 70
 * Membaca kitab suci Weda: bonus +5
 */
export function calculateHinduSandhyaScoreDetailed(
  sandhyaKey: 'pagi' | 'siang' | 'sore',
  checkInTimeStr: string,
  isMissed = false,
  manualCategory?: TimeCategoryChoice
): { score: number; category: TimeCategoryChoice; menitLewat: number; waktuSisa: number; waktuToleransi: number; formulaText: string } {
  const sched = SCORING_RULES.triSandhya[sandhyaKey];
  const idealMin = sched.idealMin;
  const endMin = sched.endMin;
  const checkInMin = timeToMinutes(checkInTimeStr || '06:00');
  const menitLewat = Math.max(0, checkInMin - idealMin);
  const waktuSisa = Math.max(0, endMin - checkInMin);
  const waktuToleransi = endMin - idealMin;

  let cat: TimeCategoryChoice = manualCategory || 'awal';
  if (!manualCategory) {
    if (menitLewat <= 120) cat = 'awal';
    else if (menitLewat <= 240) cat = 'tengah';
    else cat = 'akhir';
  }

  const score = cat === 'awal' ? 100 : cat === 'tengah' ? 85 : 70;
  const catLabel = cat === 'awal' ? 'Awal Waktu (0–2 jam) = 100 pt' : cat === 'tengah' ? 'Tengah Waktu (2–4 jam) = 85 pt' : 'Akhir Waktu (4–6 jam) = 70 pt';

  return {
    score,
    category: cat,
    menitLewat,
    waktuSisa,
    waktuToleransi,
    formulaText: catLabel,
  };
}

/**
 * Doa Harian Kristen / Katolik (Pasal 2.2):
 * 5 Kebiasaan @ 20 poin = 100 poin
 */
export function calculateKristenDoaScoreDetailed(
  doaKey: 'bangun' | 'pergi' | 'makan' | 'pulang' | 'tidur' | 'alkitab' | 'kegiatan',
  checkInTimeStr: string,
  isMissed = false
): { score: number; label: string; formulaText: string } {
  const labelMap: Record<string, string> = {
    bangun: 'Doa bangun tidur',
    alkitab: 'Membaca Alkitab',
    pergi: 'Membaca Alkitab',
    makan: 'Doa saat makan',
    kegiatan: 'Doa sebelum melakukan kegiatan',
    pulang: 'Doa sebelum melakukan kegiatan',
    tidur: 'Doa sebelum tidur',
  };
  return {
    score: 20,
    label: labelMap[doaKey] || 'Kebiasaan Ibadah',
    formulaText: 'Komponen Ibadah Kristen/Katolik = 20 / 20 pt',
  };
}

export interface IslamIbadahInput {
  isHalangan?: boolean;
  halanganComponents?: string[]; // 5 komponen @ 20 poin (Addendum B.2)
  prayersDone?: ('subuh' | 'zuhur' | 'asar' | 'magrib' | 'isya')[];
  prayerScores?: Record<string, number>;
  puasaSunnah?: boolean;
  sunnahActivities?: string;
  quranPages?: number;
  surahName?: string;
  isMissed?: boolean;
}

export function calculateIslamHalanganScore(components: string[] = []): number {
  const validIds = SCORING_RULES.shalat.halanganComponents.map((c) => c.id);
  const uniqueValid = Array.from(new Set(components.filter((id) => validIds.includes(id))));
  return Math.min(100, uniqueValid.length * 20);
}

export function calculateIslamScoreWithBreakdown(input: IslamIbadahInput): ScoreBreakdownResult {
  if (input.isHalangan) {
    // Jika halanganComponents diberikan, masing-masing 20 poin (Addendum B.2)
    // Jika dipanggil tanpa rincian array (backward compatibility test), berikan 100
    const compScore = input.halanganComponents !== undefined
      ? calculateIslamHalanganScore(input.halanganComponents)
      : 100;
    return applyBonusCapAndOverflow(compScore, 0);
  }

  const prayers = ['subuh', 'zuhur', 'asar', 'magrib', 'isya'] as const;
  const scores: number[] = [];

  for (const p of prayers) {
    if (input.prayersDone?.includes(p)) {
      const sc = input.prayerScores?.[p] !== undefined ? input.prayerScores[p] : 100;
      scores.push(Math.max(0, Math.min(100, sc)));
    } else {
      scores.push(0);
    }
  }

  const sumPrayers = scores.reduce((a, b) => a + b, 0);
  const avgPrayer = Math.round((sumPrayers / 5) * 10) / 10;

  // Ibadah sunnah bonus 5 poin (puasa sunnah atau kegiatan sunnah lain seperti tahajud / Al-Qur'an)
  const hasSunnah = Boolean(
    input.puasaSunnah ||
    (input.sunnahActivities && input.sunnahActivities.trim().length > 0) ||
    (input.quranPages && input.quranPages > 0)
  );
  const bonus = hasSunnah ? SCORING_RULES.shalat.sunnahBonus : 0;

  if (sumPrayers === 0 && !hasSunnah) {
    return { baseScore: 0, bonusScore: 0, nilaiCapaian: 0, overflowBonus: 0 };
  }

  return applyBonusCapAndOverflow(avgPrayer, bonus);
}

export function calculateIslamScore(input: IslamIbadahInput): number {
  return calculateIslamScoreWithBreakdown(input).nilaiCapaian;
}

export interface KristenIbadahInput {
  prayers: string[]; // 'bangun' | 'alkitab'/'pergi' | 'makan' | 'kegiatan'/'pulang' | 'tidur'
  prayerScores?: Record<string, number>;
  otherWorship?: boolean;
  notes?: string;
  isMissed?: boolean;
}

export function calculateKristenScoreWithBreakdown(input: KristenIbadahInput): ScoreBreakdownResult {
  const uniqueCount = Math.min(5, new Set(input.prayers || []).size);
  // Setiap pilihan bernilai 20 poin, maksimal 100
  const baseScore = uniqueCount * 20;
  const bonus = input.otherWorship ? SCORING_RULES.doaKristen.otherWorshipBonus : 0;
  return applyBonusCapAndOverflow(baseScore, bonus);
}

export function calculateKristenScore(input: KristenIbadahInput): number {
  return calculateKristenScoreWithBreakdown(input).nilaiCapaian;
}

export interface HinduIbadahInput {
  triSandhya: ('pagi' | 'siang' | 'sore')[];
  sandhyaScores?: Record<string, number>;
  otherWorship?: boolean; // Membaca kitab suci Weda bonus +5
  notes?: string;
  isMissed?: boolean;
}

export function calculateHinduScoreWithBreakdown(input: HinduIbadahInput): ScoreBreakdownResult {
  const allSandhya = ['pagi', 'siang', 'sore'] as const;
  let sum = 0;
  for (const s of allSandhya) {
    if (input.triSandhya?.includes(s)) {
      const sc = input.sandhyaScores?.[s] !== undefined ? input.sandhyaScores[s] : 100;
      sum += Math.max(0, Math.min(100, sc));
    }
  }
  const avgSandhya = Math.round((sum / 3) * 10) / 10;
  const bonus = input.otherWorship ? SCORING_RULES.triSandhya.wedaBonus : 0;
  return applyBonusCapAndOverflow(avgSandhya, bonus);
}

export function calculateHinduScore(input: HinduIbadahInput): number {
  return calculateHinduScoreWithBreakdown(input).nilaiCapaian;
}

// ============================================================================
// 3. BEROLAHRAGA (Pasal 6)
// Aktivitas (masing-masing 10 poin, maks 40):
// - Olahraga mandiri (10)
// - Olahraga kelompok/ekskul (10)
// - Jalan kaki aktif/naik tangga (10)
// - Pemanasan/peregangan ringan (10)
// Durasi: <15m (25), 15-30m (35), >30m (45)
// Deskripsi: >=15 char (15), 10-15 char (10), <10 char/kosong (0)
// Bonus Adiwiyata: Jalan kaki atau bersepeda ke sekolah (+5)
// ============================================================================
export interface OlahragaInput {
  duration: '<15' | '15-30' | '>30' | '31-60' | '>60';
  activities: string[];
  notes?: string;
  walkOrBikeToSchoolEco?: boolean;
  isMissed?: boolean;
}

export function calculateOlahragaScoreWithBreakdown(input: OlahragaInput): ScoreBreakdownResult {
  const acts = input.activities || [];
  let actScore = 0;
  let ecoBonus = input.walkOrBikeToSchoolEco ? 5 : 0;

  if (acts.includes('mandiri')) actScore += 10;
  if (acts.includes('kelompok')) actScore += 10;
  if (acts.includes('jalanTangga')) actScore += 10;
  if (acts.includes('pemanasan') || acts.includes('stretching')) actScore += 10;
  if (acts.includes('bersepedaAdiwiyata') || acts.includes('sepedaJalanSekolah')) {
    ecoBonus = 5;
  }

  if (actScore === 0 && ecoBonus === 0) {
    return { baseScore: 0, bonusScore: 0, nilaiCapaian: 0, overflowBonus: 0 };
  }

  let durScore = 0;
  switch (input.duration) {
    case '<15':
      durScore = 25;
      break;
    case '15-30':
      durScore = 35;
      break;
    case '>30':
    case '31-60':
    case '>60':
      durScore = 45;
      break;
  }

  const descLen = (input.notes || '').trim().length;
  let descScore = 0;
  if (descLen >= 15) descScore = 15;
  else if (descLen >= 10) descScore = 10;
  else descScore = 0;

  const baseScore = actScore + durScore + descScore; // Max 40 + 45 + 15 = 100
  return applyBonusCapAndOverflow(baseScore, ecoBonus);
}

export function calculateOlahragaScore(input: OlahragaInput): number {
  return calculateOlahragaScoreWithBreakdown(input).nilaiCapaian;
}

// ============================================================================
// 4. MAKAN BERGIZI (Pasal 4)
// Komponen nilai per sesi (Maks 100):
// - Waktu makan: 15 (ideal) / 10 (di luar ideal tapi masih dalam batas)
// - Karbohidrat: 17.5
// - Lauk: 17.5
// - Sayur: 15
// - Buah: 15
// - Minum >=2 gelas: 20, 1 gelas: 15, 0 gelas: 0
// Bonus Adiwiyata: Kotak makan sendiri (+5), Tumbler sendiri (+5)
// ============================================================================
export interface MakanSingleMealInput {
  mealType: 'sarapan' | 'siang' | 'malam' | 'sahur' | 'buka';
  timeStr?: string;
  isOnTimeChoice?: boolean; // true = rentang ideal (15 pt), false = luar rentang ideal dalam batas (10 pt)
  isPuasa?: boolean;
  hasKarbo?: boolean;
  hasLauk?: boolean;
  hasSayur?: boolean;
  hasBuah?: boolean;
  waterGlasses?: '>=2' | '1' | '0_manis' | '0';
  kotakMakanEco?: boolean;
  tumblerEco?: boolean;
  isMissed?: boolean;
}

export function calculateSingleMealScoreWithBreakdown(input: MakanSingleMealInput): ScoreBreakdownResult {
  // 1. Waktu makan: 15 dalam rentang ideal, 10 di luar rentang ideal tapi dalam batas
  let timeScore = 15;
  if (input.isOnTimeChoice !== undefined) {
    timeScore = input.isOnTimeChoice ? 15 : 10;
  } else if (input.timeStr) {
    const min = timeToMinutes(input.timeStr);
    if (input.mealType === 'sarapan') {
      timeScore = min >= 360 && min <= 480 ? 15 : 10;
    } else if (input.mealType === 'siang') {
      timeScore = min >= 690 && min <= 780 ? 15 : 10;
    } else if (input.mealType === 'malam') {
      timeScore = min >= 1080 && min <= 1170 ? 15 : 10;
    } else if (input.mealType === 'sahur') {
      timeScore = min >= 210 && min <= 230 ? 15 : 10;
    } else if (input.mealType === 'buka') {
      timeScore = min >= 1110 && min <= 1155 ? 15 : 10;
    }
  }

  // 2. Komponen Gizi: Karbo 17.5, Lauk 17.5, Sayur 15, Buah 15 (Total 65)
  let giziScore = 0;
  if (input.hasKarbo) giziScore += SCORING_RULES.makan.karbo; // 17.5
  if (input.hasLauk) giziScore += SCORING_RULES.makan.lauk;   // 17.5
  if (input.hasSayur) giziScore += SCORING_RULES.makan.sayur; // 15
  if (input.hasBuah) giziScore += SCORING_RULES.makan.buah;   // 15

  // 3. Air Minum: >=2 gelas (20), 1 gelas (15), 0 gelas (0)
  let waterScore = 0;
  if (input.waterGlasses === '>=2') waterScore = SCORING_RULES.makan.air2Gelas; // 20
  else if (input.waterGlasses === '1') waterScore = SCORING_RULES.makan.air1Gelas; // 15
  else waterScore = 0;

  // Base total per sesi: 15 + 65 + 20 = 100
  const baseScore = timeScore + giziScore + waterScore;

  // 4. Bonus Adiwiyata: Kotak makan (+5), Tumbler (+5)
  const bonusScore = (input.kotakMakanEco ? 5 : 0) + (input.tumblerEco ? 5 : 0);

  return applyBonusCapAndOverflow(baseScore, bonusScore);
}

export function calculateSingleMealScore(input: MakanSingleMealInput): number {
  return calculateSingleMealScoreWithBreakdown(input).nilaiCapaian;
}

export interface MakanDailySummaryInput {
  sarapan?: MakanSingleMealInput;
  siang?: MakanSingleMealInput;
  malam?: MakanSingleMealInput;
  sahur?: MakanSingleMealInput;
  buka?: MakanSingleMealInput;
  isPuasa?: boolean;
}

export function calculateMakanDailyScore(input: MakanDailySummaryInput): number {
  if (input.isPuasa) {
    const sInput = input.sahur || input.sarapan;
    const mInput = input.buka || input.malam;
    const sScore = sInput ? calculateSingleMealScore(sInput) : 0;
    const mScore = mInput ? calculateSingleMealScore(mInput) : 0;
    return Math.round(((sScore + mScore) / 2) * 100) / 100;
  }

  const sScore = input.sarapan ? calculateSingleMealScore(input.sarapan) : 0;
  const lScore = input.siang ? calculateSingleMealScore(input.siang) : 0;
  const dScore = input.malam ? calculateSingleMealScore(input.malam) : 0;

  // Rumus nilai akhir Makan Bergizi (Pasal 4.4): (Sarapan + Makan siang + Makan malam) / 3
  return Math.round(((sScore + lScore + dScore) / 3) * 100) / 100;
}

// ============================================================================
// 5. GEMAR BELAJAR (Pasal 7)
// Durasi belajar (Max 60): >3h (60), 2-3h (50), 1-2h (40), 30-60m (30), 15-30m (20), <15m (10), Tidak belajar (0)
// Jumlah jenis kegiatan belajar (Max 30): >=3 (30), 2 (20), 1 (10), 0 (0)
// Deskripsi hasil belajar (Max 10): >=15 char (10), 10-15 char (5), <10 char/kosong (0)
// ============================================================================
export interface GemarBelajarInput {
  duration: '0' | '<15' | '15-30' | '30-60' | '1-2h' | '2-3h' | '>3h';
  activities: string[];
  outputDescription?: string;
  isMissed?: boolean;
}

export function calculateGemarBelajarScore(input: GemarBelajarInput): number {
  let durScore = 0;
  switch (input.duration) {
    case '>3h':
      durScore = 60;
      break;
    case '2-3h':
      durScore = 50;
      break;
    case '1-2h':
      durScore = 40;
      break;
    case '30-60':
      durScore = 30;
      break;
    case '15-30':
      durScore = 20;
      break;
    case '<15':
      durScore = 10;
      break;
    default:
      durScore = 0;
      break;
  }

  const actCount = (input.activities || []).length;
  let actScore = 0;
  if (actCount >= 3) actScore = 30;
  else if (actCount === 2) actScore = 20;
  else if (actCount === 1) actScore = 10;
  else actScore = 0;

  const desc = (input.outputDescription || '').trim();
  let descScore = 0;
  if (desc.length >= 15) {
    descScore = 10;
  } else if (desc.length >= 10) {
    descScore = 5;
  } else {
    descScore = 0;
  }

  if (durScore === 0 && actScore === 0 && descScore === 0) {
    return 0;
  }

  return Math.min(100, durScore + actScore + descScore);
}

// ============================================================================
// 6. BERMASYARAKAT (Pasal 8)
// Jumlah tindakan sosial (Max 90): >=4 (90), 3 (80), 2 (70), 1 (60), 0 (0)
// Deskripsi (Max 10): >15 karakter (10), 10-15 karakter (5), <10 karakter/kosong (0)
// Piket atau menjaga kebersihan lingkungan: Bonus 5 (dipisahkan dari nilai dasar)
// ============================================================================
export interface BermasyarakatInput {
  actions: string[];
  description?: string;
  piketEcoBonus?: boolean;
  isMissed?: boolean;
}

export function calculateBermasyarakatScoreWithBreakdown(input: BermasyarakatInput): ScoreBreakdownResult {
  const rawActions = input.actions || [];
  const hasPiketBonus = Boolean(input.piketEcoBonus || rawActions.includes('piket'));
  // Hitung tindakan sosial utama (jika 'piket' dicentang bersama tindakan sosial, pisahkan bonus piket +5)
  const socialActionsOnly = rawActions.filter((a) => a !== 'piket_bonus_only');
  const actCount = socialActionsOnly.length;

  let actScore = 0;
  if (actCount >= 4) actScore = 90;
  else if (actCount === 3) actScore = 80;
  else if (actCount === 2) actScore = 70;
  else if (actCount === 1) actScore = 60;
  else actScore = 0;

  const desc = (input.description || '').trim();
  let descScore = 0;
  if (desc.length > 15) {
    descScore = 10;
  } else if (desc.length >= 10) {
    descScore = 5;
  } else {
    descScore = 0;
  }

  const baseScore = actScore + descScore; // Max 90 + 10 = 100
  const bonusScore = hasPiketBonus ? 5 : 0;

  if (baseScore === 0 && bonusScore === 0) {
    return { baseScore: 0, bonusScore: 0, nilaiCapaian: 0, overflowBonus: 0 };
  }

  return applyBonusCapAndOverflow(baseScore, bonusScore);
}

export function calculateBermasyarakatScore(input: BermasyarakatInput): number {
  return calculateBermasyarakatScoreWithBreakdown(input).nilaiCapaian;
}

// ============================================================================
// 7. TIDUR CEPAT (Pasal 5)
// Nilai waktu tidur (Max 75): Sebelum 21.30 (75), 21.30-22.30 (65), 22.31-23.30 (55), Setelah 23.30 (45)
// Kondisi sebelum tidur (Max 25):
// - Tidak mengantuk: 5
// - Belum mengantuk: 10
// - Cukup rileks: 15
// - Rileks: 20
// - Sangat rileks: 25
// Mematikan lampu: Bonus Adiwiyata 5 poin (terpisah dari nilai dasar)
// ============================================================================
export interface TidurCepatInput {
  bedtimeSlot?: '<21.30' | '21.30-22.30' | '22.31-23.30' | '>23.30';
  timeStr?: string;
  turnOffLightsEco?: boolean;
  sleepQuality: number; // 1-5 (Kondisi sebelum tidur: 1=5, 2=10, 3=15, 4=20, 5=25)
  reasonOrReport?: string;
  isMissed?: boolean;
}

export function classifyTidurTime(timeStr: string): { slot: '<21.30' | '21.30-22.30' | '22.31-23.30' | '>23.30'; score: number; label: string } {
  const min = timeToMinutes(timeStr);
  // Sebelum 21.30 WIB (misal pukul 18.00 - 21.29 -> min >= 1080 && min < 1290)
  if (min >= 1080 && min < 1290) {
    return { slot: '<21.30', score: 75, label: 'Sebelum 21.30 WIB' };
  }
  if (min >= 1290 && min <= 1350) {
    return { slot: '21.30-22.30', score: 65, label: '21.30 – 22.30 WIB' };
  }
  if (min > 1350 && min <= 1410) {
    return { slot: '22.31-23.30', score: 55, label: '22.31 – 23.30 WIB' };
  }
  return { slot: '>23.30', score: 45, label: 'Setelah 23.30 WIB' };
}

export function calculateTidurCepatScoreWithBreakdown(input: TidurCepatInput): ScoreBreakdownResult {
  let timeScore = 75;
  if (input.bedtimeSlot) {
    if (input.bedtimeSlot === '<21.30') timeScore = 75;
    else if (input.bedtimeSlot === '21.30-22.30') timeScore = 65;
    else if (input.bedtimeSlot === '22.31-23.30') timeScore = 55;
    else timeScore = 45;
  } else if (input.timeStr) {
    timeScore = classifyTidurTime(input.timeStr).score;
  }

  let kondisiScore = 15;
  switch (Number(input.sleepQuality)) {
    case 5:
      kondisiScore = 25; // Sangat rileks
      break;
    case 4:
      kondisiScore = 20; // Rileks
      break;
    case 3:
      kondisiScore = 15; // Cukup rileks
      break;
    case 2:
      kondisiScore = 10; // Belum mengantuk
      break;
    case 1:
    default:
      kondisiScore = 5;  // Tidak mengantuk
      break;
  }

  const baseScore = timeScore + kondisiScore; // Max 75 + 25 = 100
  const bonusScore = input.turnOffLightsEco ? 5 : 0;

  return applyBonusCapAndOverflow(baseScore, bonusScore);
}

export function calculateTidurCepatScore(input: TidurCepatInput): number {
  return calculateTidurCepatScoreWithBreakdown(input).nilaiCapaian;
}
