// ============================================================================
// PENJAGA DUNIA DIGITAL — script.js
// Logika 4 misi literasi digital (ISTE Standards for Students / Common Sense
// Media k-12 digital citizenship curriculum), gamifikasi lencana, dan
// pencatatan waktu penyelesaian ke "Papan Peringkat Penjaga" via Firebase.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getDatabase, ref, push, set, query, orderByChild, limitToLast, onValue
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// TODO: ganti dengan kredensial proyek Firebase Anda sendiri sebelum rilis.
const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_ANDA",
  authDomain: "penjaga-dunia-digital.firebaseapp.com",
  databaseURL: "https://penjaga-dunia-digital-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "penjaga-dunia-digital",
  storageBucket: "penjaga-dunia-digital.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const leaderboardRef = ref(db, "papan_peringkat_penjaga");

// ----------------------------------------------------------------------------
// Identitas pemain: nama Penjaga singkat, disimpan lokal (tanpa data pribadi)
// ----------------------------------------------------------------------------
function getGuardianName() {
  let name = localStorage.getItem("guardian_name");
  if (!name) {
    const adjectives = ["Cerdik", "Berani", "Waspada", "Ceria", "Gesit"];
    const animals = ["Elang", "Rubah", "Kucing", "Kelinci", "Burung Hantu"];
    name = `Penjaga ${adjectives[Math.floor(Math.random() * adjectives.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;
    localStorage.setItem("guardian_name", name);
  }
  return name;
}
const guardianName = getGuardianName();

// ----------------------------------------------------------------------------
// Kurikulum 4 misi — microcopy berlapis L1 (tap) / L2 (aksi) / L3 (info ℹ️)
// Setiap misi memetakan ke domain literasi digital ISTE/CSM:
//   1. Jejak Digital  2. Phishing/Scam  3. Kata Sandi Aman  4. Anti-Perundungan
// ----------------------------------------------------------------------------
const MISSIONS = [
  {
    id: "jejak",
    badge: "Penjaga Jejak Bersih",
    hotspotIcon: "👣",
    l1: "Ada jejak digital tertinggal!",
    type: "choice",
    options: [
      { id: "good", label: "🧹 Bersihkan Jejak", correct: true },
      { id: "bad", label: "🙈 Biarkan", correct: false }
    ],
    feedbackGood: "Mantap! Kamu menjaga jejak digitalmu tetap rapi.",
    feedbackBad: "Hati-hati! Jejak yang dibiarkan bisa terlihat lama, lho.",
    l3: "Apa yang kamu unggah seperti jejak kaki di pasir basah — bisa terlihat lama. Mari kita jaga tetap bersih!"
  },
  {
    id: "phishing",
    badge: "Penangkap Amplop Palsu",
    hotspotIcon: "✉️",
    l1: "Awas, ada paket mencurigakan!",
    type: "choice",
    options: [
      { id: "good", label: "🔍 Periksa Pengirim", correct: true },
      { id: "bad", label: "📦 Buka Langsung", correct: false }
    ],
    feedbackGood: "Keren! Memeriksa dulu itu langkah paling aman.",
    feedbackBad: "Wah, hampir saja! Paket tak dikenal bisa berbahaya.",
    l3: "Jangan buka hadiah dari orang tak dikenal di internet. Tanya orang tua dulu sebelum klik."
  },
  {
    id: "sandi",
    badge: "Perangkai Kunci Ajaib",
    hotspotIcon: "🔑",
    l1: "Kunci rapat brankas datamu!",
    type: "lock",
    // Urutan warna yang benar untuk merangkai kunci (disamarkan, bukan sandi asli)
    correctOrder: ["biru", "kuning", "hijau"],
    lockColors: [
      { id: "biru", icon: "🔵" },
      { id: "kuning", icon: "🟡" },
      { id: "hijau", icon: "🟢" },
      { id: "merah", icon: "🔴" }
    ],
    feedbackGood: "Brankas terkunci rapat! Data kamu aman sekarang.",
    feedbackBad: "Urutannya belum pas, coba ingat-ingat lagi urutannya!",
    l3: "Sandi itu kunci rahasia rumahmu. Jangan beri tahu siapa pun agar barang berhargamu aman."
  },
  {
    id: "bully",
    badge: "Sahabat Sejati",
    hotspotIcon: "😢",
    l1: "Temanmu terlihat sedih.",
    type: "choice",
    options: [
      { id: "good", label: "💬 Kirim Kata Baik", correct: true },
      { id: "bad", label: "😅 Ikut Mengejek", correct: false }
    ],
    feedbackGood: "Kamu Sahabat Sejati! Kata baikmu membuat hari lebih cerah.",
    feedbackBad: "Yuk, coba lagi. Kata-kata kita bisa melukai atau menyembuhkan.",
    l3: "Bersikap baik di internet sama pentingnya seperti di dunia nyata. Jika ada yang jahat, laporkan pada orang dewasa."
  }
];

let currentMissionIndex = 0;
let missionStartTime = null;
let lockProgress = [];
let cameraStarted = false;

// ----------------------------------------------------------------------------
// Elemen DOM
// ----------------------------------------------------------------------------
const el = {
  statusChip: document.getElementById("status-chip"),
  statusChipIcon: document.getElementById("status-chip-icon"),
  statusChipText: document.getElementById("status-chip-text"),
  missionBadgeText: document.getElementById("mission-badge-text"),
  scanGuide: document.getElementById("scan-guide"),
  noRoleMsg: document.getElementById("no-role-msg"),
  btnCta: document.getElementById("btn-cta"),
  btnCtaIcon: document.getElementById("btn-cta-icon"),
  btnCtaText: document.getElementById("btn-cta-text"),
  infoSheet: document.getElementById("info-sheet"),
  infoSheetIcon: document.getElementById("info-sheet-icon"),
  infoSheetText: document.getElementById("info-sheet-text"),
  actionSheet: document.getElementById("action-sheet"),
  actionSheetIcon: document.getElementById("action-sheet-icon"),
  actionSheetL1: document.getElementById("action-sheet-l1"),
  actionSheetButtons: document.getElementById("action-sheet-buttons"),
  lockSheet: document.getElementById("lock-sheet"),
  lockTargets: document.getElementById("lock-targets"),
  lockOptions: document.getElementById("lock-options"),
  badgeToast: document.getElementById("badge-toast"),
  badgeToastName: document.getElementById("badge-toast-name"),
  leaderboardSheet: document.getElementById("leaderboard-sheet"),
  leaderboardList: document.getElementById("leaderboard-list"),
  hotspot: document.getElementById("hotspot"),
  mascotLabel: document.getElementById("mascot-label"),
  sceneEl: document.querySelector("a-scene")
};

// ----------------------------------------------------------------------------
// Status chip (Zona Atas)
// ----------------------------------------------------------------------------
function setStatusChip(mode, icon, text) {
  el.statusChip.className = `status-chip status-${mode}`;
  el.statusChipIcon.textContent = icon;
  el.statusChipText.textContent = text;
}

function updateMissionBadge() {
  el.missionBadgeText.textContent = `Misi ${Math.min(currentMissionIndex + 1, MISSIONS.length)} dari ${MISSIONS.length}`;
}

// ----------------------------------------------------------------------------
// Alur kamera & mulai misi pertama (Zona Bawah — tombol CTA tunggal)
// ----------------------------------------------------------------------------
function handleCtaTap() {
  if (!cameraStarted) {
    startCamera();
    return;
  }
  // Jika kamera sudah aktif, CTA berperan sebagai "ketuk hotspot" (mode uji/aksesibilitas
  // tanpa marker fisik) sekaligus jalur utama membuka misi berikutnya.
  openCurrentMissionSheet();
}

function startCamera() {
  const mindarSystem = el.sceneEl.systems["mindar-image-system"];
  if (mindarSystem) {
    mindarSystem.start();
  }
  cameraStarted = true;
  el.scanGuide.style.display = "flex";
  el.btnCtaIcon.textContent = "✨";
  el.btnCtaText.textContent = "Ketuk Penanda AR";
  setStatusChip("info", "📡", "Mencari Penanda...");
  updateMissionBadge();
}

// Saat target AR terdeteksi, sembunyikan panduan pemindaian dan aktifkan hotspot
function onTargetFound() {
  el.scanGuide.style.display = "none";
  setStatusChip("safe", "🛡️", "Sistem Aman");
  el.btnCtaText.textContent = "Ketuk Hotspot";
}
function onTargetLost() {
  el.scanGuide.style.display = "flex";
}

if (el.sceneEl) {
  el.sceneEl.addEventListener("targetFound", onTargetFound);
  el.sceneEl.addEventListener("targetLost", onTargetLost);
}

// ----------------------------------------------------------------------------
// Hotspot AR (Zona Tengah) — satu-satunya elemen interaktif di kanvas 3D
// ----------------------------------------------------------------------------
if (el.hotspot) {
  el.hotspot.addEventListener("click", () => {
    openCurrentMissionSheet();
  });
}

function openCurrentMissionSheet() {
  const mission = MISSIONS[currentMissionIndex];
  if (!mission) {
    showAllMissionsComplete();
    return;
  }
  missionStartTime = performance.now();
  el.mascotLabel.setAttribute("value", mission.l1);

  if (mission.type === "lock") {
    openLockSheet(mission);
  } else {
    openActionSheet(mission);
  }
}

// ----------------------------------------------------------------------------
// L1 + L2 — Lembar pilihan aksi (misi bertipe "choice")
// ----------------------------------------------------------------------------
function openActionSheet(mission) {
  el.actionSheetIcon.textContent = mission.hotspotIcon;
  el.actionSheetL1.textContent = mission.l1;
  el.actionSheetButtons.innerHTML = "";

  mission.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = `opt-btn ${opt.correct ? "opt-good" : "opt-risky"}`;
    btn.textContent = opt.label;
    btn.addEventListener("click", () => resolveMission(mission, opt.correct));
    el.actionSheetButtons.appendChild(btn);
  });

  el.actionSheet.classList.add("open");
}

// ----------------------------------------------------------------------------
// Misi 3 — Rangkai Kunci Ajaib (urutan 3 gembok warna)
// ----------------------------------------------------------------------------
function openLockSheet(mission) {
  lockProgress = [];
  renderLockTargets(mission);

  el.lockOptions.innerHTML = "";
  mission.lockColors.forEach((color) => {
    const btn = document.createElement("button");
    btn.className = "lock-btn";
    btn.style.background = "rgba(255,255,255,0.08)";
    btn.textContent = color.icon;
    btn.addEventListener("click", () => {
      lockProgress.push(color.id);
      renderLockTargets(mission);
      if (lockProgress.length === mission.correctOrder.length) {
        const success = mission.correctOrder.every((c, i) => c === lockProgress[i]);
        setTimeout(() => {
          el.lockSheet.classList.remove("open");
          resolveMission(mission, success);
        }, 350);
      }
    });
    el.lockOptions.appendChild(btn);
  });

  el.lockSheet.classList.add("open");
}

function renderLockTargets(mission) {
  el.lockTargets.innerHTML = "";
  mission.correctOrder.forEach((_, i) => {
    const slot = document.createElement("div");
    slot.className = "lock-slot" + (lockProgress[i] ? " filled" : "");
    if (lockProgress[i]) {
      const found = mission.lockColors.find((c) => c.id === lockProgress[i]);
      slot.textContent = found ? found.icon : "🔒";
    } else {
      slot.textContent = "🔒";
    }
    el.lockTargets.appendChild(slot);
  });
}

// ----------------------------------------------------------------------------
// Resolusi misi: umpan balik singkat + lencana + catat waktu ke leaderboard
// ----------------------------------------------------------------------------
function resolveMission(mission, success) {
  el.actionSheet.classList.remove("open");
  el.lockSheet.classList.remove("open");

  const elapsedMs = missionStartTime ? Math.round(performance.now() - missionStartTime) : null;

  if (success) {
    setStatusChip("safe", "🛡️", "Sistem Aman");
    showBadgeToast(mission.badge);
    if (elapsedMs !== null) {
      logMissionTime(mission.id, elapsedMs);
    }
    currentMissionIndex += 1;
    updateMissionBadge();
    openInfoText(mission.feedbackGood, "🎉");
  } else {
    setStatusChip("warn", "⚠️", "Hati-hati!");
    openInfoText(mission.feedbackBad, "🤔");
    // Anak boleh mencoba kembali misi yang sama — currentMissionIndex tidak berubah.
  }

  if (currentMissionIndex >= MISSIONS.length) {
    setTimeout(showAllMissionsComplete, 1200);
  }
}

function showAllMissionsComplete() {
  el.btnCtaText.textContent = "Lihat Papan Peringkat";
  el.btnCta.onclick = openLeaderboard;
  setStatusChip("safe", "🏅", "Semua Misi Selesai!");
}

// ----------------------------------------------------------------------------
// Lembar info (L3) — dipakai baik untuk ikon ℹ️ maupun umpan balik hasil misi
// ----------------------------------------------------------------------------
function openInfoText(text, icon) {
  el.infoSheetIcon.textContent = icon || "💡";
  el.infoSheetText.textContent = text;
  el.infoSheet.classList.add("open");
}

function openInfoSheet() {
  const mission = MISSIONS[currentMissionIndex] || MISSIONS[MISSIONS.length - 1];
  openInfoText(mission.l3, "💡");
}

function closeInfoSheet(evt) {
  if (evt) evt.stopPropagation();
  el.infoSheet.classList.remove("open");
}

// ----------------------------------------------------------------------------
// Toast lencana (gamifikasi ringan, muncul di Zona Atas)
// ----------------------------------------------------------------------------
function showBadgeToast(name) {
  el.badgeToastName.textContent = name;
  el.badgeToast.classList.add("show");
  setTimeout(() => el.badgeToast.classList.remove("show"), 3200);
}

// ----------------------------------------------------------------------------
// Firebase — Papan Peringkat Penjaga (waktu penyelesaian per misi)
// ----------------------------------------------------------------------------
function logMissionTime(missionId, elapsedMs) {
  const entryRef = push(leaderboardRef);
  set(entryRef, {
    guardian: guardianName,
    mission: missionId,
    elapsedMs,
    completedAt: Date.now()
  }).catch((e) => console.error("Gagal mencatat ke Papan Peringkat:", e));
}

function openLeaderboard() {
  const topQuery = query(leaderboardRef, orderByChild("elapsedMs"), limitToLast(10));
  onValue(topQuery, (snapshot) => {
    const rows = [];
    snapshot.forEach((child) => rows.push(child.val()));
    rows.sort((a, b) => a.elapsedMs - b.elapsedMs);

    el.leaderboardList.innerHTML = rows.length
      ? rows.map((r) => `
          <div class="leaderboard-row">
            <span>${r.guardian} — ${r.mission}</span>
            <span class="lb-time">${(r.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
        `).join("")
      : `<p class="sheet-text">Belum ada Penjaga yang menyelesaikan misi. Jadilah yang pertama!</p>`;
  }, { onlyOnce: true });

  el.leaderboardSheet.classList.add("open");
}

function closeLeaderboard() {
  el.leaderboardSheet.classList.remove("open");
}

// ----------------------------------------------------------------------------
// Cek parameter peran/karakter (opsional, mempertahankan mode multi-pemain)
// ----------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const peran = params.get("peran");
if (!peran) {
  // Tidak wajib: aplikasi tetap berjalan sebagai satu Penjaga tunggal.
  el.noRoleMsg.style.display = "none";
}

// ----------------------------------------------------------------------------
// Ekspor fungsi yang dipakai langsung dari atribut onclick di index.html
// ----------------------------------------------------------------------------
window.PenjagaApp = {
  handleCtaTap,
  openInfoSheet,
  closeInfoSheet,
  closeLeaderboard
};

updateMissionBadge();
