// DOMの読み込みが完了したら処理を開始
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM要素の取得 ---
    const addTaskForm = document.getElementById('add-task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskPriorityInput = document.getElementById('task-priority');
    const taskDueDateInput = document.getElementById('task-due-date');
    const recurringTypeInput = document.getElementById('recurring-type');
    const recurringOptionsWrapper = document.getElementById('recurring-options-wrapper');
    const weeklyOptions = document.getElementById('weekly-options');
    const monthlyOptions = document.getElementById('monthly-options');
    const autogenerateTimingInput = document.getElementById('autogenerate-timing');
    const taskList = document.getElementById('task-list');
    const completedTaskList = document.getElementById('completed-task-list');

    // --- タスクデータを管理する配列 ---
    // localStorageから読み込むか、なければ空の配列で初期化
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

    // --- イベントリスナーの設定 ---

    // 1. タスク追加フォームの送信イベント
    addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault(); // フォームのデフォルトの送信動作をキャンセル
        addTask();
    });

    // 2. 「繰り返し」の選択肢が変わった時のイベント
    recurringTypeInput.addEventListener('change', updateRecurringOptions);

    // 3. 未完了タスクリストのクリックイベント（完了・削除）
    taskList.addEventListener('click', (e) => {
        if (e.target.classList.contains('complete-btn')) {
            const taskId = e.target.closest('li').dataset.id;
            toggleTaskCompletion(taskId);
        }
        if (e.target.classList.contains('delete-btn')) {
            const taskId = e.target.closest('li').dataset.id;
            deleteTask(taskId);
        }
    });

    // 4. 完了済みタスクリストのクリックイベント（削除のみ）
    completedTaskList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const taskId = e.target.closest('li').dataset.id;
            deleteTask(taskId);
        }
    });


    // --- 関数定義 ---

    /**
     * 新しいタスクを追加する関数
     */
    function addTask() {
        const title = taskTitleInput.value.trim();
        if (title === '') {
            alert('タスク内容を入力してください。');
            return;
        }

        const task = {
            id: Date.now().toString(), // ユニークなIDを生成
            title: title,
            priority: taskPriorityInput.value,
            dueDate: taskDueDateInput.value,
            recurring: {
                type: recurringTypeInput.value,
                value: getRecurringValue(), // 繰り返し設定の値を取得
                autogenerate: autogenerateTimingInput.value,
            },
            isCompleted: false,
            isRecurringTemplate: recurringTypeInput.value !== 'none', // これが繰り返し設定のテンプレートか
        };

        tasks.push(task);
        saveAndRender();
        
        // フォームをリセット
        addTaskForm.reset();
        updateRecurringOptions(); // 繰り返しオプションの表示もリセット
    }
    
    /**
     * 繰り返し設定の値を取得するヘルパー関数
     */
    function getRecurringValue() {
        switch (recurringTypeInput.value) {
            case 'weekly':
                return Array.from(weeklyOptions.querySelectorAll('input:checked')).map(input => input.value);
            case 'monthly':
                return document.getElementById('monthly-day').value;
            case 'specific-date':
                 return taskDueDateInput.value;
            default:
                return null;
        }
    }

    /**
     * タスクの完了状態を切り替える関数
     */
    function toggleTaskCompletion(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.isCompleted = !task.isCompleted;
            saveAndRender();
        }
    }

    /**
     * タスクを削除する関数
     */
    function deleteTask(taskId) {
        // 確認ダイアログを表示
        if (confirm('本当にこのタスクを削除しますか？')) {
            tasks = tasks.filter(t => t.id !== taskId);
            saveAndRender();
        }
    }
    
    /**
     * 「繰り返し」の選択に応じて詳細設定の表示を切り替える関数
     */
    function updateRecurringOptions() {
        // 全てのオプションを一旦非表示に
        weeklyOptions.style.display = 'none';
        monthlyOptions.style.display = 'none';
        recurringOptionsWrapper.style.display = 'none';

        switch (recurringTypeInput.value) {
            case 'weekly':
                weeklyOptions.style.display = 'block';
                recurringOptionsWrapper.style.display = 'block';
                break;
            case 'monthly':
                monthlyOptions.style.display = 'block';
                recurringOptionsWrapper.style.display = 'block';
                break;
        }
    }

    /**
     * ★繰り返しタスクを自動生成する関数
     */
    function generateRecurringTasks() {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 時刻をリセットして日付のみで比較

        const templates = tasks.filter(t => t.isRecurringTemplate);

        templates.forEach(template => {
            if (!template.recurring || template.recurring.autogenerate === 'none') return;
            
            const daysBefore = getDaysBefore(template.recurring.autogenerate);
            if (daysBefore === null) return;
            
            // チェックする未来の期間（例：今日から2週間後まで）
            for (let i = 0; i <= daysBefore; i++) {
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + i);

                let generate = false;
                // 毎週の場合
                if (template.recurring.type === 'weekly' && template.recurring.value.includes(targetDate.getDay().toString())) {
                    generate = true;
                }
                // 毎月の場合
                if (template.recurring.type === 'monthly' && targetDate.getDate().toString() === template.recurring.value) {
                    generate = true;
                }
                // 特定日の場合
                if (template.recurring.type === 'specific-date' && template.recurring.value === formatDate(targetDate)) {
                    generate = true;
                }
                
                if (generate) {
                    const dueDate = new Date(targetDate);
                    dueDate.setDate(targetDate.getDate() + daysBefore);
                    const dueDateString = formatDate(dueDate);
                    
                    // 同じ期日のタスクが既に存在しないかチェック
                    const alreadyExists = tasks.some(t => !t.isRecurringTemplate && t.title === template.title && t.dueDate === dueDateString);
                    
                    if (!alreadyExists) {
                        // 新しいタスクを生成
                        const newTask = {
                            ...template, // テンプレートから設定をコピー
                            id: Date.now().toString() + '-' + template.id, // ユニークID
                            dueDate: dueDateString,
                            isCompleted: false,
                            isRecurringTemplate: false, // これは生成されたタスク
                            recurring: {}, // 生成されたタスク自体は繰り返し設定を持たない
                        };
                        tasks.push(newTask);
                    }
                }
            }
        });
    }

    /**
     * 自動生成タイミングを日数に変換するヘルパー関数
     */
    function getDaysBefore(timing) {
        switch(timing) {
            case '1-day-before': return 1;
            case '3-days-before': return 3;
            case '1-week-before': return 7;
            case '2-weeks-before': return 14;
            default: return null;
        }
    }

    /**
     * DateオブジェクトをYYYY-MM-DD形式の文字列に変換するヘルパー関数
     */
    function formatDate(date) {
        const y = date.getFullYear();
        const m = ('00' + (date.getMonth() + 1)).slice(-2);
        const d = ('00' + date.getDate()).slice(-2);
        return `${y}-${m}-${d}`;
    }

    /**
     * タスクリストを描画（画面に表示）する関数
     */
    function renderTasks() {
        // リストを一旦空にする
        taskList.innerHTML = '';
        completedTaskList.innerHTML = '';

        tasks.filter(t => !t.isRecurringTemplate) // 繰り返しテンプレート自体は表示しない
             .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)) // 期日でソート
             .forEach(task => {
            const taskElement = document.createElement('li');
            taskElement.dataset.id = task.id; // data属性にIDをセット
            
            const priorityClass = `priority-${task.priority}`;

            taskElement.innerHTML = `
                <span class="${priorityClass}">${task.priority.charAt(0).toUpperCase()}</span>
                <div class="task-content">
                    <p class="task-title">${task.title}</p>
                    <p class="task-due">期日: ${task.dueDate || '未設定'}</p>
                </div>
                <div class="task-actions">
                    ${!task.isCompleted ? '<button class="complete-btn">完了</button>' : ''}
                    <button class="delete-btn">削除</button>
                </div>
            `;

            if (task.isCompleted) {
                completedTaskList.appendChild(taskElement);
            } else {
                taskList.appendChild(taskElement);
            }
        });
    }

    /**
     * データをlocalStorageに保存し、画面を再描画する関数
     */
    function saveAndRender() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
    }


    // --- 初期化処理 ---
    updateRecurringOptions(); // 繰り返しオプションの初期表示
    generateRecurringTasks(); // ページ読み込み時に繰り返しタスクを生成
    saveAndRender(); // 最初の描画

});