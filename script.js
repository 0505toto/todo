import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  Timestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.GOOGLE_API_KEY,
  authDomain: "calendar-e2b8d.firebaseapp.com",
  projectId: "calendar-e2b8d",
  storageBucket: "calendar-e2b8d.appspot.com",
  messagingSenderId: "641295023011",
  appId: "1:641295023011:web:659f1fd3283cc9453eb816"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 祝日リスト（任意で追加）
const holidays = [
  "2025-01-01", "2025-02-11", "2025-02-23",
  "2025-03-20", "2025-04-29", "2025-05-03",
  "2025-05-04", "2025-05-05", "2025-07-15"
];

// モーダル制御
const modal = document.getElementById("scheduleModal");
document.getElementById("addScheduleBtn").onclick = () => modal.classList.remove("hidden");
document.getElementById("cancelBtn").onclick = () => modal.classList.add("hidden");

// 定期設定有効化
document.querySelectorAll('input[name="repeatType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const weekly = document.getElementById('weekdaySelect');
    const monthly = document.getElementById('monthlyDate');
    const adjust = document.getElementById('adjustHoliday');
    weekly.disabled = radio.value !== 'weekly';
    monthly.disabled = radio.value !== 'monthly';
    adjust.classList.toggle('hidden', radio.value === 'none');
  });
});

// フォーム送信
document.getElementById("scheduleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const members = Array.from(form.members.selectedOptions).map(o => o.value);
  const title = form.title.value;
  const date = form.date.value;
  const time = form.allDay.checked ? "終日" : form.time.value;
  const category = form.category.value;
  const repeatType = form.repeatType.value;
  const weekday = form.weekdaySelect?.value;
  const monthlyDate = form.monthlyDate?.value;
  const adjust = form.adjustHoliday?.value;

  const scheduleData = {
    members,
    title,
    date,
    time,
    category,
    repeatType,
    weekday,
    monthlyDate,
    adjust,
    createdAt: Timestamp.now()
  };

  try {
    await addDoc(collection(db, "schedules"), scheduleData);
    alert("予定を保存しました！");
    modal.classList.add("hidden");
    form.reset();
    loadSchedules();
  } catch (error) {
    console.error("保存エラー:", error);
  }
});

// スケジュール読み込み＆表示
async function loadSchedules() {
  const list = document.getElementById("scheduleItems");
  list.innerHTML = "";
  const querySnapshot = await getDocs(collection(db, "schedules"));
  const today = new Date();

  querySnapshot.forEach(doc => {
    const data = doc.data();
    let scheduledDate = new Date(data.date + "T00:00");

    // 営業日補正（必要なら）
    if (data.adjust) {
      scheduledDate = adjustDate(scheduledDate, data.adjust);
    }

    const diffDays = Math.floor((scheduledDate - today) / (1000 * 60 * 60 * 24));
    const countdown = diffDays >= 0 && diffDays <= 7 ? `（残り${diffDays}日）` : "";

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${data.title}</strong> ${data.time} - ${data.date} ${countdown}<br>
      担当者: ${data.members.join("、")} / カテゴリ: ${data.category || "なし"}
    `;
    list.appendChild(li);
  });
}

// 営業日補正（土日祝を除く前後の日を探す）
function adjustDate(date, direction) {
  const delta = direction === "before" ? -1 : 1;
  const d = new Date(date);
  while (true) {
    const ymd = d.toISOString().split("T")[0];
    const isHoliday = holidays.includes(ymd);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    if (!isWeekend && !isHoliday) break;
    d.setDate(d.getDate() + delta);
  }
  return d;
}

// 初回読み込み
loadSchedules();
