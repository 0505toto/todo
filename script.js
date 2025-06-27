// script.js

// ページの読み込みが完了したら実行される処理
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM要素の取得 ---
    // フォーム関連
    const scheduleForm = document.getElementById('schedule-form');
    const timeInput = document.getElementById('time');
    const allDayCheckbox = document.getElementById('all-day');
    const repeatTypeSelect = document.getElementById('repeat-type');
    const repeatOptionsDiv = document.getElementById('repeat-options');
    const weeklyOptionsDiv = document.getElementById('weekly-options');
    const monthlyOptionsDiv = document.getElementById('monthly-options');
    const holidayForm = document.getElementById('holiday-form');

    // 表示エリア関連
    const scheduleListDiv = document.getElementById('schedule-list');
    const remindersListDiv = document.getElementById('reminders-list');
    const holidayListUl = document.getElementById('holiday-list');

    // --- データ管理 ---
    // スケジュールとカスタム休日データをブラウザのlocalStorageから読み込む
    // データがなければ空の配列[]で初期化
    let schedules = JSON.parse(localStorage.getItem('schedules')) || [];
    let customHolidays = JSON.parse(localStorage.getItem('customHolidays')) || [];

    // --- ユーティリティ関数 ---

    /**
     * 日本の祝日を判定する（簡易版）
     * @param {Date} date - 判定したい日付オブジェクト
     * @returns {boolean} - 祝日ならtrue
     * @note 正確な祝日判定（春分の日など）は複雑なため、ここでは固定の祝日のみを扱います。
     * 会社の創立記念日など、固定の休みはここに追加するか、休日設定機能で追加してください。
     */
    const isJapaneseHoliday = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // getMonthは0から始まるため+1
        const day = date.getDate();
        const holidayList = [
            { month: 1, day: 1, name: '元日' },
            // 成人の日は1月第2月曜のため、ここでは簡略化
            { month: 2, day: 11, name: '建国記念の日' },
            { month: 2, day: 23, name: '天皇誕生日' },
            { month: 4, day: 29, name: '昭和の日' },
            { month: 5, day: 3, name: '憲法記念日' },
            { month: 5, day: 4, name: 'みどりの日' },
            { month: 5, day: 5, name: 'こどもの日' },
            //海の日は7月第3月曜のため、ここでは簡略化
            { month: 8, day: 11, name: '山の日' },
            //敬老の日、秋分の日は省略
            { month: 11, day: 3, name: '文化の日' },
            { month: 11, day: 23, name: '勤労感謝の日' }
        ];
        return holidayList.some(holiday => holiday.month === month && holiday.day === day);
    };

    /**
     * 指定された日が休日（土日・祝日・カスタム休日）かどうかを判定する
     * @param {Date} date - 判定したい日付オブジェクト
     * @returns {boolean} - 休日ならtrue
     */
    const isHoliday = (date) => {
        const dayOfWeek = date.getDay(); // 0:日曜, 6:土曜
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return true; // 土日
        }
        if (isJapaneseHoliday(date)) {
            return true; // 日本の祝日
        }
        // カスタム休日リストに含まれているかチェック
        const dateString = date.toISOString().split('T')[0];
        if (customHolidays.includes(dateString)) {
            return true;
        }
        return false;
    };

    /**
     * 次の営業日を取得する
     * @param {Date} date - 基準となる日付
     * @returns {Date} - 次の営業日の日付オブジェクト
     */
    const getNextBusinessDay = (date) => {
        let nextDay = new Date(date);
        while (isHoliday(nextDay)) {
            nextDay.setDate(nextDay.getDate() + 1);
        }
        return nextDay;
    };

    /**
     * 前の営業日を取得する
     * @param {Date} date - 基準となる日付
     * @returns {Date} - 前の営業日の日付オブジェクト
     */
    const getPrevBusinessDay = (date) => {
        let prevDay = new Date(date);
        while (isHoliday(prevDay)) {
            prevDay.setDate(prevDay.getDate() - 1);
        }
        return prevDay;
    };

    /**
     * 繰り返し予定の次回到来日を計算する
     * @param {object} schedule - スケジュールオブジェクト
     * @returns {Date | null} - 計算された日付オブジェクト、またはnull
     */
    const calculateNextOccurrence = (schedule) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 今日の日付の0時0分0秒に設定
        let nextDate = new Date(schedule.date + 'T00:00:00');

        if (schedule.repeat.type === 'none') {
            return nextDate < today ? null : nextDate; // 過去の予定は表示しない
        }

        // 繰り返し予定の基準日を未来に持ってくる
        while (nextDate < today) {
            if (schedule.repeat.type === 'weekly') {
                nextDate.setDate(nextDate.getDate() + 7);
            } else if (schedule.repeat.type === 'monthly') {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        }
        
        // 毎週の場合、指定の曜日に調整
        if (schedule.repeat.type === 'weekly') {
            const targetDay = parseInt(schedule.repeat.value, 10);
            while(nextDate.getDay() !== targetDay) {
                nextDate.setDate(nextDate.getDate() + 1);
                 // 調整中に今日より前になったら、1週間進める
                if(nextDate < today) {
                    nextDate.setDate(nextDate.getDate() + 7);
                    // 再度曜日を探す
                    while(nextDate.getDay() !== targetDay) {
                         nextDate.setDate(nextDate.getDate() + 1);
                    }
                }
            }
        }
        
        // 休日振替処理
        if (isHoliday(nextDate)) {
            if (schedule.repeat.holidayHandling === 'after') {
                return getNextBusinessDay(nextDate);
            } else {
                return getPrevBusinessDay(nextDate);
            }
        }
        
        return nextDate;
    };


    // --- 描画関数 ---

    /**
     * スケジュール一覧とリマインダーを再描画する
     */
    const renderSchedulesAndReminders = () => {
        scheduleListDiv.innerHTML = '';
        remindersListDiv.innerHTML = '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(today.getDate() + 7);

        const displayItems = [];

        schedules.forEach((schedule, index) => {
            let displayDate;
            if (schedule.repeat.type === 'none') {
                displayDate = new Date(schedule.date + 'T00:00:00');
                if (displayDate < today) return; // 過去の単発予定は表示しない
            } else {
                displayDate = calculateNextOccurrence(schedule);
                if (!displayDate) return; // 表示すべき未来の予定がない場合はスキップ
            }

            displayItems.push({ schedule, displayDate, originalIndex: index });
        });
        
        // 日付順にソート
        displayItems.sort((a, b) => a.displayDate - b.displayDate);

        // HTMLを生成して表示
        displayItems.forEach(item => {
            const { schedule, displayDate, originalIndex } = item;
            
            // スケジュール一覧のHTML
            const scheduleItem = document.createElement('div');
            scheduleItem.classList.add('schedule-item');
            const formattedDate = `${displayDate.getFullYear()}/${displayDate.getMonth() + 1}/${displayDate.getDate()}`;
            const timeString = schedule.allDay ? '終日' : schedule.time;

            scheduleItem.innerHTML = `
                <div class="schedule-date">${formattedDate} (${['日', '月', '火', '水', '木', '金', '土'][displayDate.getDay()]})</div>
                <div class="schedule-time">${timeString || ''}</div>
                <div class="schedule-title">${schedule.title}</div>
                <div class="schedule-member">担当: ${schedule.members.join(', ')}</div>
                <div class="schedule-category">${schedule.category}</div>
                <button class="delete-btn" data-index="${originalIndex}">削除</button>
            `;
            scheduleListDiv.appendChild(scheduleItem);

            // リマインダーのHTML (7日以内の予定)
            if (displayDate <= sevenDaysLater) {
                const diffTime = displayDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const countdownText = diffDays === 0 ? '本日' : `残り${diffDays}日`;

                const reminderItem = document.createElement('div');
                reminderItem.classList.add('reminder-item');
                reminderItem.innerHTML = `
                    <span class="countdown">${countdownText}</span>
                    <span class="reminder-title">${schedule.title} (担当: ${schedule.members.join(', ')})</span>
                `;
                remindersListDiv.appendChild(reminderItem);
            }
        });
    };

    /**
     * カスタム休日リストを再描画する
     */
    const renderHolidays = () => {
        holidayListUl.innerHTML = '';
        // 日付順にソートして表示
        [...customHolidays].sort().forEach((holiday, index) => {
            const li = document.createElement('li');
            li.textContent = holiday;
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '削除';
            deleteBtn.classList.add('delete-holiday-btn');
            deleteBtn.dataset.index = index;
            li.appendChild(deleteBtn);
            holidayListUl.appendChild(li);
        });
    };

    // --- イベントハンドラ ---

    // 予定登録フォーム送信時の処理
    scheduleForm.addEventListener('submit', (e) => {
        e.preventDefault(); // デフォルトのフォーム送信をキャンセル

        const formData = new FormData(scheduleForm);
        const members = formData.getAll('member');
        const weeklyValues = formData.getAll('weekday');

        // 新しいスケジュールオブジェクトを作成
        const newSchedule = {
            id: Date.now(), // ユニークなIDとしてタイムスタンプを使用
            members: members,
            title: formData.get('title'),
            date: formData.get('date'),
            time: formData.get('time'),
            allDay: formData.get('all-day') === 'on',
            repeat: {
                type: formData.get('repeat-type'),
                // 毎週の場合は曜日(0-6)、毎月の場合は日(1-31)を保存
                value: formData.get('repeat-type') === 'weekly' ? weeklyValues[0] : formData.get('monthly-day'),
                holidayHandling: formData.get('holiday-handling')
            },
            category: formData.get('category')
        };
        
        schedules.push(newSchedule);
        localStorage.setItem('schedules', JSON.stringify(schedules)); // localStorageに保存

        renderSchedulesAndReminders(); // 表示を更新
        scheduleForm.reset(); // フォームをリセット
        repeatOptionsDiv.classList.add('hidden'); // 繰り返しオプションを隠す
    });

    // カスタム休日追加フォーム送信時の処理
    holidayForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const holidayDate = document.getElementById('custom-holiday').value;
        if (holidayDate && !customHolidays.includes(holidayDate)) {
            customHolidays.push(holidayDate);
            localStorage.setItem('customHolidays', JSON.stringify(customHolidays));
            renderHolidays();
            renderSchedulesAndReminders(); // スケジュールも影響を受けるので再描画
        }
        holidayForm.reset();
    });

    // 「終日」チェックボックスの変更時
    allDayCheckbox.addEventListener('change', () => {
        timeInput.disabled = allDayCheckbox.checked;
        if (allDayCheckbox.checked) {
            timeInput.value = '';
        }
    });

    // 「繰り返し設定」の変更時
    repeatTypeSelect.addEventListener('change', () => {
        const type = repeatTypeSelect.value;
        repeatOptionsDiv.classList.toggle('hidden', type === 'none');
        weeklyOptionsDiv.classList.toggle('hidden', type !== 'weekly');
        monthlyOptionsDiv.classList.toggle('hidden', type !== 'monthly');
    });
    
    // スケジュール削除ボタンのクリック処理（イベント委譲）
    scheduleListDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const index = e.target.dataset.index;
            schedules.splice(index, 1); // 配列から削除
            localStorage.setItem('schedules', JSON.stringify(schedules)); // 保存
            renderSchedulesAndReminders(); // 再描画
        }
    });
    
    // カスタム休日削除ボタンのクリック処理（イベント委譲）
    holidayListUl.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-holiday-btn')) {
            // ソートされた状態でのインデックスなので、値で検索して削除する
            const holidayToDelete = e.target.parentElement.firstChild.textContent;
            customHolidays = customHolidays.filter(h => h !== holidayToDelete);
            localStorage.setItem('customHolidays', JSON.stringify(customHolidays));
            renderHolidays();
            renderSchedulesAndReminders(); // スケジュールも影響を受けるので再描画
        }
    });


    // --- 初期化処理 ---
    renderSchedulesAndReminders();
    renderHolidays();
});