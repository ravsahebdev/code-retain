// ============================================================
// DATA LAYER
// ============================================================
const DEFAULT_INTERVALS = [1, 3, 7, 15, 30, 60];

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

class QuestionVault {
    constructor() {
        this.questions = [];
        this.load();
        this.ensureRevisionSchedule();
    }

    load() {
        try {
            const data = localStorage.getItem('coderetain_data');
            if (data) {
                const parsed = JSON.parse(data);
                this.questions = parsed.questions || [];
                this.xp = parsed.xp || 0;
                this.streak = parsed.streak || 0;
                this.lastActivity = parsed.lastActivity || null;
                this.username = parsed.username || '';
                this.theme = parsed.theme || 'dark';
                this.optionalFields = Object.assign(this.defaultOptionalFields(), parsed.optionalFields || {});
            } else {
                this.initializeEmptyData();
            }
        } catch (e) {
            this.initializeEmptyData();
        }
    }

    save() {
        localStorage.setItem('coderetain_data', JSON.stringify({
            questions: this.questions,
            xp: this.xp || 0,
            streak: this.streak || 0,
            lastActivity: this.lastActivity || null,
            username: this.username || '',
            theme: this.theme || 'dark',
            optionalFields: this.optionalFields || this.defaultOptionalFields()
        }));
    }

    defaultOptionalFields() {
        return {
            learning: false,
            mistakes: false,
            better: false,
            complexity: false,
            tags: false
        };
    }

    // Starts the user off with a clean, empty vault - no pre-filled tasks.
    // Questions only appear once the user actually creates their own.
    initializeEmptyData() {
        this.questions = [];
        this.xp = 0;
        this.streak = 0;
        this.lastActivity = null;
        this.username = '';
        this.theme = 'dark';
        this.optionalFields = this.defaultOptionalFields();
        this.save();
    }

    ensureRevisionSchedule() {
        const today = new Date().toDateString();
        this.questions.forEach(q => {
            if (!q.nextRevision) {
                q.nextRevision = new Date().toISOString();
            }
            if (!q.revisionIndex && q.revisionIndex !== 0) {
                q.revisionIndex = 0;
            }
            if (!q.revisionCount) {
                q.revisionCount = 0;
            }
            if (!q.confidence) {
                q.confidence = null;
            }
            if (!q.hints) {
                q.hints = [];
            }
        });
        this.save();
    }

    getIntervals() {
        const intervals = [];
        for (let i = 1; i <= 6; i++) {
            const val = document.getElementById(`interval${i}`)?.value;
            intervals.push(parseInt(val) || DEFAULT_INTERVALS[i - 1]);
        }
        return intervals;
    }

    addQuestion(data) {
        const id = Date.now().toString();
        const question = {
            id,
            ...data,
            createdAt: new Date().toISOString(),
            lastRevised: null,
            revisionCount: 0,
            revisionIndex: 0,
            nextRevision: new Date().toISOString(),
            confidence: null,
            hints: this.generateHints(data.statement)
        };
        this.questions.unshift(question);
        this.addXP(10);
        this.updateStreak();
        this.save();
        return question;
    }

    updateQuestion(id, data) {
        const index = this.questions.findIndex(q => q.id === id);
        if (index !== -1) {
            this.questions[index] = { ...this.questions[index], ...data };
            this.save();
            return this.questions[index];
        }
        return null;
    }

    deleteQuestion(id) {
        this.questions = this.questions.filter(q => q.id !== id);
        this.save();
    }

    toggleFavorite(id) {
        const q = this.questions.find(q => q.id === id);
        if (q) {
            q.favorite = !q.favorite;
            this.save();
        }
    }

    toggleMastered(id) {
        const q = this.questions.find(q => q.id === id);
        if (q) {
            q.mastered = !q.mastered;
            if (q.mastered) {
                q.nextRevision = null;
            } else {
                q.nextRevision = new Date().toISOString();
                q.revisionIndex = 0;
            }
            this.save();
        }
    }

    generateHints(statement) {
        const hints = [];
        if (statement.toLowerCase().includes('array')) {
            hints.push('Consider using a hash map or two-pointer technique.');
        }
        if (statement.toLowerCase().includes('string')) {
            hints.push('Think about using a stack or sliding window.');
        }
        if (statement.toLowerCase().includes('linked list')) {
            hints.push('Consider using a dummy head or two-pointer technique.');
        }
        if (hints.length === 0) {
            hints.push('Break down the problem into smaller steps.', 'Think about edge cases.');
        }
        return hints;
    }

    getDueQuestions() {
        const today = new Date().toDateString();
        return this.questions.filter(q => {
            if (q.mastered) return false;
            if (!q.nextRevision) return false;
            const dueDate = new Date(q.nextRevision).toDateString();
            return dueDate <= today;
        });
    }

    getStats() {
        const total = this.questions.length;
        const mastered = this.questions.filter(q => q.mastered).length;
        const needRevision = this.questions.filter(q => !q.mastered).length;
        const due = this.getDueQuestions().length;
        const favorite = this.questions.filter(q => q.favorite).length;
        const overdue = this.questions.filter(q => {
            if (q.mastered) return false;
            if (!q.nextRevision) return false;
            return new Date(q.nextRevision) < new Date();
        }).length;
        return { total, mastered, needRevision, due, favorite, overdue };
    }

    getTopics() {
        const topics = {};
        this.questions.forEach(q => {
            topics[q.topic] = (topics[q.topic] || 0) + 1;
        });
        return topics;
    }

    getDifficulties() {
        const diffs = { Easy: 0, Medium: 0, Hard: 0 };
        this.questions.forEach(q => {
            if (diffs[q.difficulty] !== undefined) {
                diffs[q.difficulty]++;
            }
        });
        return diffs;
    }

    getRecentQuestions(limit = 5) {
        return this.questions.slice(0, limit);
    }

    getRevisionHistory() {
        const history = [];
        const now = new Date();
        for (let i = 30; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const count = Math.floor(Math.random() * 3) + (i % 2 === 0 ? 1 : 0);
            history.push({
                date: date.toISOString().split('T')[0],
                count
            });
        }
        return history;
    }

    addXP(amount) {
        this.xp = (this.xp || 0) + amount;
        this.save();
    }

    updateStreak() {
        const today = new Date().toDateString();
        const last = this.lastActivity ? new Date(this.lastActivity).toDateString() : null;
        if (last === today) return;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (last === yesterday.toDateString()) {
            this.streak = (this.streak || 0) + 1;
        } else {
            this.streak = 1;
        }
        this.lastActivity = new Date().toISOString();
        this.save();
    }

    processRevision(id, confidence) {
        const q = this.questions.find(q => q.id === id);
        if (!q) return;

        q.lastRevised = new Date().toISOString();
        q.revisionCount = (q.revisionCount || 0) + 1;
        q.confidence = confidence;

        const intervals = this.getIntervals();
        const nextIndex = Math.min(q.revisionIndex || 0, intervals.length - 1);
        const days = intervals[nextIndex] || 1;

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + days);
        q.nextRevision = nextDate.toISOString();
        q.revisionIndex = nextIndex + 1;

        let xpBonus = 20;
        if (confidence >= 4) xpBonus = 40;
        else if (confidence >= 3) xpBonus = 30;
        this.addXP(xpBonus);

        if (confidence >= 4 && q.revisionCount >= 3) {
            q.mastered = true;
            q.nextRevision = null;
        }

        this.updateStreak();
        this.save();
        return q;
    }

    getLevel() {
        const xp = this.xp || 0;
        if (xp < 100) return { name: 'Beginner', level: 1 };
        if (xp < 250) return { name: 'Learner', level: 2 };
        if (xp < 500) return { name: 'Explorer', level: 3 };
        if (xp < 1000) return { name: 'Advanced', level: 4 };
        if (xp < 2000) return { name: 'Expert', level: 5 };
        return { name: 'Master', level: 6 };
    }

    exportJSON() {
        return JSON.stringify({
            questions: this.questions,
            xp: this.xp,
            streak: this.streak,
            lastActivity: this.lastActivity,
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    importJSON(data) {
        try {
            const parsed = JSON.parse(data);
            if (parsed.questions) {
                this.questions = parsed.questions;
                this.xp = parsed.xp || 0;
                this.streak = parsed.streak || 0;
                this.lastActivity = parsed.lastActivity || null;
                this.save();
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    reset() {
        localStorage.removeItem('coderetain_data');
        this.initializeEmptyData();
        return true;
    }
}

// ============================================================
// APP CONTROLLER
// ============================================================
class App {
    constructor() {
        this.vault = new QuestionVault();
        this.currentPage = 'dashboard';
        this.charts = {};
        this.editingId = null;
        this.revisionQueue = [];
        this.currentRevisionIndex = 0;
        this.revisionStep = 0;
        this.selectedConfidence = null;

        this.init();
    }

    init() {
        this.initTheme();
        this.bindEvents();
        this.renderDashboard();
        this.renderQuestions();
        this.renderRevision();
        this.renderStatistics();
        this.updateBadges();
        this.updateXP();
        this.setupIntervalDefaults();
        this.updateSidebarProfile();
        this.applyOptionalFieldVisibility();
        this.setupOptionalFieldToggles();
    }

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        document.getElementById('mobileToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        document.getElementById('quickCapture').addEventListener('click', () => {
            this.openModal();
        });

        document.getElementById('addQuestionBtn').addEventListener('click', () => {
            this.openModal();
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('formCancel').addEventListener('click', () => {
            this.closeModal();
        });
        document.getElementById('questionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveQuestion();
        });

        document.getElementById('searchInput').addEventListener('input', () => {
            this.renderQuestions();
        });
        document.getElementById('filterDifficulty').addEventListener('change', () => {
            this.renderQuestions();
        });
        document.getElementById('filterTopic').addEventListener('change', () => {
            this.renderQuestions();
        });
        document.getElementById('filterStatus').addEventListener('change', () => {
            this.renderQuestions();
        });

        document.getElementById('revisionModalClose').addEventListener('click', () => {
            document.getElementById('revisionModal').classList.remove('open');
        });

        document.getElementById('exportJsonBtn').addEventListener('click', () => {
            this.exportJSON();
        });
        document.getElementById('exportMarkdownBtn').addEventListener('click', () => {
            this.exportMarkdown();
        });
        document.getElementById('importJsonBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.importJSON(e);
        });
        document.getElementById('resetDataBtn').addEventListener('click', () => {
            this.showConfirm(
                'Delete all data?',
                "This will permanently remove every saved question, your XP, streak, and settings. Once deleted, this can't be recovered.",
                'Yes, delete everything',
                () => {
                    this.vault.reset();
                    this.refreshAll();
                    this.initTheme();
                    this.updateSidebarProfile();
                    document.getElementById('usernameInput').value = '';
                    this.syncOptionalFieldCheckboxes();
                    this.applyOptionalFieldVisibility();
                    this.showNotification('🗑️ All data deleted.');
                }
            );
        });

        document.querySelectorAll('.interval-inputs input').forEach(input => {
            input.addEventListener('change', () => {
                this.vault.save();
            });
        });

        // ===== Theme toggle (sidebar) =====
        document.getElementById('darkModeToggleSidebar').addEventListener('change', (e) => {
            this.setTheme(e.target.checked ? 'dark' : 'light');
        });

        // ===== Profile: username =====
        const usernameInput = document.getElementById('usernameInput');
        usernameInput.addEventListener('input', () => {
            this.vault.username = usernameInput.value;
            this.vault.save();
            this.updateSidebarProfile();
        });

        // ===== Revision settings info button =====
        document.getElementById('revisionInfoBtn').addEventListener('click', () => {
            this.showInfoModal(
                'Revision Intervals',
                `<h4>English</h4>
                <p>These numbers decide when a saved question comes back to you for review. The 1st number is how many days until the first revision, the 2nd is how many days after that one, and so on. Answer confidently during a revision and you move further down the list — meaning longer gaps between reviews. Struggle with a question and it comes back to you sooner.</p>
                <h4>हिंदी</h4>
                <p>ये नंबर तय करते हैं कि कोई saved question दोबारा revise करने के लिए कब वापस आएगा। पहला नंबर बताता है कि पहला revision कितने दिन बाद होगा, दूसरा नंबर उसके कितने दिन बाद अगला होगा, और इसी तरह आगे। अगर आप revision में confident जवाब देते हो, तो अगली बार interval बड़ा हो जाता है यानी question देर से वापस आएगा। अगर जवाब सही से नहीं आता, तो वो जल्दी वापस आ जाएगा।</p>`
            );
        });

        // ===== Fullpage answer/explanation views =====
        document.getElementById('answerPageClose').addEventListener('click', () => {
            document.getElementById('answerPage').classList.remove('open');
        });
        document.getElementById('explanationPageClose').addEventListener('click', () => {
            document.getElementById('explanationPage').classList.remove('open');
        });

        // ===== Generic confirm modal =====
        document.getElementById('confirmModalCancel').addEventListener('click', () => {
            this.closeConfirm();
        });
        document.getElementById('confirmModalConfirm').addEventListener('click', () => {
            const cb = this._confirmCallback;
            this.closeConfirm();
            if (cb) cb();
        });

        // ===== Generic info modal =====
        document.getElementById('infoModalClose').addEventListener('click', () => {
            document.getElementById('infoModal').classList.remove('open');
        });

        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('mobileToggle');
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });

        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('open');
                }
            });
        });
    }

    navigateTo(page) {
        this.currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

        if (page === 'revision') {
            this.renderRevision();
        } else if (page === 'statistics') {
            setTimeout(() => this.renderStatistics(), 100);
        }
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    }

    refreshAll() {
        this.renderDashboard();
        this.renderQuestions();
        this.renderRevision();
        this.renderStatistics();
        this.updateBadges();
        this.updateXP();
    }

    // ===== DASHBOARD =====
    renderDashboard() {
        const stats = this.vault.getStats();
        const total = stats.total;
        const needRevision = stats.needRevision;
        const mastered = stats.mastered;
        const due = stats.due;
        const level = this.vault.getLevel();

        const statsGrid = document.getElementById('statsGrid');
        const statConfigs = [
            { icon: 'fa-database', label: 'Total Saved', value: total, color: '#3b82f6' },
            { icon: 'fa-sync-alt', label: 'Need Revision', value: needRevision, color: '#f59e0b' },
            { icon: 'fa-check-circle', label: 'Mastered', value: mastered, color: '#10b981' },
            { icon: 'fa-calendar-day', label: "Today's Revision", value: due, color: '#7c3aed' }
        ];

        statsGrid.innerHTML = statConfigs.map((s, i) => `
                    <div class="stat-card card glass" style="animation: slideUp 0.4s ease ${i * 0.1}s both;">
                        <div class="stat-icon" style="background: ${s.color}20; color: ${s.color};">
                            <i class="fas ${s.icon}"></i>
                        </div>
                        <div class="stat-info">
                            <h4>${s.label}</h4>
                            <div class="value">${s.value}</div>
                        </div>
                    </div>
                `).join('');

        document.getElementById('todayStats').innerHTML = `
                    <div class="today-stat-item">
                        <span class="label">Due for revision</span>
                        <span class="value" style="color: var(--accent-purple);">${due}</span>
                    </div>
                    <div class="today-stat-item">
                        <span class="label">Overdue</span>
                        <span class="value" style="color: var(--accent-red);">${stats.overdue || 0}</span>
                    </div>
                    <div class="today-stat-item">
                        <span class="label">Mastery rate</span>
                        <span class="value" style="color: var(--accent-green);">${total ? Math.round((mastered / total) * 100) : 0}%</span>
                    </div>
                    <div class="today-stat-item">
                        <span class="label">Level</span>
                        <span class="value" style="color: var(--accent-orange);">${level.name} (Lvl ${level.level})</span>
                    </div>
                    <div class="today-stat-item">
                        <span class="label">Streak</span>
                        <span class="value" style="color: var(--accent-orange);">
                            <i class="fas fa-fire" style="color: var(--accent-orange);"></i> ${this.vault.streak || 0} days
                        </span>
                    </div>
                `;

        const recent = this.vault.getRecentQuestions(5);
        const recentContainer = document.getElementById('recentQuestions');
        if (recent.length === 0) {
            recentContainer.innerHTML = `
                        <div style="text-align: center; padding: 30px 20px; color: var(--text-secondary);">
                            <i class="fas fa-inbox" style="font-size: 28px; margin-bottom: 8px; display: block;"></i>
                            No questions saved yet.
                        </div>
                    `;
        } else {
            recentContainer.innerHTML = recent.map(q => `
                        <div class="revision-item glass" style="padding: 10px 14px; border-radius: 10px; margin-bottom: 6px; cursor: pointer;" onclick="app.viewQuestion('${q.id}')">
                            <div class="r-left">
                                <div class="r-title">${q.title}</div>
                                <div class="r-meta">
                                    <span class="tag-difficulty tag-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                                    <span>${q.topic}</span>
                                    <span>${new Date(q.createdAt).toLocaleDateString()}</span>
                                    ${q.favorite ? '<i class="fas fa-star" style="color: var(--accent-orange);"></i>' : ''}
                                </div>
                            </div>
                            <div class="r-right">
                                ${q.mastered ? '<span style="color: var(--accent-green); font-size: 12px;"><i class="fas fa-check-circle"></i> Mastered</span>' : ''}
                            </div>
                        </div>
                    `).join('');
        }

        setTimeout(() => this.renderProgressChart(), 100);
    }

    renderProgressChart() {
        const ctx = document.getElementById('progressChart');
        if (!ctx) return;

        if (this.charts.progress) {
            this.charts.progress.destroy();
        }

        const stats = this.vault.getStats();
        const data = [stats.mastered, stats.needRevision, stats.due];
        const total = data.reduce((a, b) => a + b, 0);

        if (total === 0) {
            this.charts.progress = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#2a2a3e'],
                        borderColor: ['#2a2a3e'],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    cutout: '65%'
                }
            });
            return;
        }

        this.charts.progress = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Mastered', 'Need Revision', 'Due Today'],
                datasets: [{
                    data: data,
                    backgroundColor: ['#10b981', '#f59e0b', '#7c3aed'],
                    borderColor: ['#10b981', '#f59e0b', '#7c3aed'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            boxWidth: 10,
                            padding: 8,
                            font: { size: 10 }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    // ===== QUESTIONS =====
    renderQuestions() {
        const search = document.getElementById('searchInput').value.toLowerCase();
        const difficulty = document.getElementById('filterDifficulty').value;
        const topic = document.getElementById('filterTopic').value;
        const status = document.getElementById('filterStatus').value;

        let filtered = this.vault.questions;

        if (search) {
            filtered = filtered.filter(q =>
                q.title.toLowerCase().includes(search) ||
                q.topic.toLowerCase().includes(search) ||
                (q.tags && q.tags.some(t => t.toLowerCase().includes(search)))
            );
        }
        if (difficulty) {
            filtered = filtered.filter(q => q.difficulty === difficulty);
        }
        if (topic) {
            filtered = filtered.filter(q => q.topic === topic);
        }
        if (status === 'need-revision') {
            filtered = filtered.filter(q => !q.mastered);
        } else if (status === 'mastered') {
            filtered = filtered.filter(q => q.mastered);
        } else if (status === 'favorite') {
            filtered = filtered.filter(q => q.favorite);
        }

        const grid = document.getElementById('questionsGrid');
        if (filtered.length === 0) {
            grid.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                            <i class="fas fa-search" style="font-size: 28px; margin-bottom: 12px; display: block;"></i>
                            <h3 style="font-size: 16px;">No questions found</h3>
                            <p style="margin-top: 4px; font-size: 13px;">Try adjusting your search or filter criteria.</p>
                        </div>
                    `;
            return;
        }

        grid.innerHTML = filtered.map(q => `
                    <div class="question-card card glass" onclick="app.viewQuestion('${q.id}')">
                        <div class="q-header">
                            <div class="q-title">${q.title}</div>
                            <div>
                                ${q.favorite ? '<i class="fas fa-star q-favorite"></i> ' : ''}
                                ${q.mastered ? '<i class="fas fa-check-circle q-mastered"></i>' : ''}
                            </div>
                        </div>
                        <div class="q-meta">
                            <span class="tag-difficulty tag-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                            <span class="tag">${q.topic}</span>
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin: 6px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${q.statement || 'No statement provided.'}
                        </div>
                        ${q.tags && q.tags.length ? `
                            <div class="q-tags">
                                ${q.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
                            ${q.revisionCount || 0} revisions • ${q.lastRevised ? `Last revised ${new Date(q.lastRevised).toLocaleDateString()}` : 'Not revised yet'}
                        </div>
                    </div>
                `).join('');
    }

    // ===== REVISION =====
    renderRevision() {
        const due = this.vault.getDueQuestions();
        const list = document.getElementById('revisionList');
        const badge = document.getElementById('revisionBadge');
        badge.textContent = due.length;

        if (due.length === 0) {
            list.innerHTML = `
                        <div class="revision-empty glass" style="border-radius: 14px; padding: 40px 20px;">
                            <i class="fas fa-check-circle" style="color: var(--accent-green); font-size: 32px;"></i>
                            <h3 style="margin-bottom: 4px; font-size: 17px;">All caught up!</h3>
                            <p style="font-size: 13px;">No questions due for revision today.</p>
                        </div>
                    `;
            return;
        }

        list.innerHTML = due.map(q => `
                    <div class="revision-item glass" onclick="app.startRevision('${q.id}')">
                        <div class="r-left">
                            <div class="r-title">${q.title}</div>
                            <div class="r-meta">
                                <span class="tag-difficulty tag-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                                <span>${q.topic}</span>
                                <span>Due: ${new Date(q.nextRevision).toLocaleDateString()}</span>
                                <span>Revisions: ${q.revisionCount || 0}</span>
                            </div>
                        </div>
                        <div class="r-right">
                            <button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="event.stopPropagation(); app.startRevision('${q.id}')">
                                <i class="fas fa-play"></i> Review
                            </button>
                        </div>
                    </div>
                `).join('');
    }

    startRevision(id) {
        const q = this.vault.questions.find(q => q.id === id);
        if (!q) return;

        this.revisionQueue = [q];
        this.currentRevisionIndex = 0;
        this.revisionStep = 0;
        this.selectedConfidence = null;

        document.getElementById('revisionModal').classList.add('open');
        this.renderRevisionStep();
    }

    renderRevisionStep() {
        const q = this.revisionQueue[this.currentRevisionIndex];
        if (!q) return;

        const container = document.getElementById('revisionContent');
        const step = this.revisionStep;

        if (step === 0) {
            container.innerHTML = `
                        <div class="revision-step">
                            <div class="step-title">📝 Step 1: Recall</div>
                            <div style="margin: 12px 0;">
                                <span class="tag-difficulty tag-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                                <span class="tag">${q.topic}</span>
                            </div>
                            <h3 style="font-size: 18px; margin-bottom: 12px;">${q.title}</h3>
                            <div class="question-text">${q.statement || 'No statement provided.'}</div>
                            
                            <div style="margin-top: 20px;">
                                <p style="color: var(--text-secondary); margin-bottom: 10px; font-size: 14px;">Can you solve this?</p>
                                <div class="revision-buttons">
                                    <button class="btn-yes" onclick="app.revisionAnswer('yes')">Yes</button>
                                    <button class="btn-almost" onclick="app.revisionAnswer('almost')">Almost</button>
                                    <button class="btn-no" onclick="app.revisionAnswer('no')">No</button>
                                </div>
                            </div>
                        </div>
                    `;
        } else if (step === 1) {
            container.innerHTML = `
                        <div class="revision-step">
                            <div class="step-title">💡 Hints</div>
                            <p style="color: var(--text-secondary); margin-bottom: 12px; font-size: 14px;">Review these hints and try again:</p>
                            ${q.hints && q.hints.length ? q.hints.map(h => `
                                <div class="hint-text">${h}</div>
                            `).join('') : `
                                <div class="hint-text">Think about the problem from a different angle.</div>
                                <div class="hint-text">Consider breaking it down into smaller steps.</div>
                            `}
                            <div class="revision-buttons">
                                <button class="btn-yes" onclick="app.revisionAnswer('yes')">Now I can solve it</button>
                                <button class="btn-no" onclick="app.revisionAnswer('no')">Show answer</button>
                            </div>
                        </div>
                    `;
        } else if (step === 2) {
            container.innerHTML = `
                        <div class="revision-step">
                            <div class="step-title">📖 Review Solution</div>
                            <div style="margin: 12px 0;">
                                <strong style="font-size: 13px;">Your Answer:</strong>
                                <div class="answer-reveal">${q.answer || 'No answer provided.'}</div>
                            </div>
                            ${q.explanation ? `
                                <div style="margin: 12px 0;">
                                    <strong style="font-size: 13px;">Explanation:</strong>
                                    <div class="answer-reveal" style="border-left-color: var(--accent-blue); background: rgba(59, 130, 246, 0.08);">${q.explanation}</div>
                                </div>
                            ` : ''}
                            ${(this.vault.optionalFields || {}).learning && q.learning ? `
                                <div style="margin: 12px 0;">
                                    <strong style="font-size: 13px;">Key Learning:</strong>
                                    <div class="answer-reveal" style="border-left-color: var(--accent-orange); background: rgba(245, 158, 11, 0.08);">${q.learning}</div>
                                </div>
                            ` : ''}
                            ${(this.vault.optionalFields || {}).better && q.better ? `
                                <div style="margin: 12px 0;">
                                    <strong style="font-size: 13px;">Better Approach:</strong>
                                    <div class="answer-reveal" style="border-left-color: var(--accent-green); background: rgba(16, 185, 129, 0.08);">${q.better}</div>
                                </div>
                            ` : ''}
                            ${(this.vault.optionalFields || {}).complexity && (q.timeComplexity || q.spaceComplexity) ? `
                                <div style="margin: 12px 0; display: flex; gap: 10px; flex-wrap: wrap;">
                                    ${q.timeComplexity ? `<span class="tag" style="font-size: 11px;">Time: ${q.timeComplexity}</span>` : ''}
                                    ${q.spaceComplexity ? `<span class="tag" style="font-size: 11px;">Space: ${q.spaceComplexity}</span>` : ''}
                                </div>
                            ` : ''}
                            
                            <div style="margin-top: 20px;">
                                <p style="color: var(--text-secondary); margin-bottom: 10px; font-size: 14px;">How confident are you?</p>
                                <div class="confidence-rating" id="confidenceRating">
                                    ${[1, 2, 3, 4, 5].map(c => `
                                        <button data-confidence="${c}" onclick="app.selectConfidence(${c})">${'⭐'.repeat(c)}</button>
                                    `).join('')}
                                </div>
                                <div class="revision-buttons" style="margin-top: 10px;">
                                    <button class="btn-primary" onclick="app.submitRevision()" id="submitRevisionBtn" disabled>Submit Review</button>
                                </div>
                            </div>
                        </div>
                    `;
        }
    }

    revisionAnswer(answer) {
        const q = this.revisionQueue[this.currentRevisionIndex];
        if (!q) return;

        if (answer === 'yes') {
            this.revisionStep = 2;
            this.renderRevisionStep();
        } else if (answer === 'almost') {
            this.revisionStep = 1;
            this.renderRevisionStep();
        } else if (answer === 'no') {
            this.revisionStep = 2;
            this.renderRevisionStep();
        }
    }

    selectConfidence(level) {
        this.selectedConfidence = level;
        document.querySelectorAll('.confidence-rating button').forEach(b => {
            b.classList.toggle('selected', parseInt(b.dataset.confidence) === level);
        });
        document.getElementById('submitRevisionBtn').disabled = false;
    }

    submitRevision() {
        if (!this.selectedConfidence) return;
        const q = this.revisionQueue[this.currentRevisionIndex];
        if (!q) return;

        this.vault.processRevision(q.id, this.selectedConfidence);
        document.getElementById('revisionModal').classList.remove('open');
        this.refreshAll();

        const emoji = this.selectedConfidence >= 4 ? '🎉' : this.selectedConfidence >= 3 ? '👍' : '💪';
        const msg = this.selectedConfidence >= 4 ? 'Perfect recall! +40 XP' :
            this.selectedConfidence >= 3 ? 'Good job! +30 XP' : 'Keep practicing! +20 XP';

        this.showNotification(`${emoji} ${msg}`);

        const due = this.vault.getDueQuestions();
        if (due.length > 0) {
            setTimeout(() => {
                if (confirm(`You have ${due.length} more question(s) due for revision. Review them now?`)) {
                    this.startRevision(due[0].id);
                }
            }, 500);
        }
    }

    // ===== STATISTICS =====
    renderStatistics() {
        setTimeout(() => {
            this.renderTopicChart();
            this.renderDifficultyChart();
            this.renderRevisionHistoryChart();
        }, 100);
    }

    renderTopicChart() {
        const ctx = document.getElementById('topicChart');
        if (!ctx) return;
        if (this.charts.topic) this.charts.topic.destroy();

        const topics = this.vault.getTopics();
        const labels = Object.keys(topics);
        const data = Object.values(topics);

        this.charts.topic = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['No Data'],
                datasets: [{
                    label: 'Questions',
                    data: labels.length ? data : [0],
                    backgroundColor: 'rgba(124, 58, 237, 0.6)',
                    borderColor: '#7c3aed',
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8', stepSize: 1, font: { size: 10 } }
                    },
                    x: {
                        ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 45 }
                    }
                }
            }
        });
    }

    renderDifficultyChart() {
        const ctx = document.getElementById('difficultyChart');
        if (!ctx) return;
        if (this.charts.difficulty) this.charts.difficulty.destroy();

        const diffs = this.vault.getDifficulties();
        const colors = ['#10b981', '#f59e0b', '#ef4444'];
        const data = [diffs.Easy, diffs.Medium, diffs.Hard];
        const total = data.reduce((a, b) => a + b, 0);

        if (total === 0) {
            this.charts.difficulty = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#2a2a3e'],
                        borderColor: ['#2a2a3e'],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    cutout: '60%'
                }
            });
            return;
        }

        this.charts.difficulty = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Easy', 'Medium', 'Hard'],
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            boxWidth: 10,
                            padding: 6,
                            font: { size: 10 }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    renderRevisionHistoryChart() {
        const ctx = document.getElementById('revisionHistoryChart');
        if (!ctx) return;
        if (this.charts.history) this.charts.history.destroy();

        const history = this.vault.getRevisionHistory();
        const labels = history.map(d => d.date);
        const data = history.map(d => d.count);

        this.charts.history = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revisions',
                    data: data,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8', stepSize: 1, font: { size: 10 } }
                    },
                    x: {
                        ticks: { color: '#94a3b8', font: { size: 8 }, maxTicksLimit: 15 }
                    }
                }
            }
        });
    }

    // ===== QUESTION CRUD =====
    openModal(data) {
        const modal = document.getElementById('questionModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('questionForm');
        const id = document.getElementById('questionId');

        if (data) {
            title.textContent = 'Edit Question';
            this.editingId = data.id;
            document.getElementById('formTitle').value = data.title || '';
            document.getElementById('formDifficulty').value = data.difficulty || 'Medium';
            document.getElementById('formTopic').value = data.topic || 'Array';
            document.getElementById('formStatement').value = data.statement || '';
            document.getElementById('formAnswer').value = data.answer || '';
            document.getElementById('formExplanation').value = data.explanation || '';
            document.getElementById('formLearning').value = data.learning || '';
            document.getElementById('formMistakes').value = data.mistakes || '';
            document.getElementById('formBetter').value = data.better || '';
            document.getElementById('formTimeComplexity').value = data.timeComplexity || '';
            document.getElementById('formSpaceComplexity').value = data.spaceComplexity || '';
            document.getElementById('formTags').value = (data.tags || []).join(', ');
        } else {
            title.textContent = 'Add Question';
            this.editingId = null;
            form.reset();
            document.getElementById('questionId').value = '';
            document.getElementById('formDifficulty').value = 'Medium';
            document.getElementById('formTopic').value = 'Array';
        }

        this.applyOptionalFieldVisibility();
        modal.classList.add('open');
    }

    closeModal() {
        document.getElementById('questionModal').classList.remove('open');
        this.editingId = null;
    }

    saveQuestion() {
        const data = {
            title: document.getElementById('formTitle').value.trim(),
            difficulty: document.getElementById('formDifficulty').value,
            topic: document.getElementById('formTopic').value,
            statement: document.getElementById('formStatement').value.trim(),
            answer: document.getElementById('formAnswer').value.trim(),
            explanation: document.getElementById('formExplanation').value.trim()
        };

        // Only persist the extra fields the user has turned on in Settings.
        const of = this.vault.optionalFields || {};
        if (of.learning) data.learning = document.getElementById('formLearning').value.trim();
        if (of.mistakes) data.mistakes = document.getElementById('formMistakes').value.trim();
        if (of.better) data.better = document.getElementById('formBetter').value.trim();
        if (of.complexity) {
            data.timeComplexity = document.getElementById('formTimeComplexity').value.trim();
            data.spaceComplexity = document.getElementById('formSpaceComplexity').value.trim();
        }
        if (of.tags) {
            data.tags = document.getElementById('formTags').value.split(',').map(t => t.trim()).filter(Boolean);
        }

        if (!data.title) {
            this.showNotification('Please enter a title.');
            return;
        }

        if (this.editingId) {
            // favorite/mastered are managed from the question detail view, not this form -
            // leaving them out of `data` means updateQuestion won't touch them.
            this.vault.updateQuestion(this.editingId, data);
            this.showNotification('✅ Question updated!');
        } else {
            data.favorite = false;
            data.mastered = false;
            this.vault.addQuestion(data);
            this.showNotification('✅ Question saved! +10 XP');
        }

        this.closeModal();
        this.refreshAll();
    }

    viewQuestion(id) {
        const q = this.vault.questions.find(q => q.id === id);
        if (!q) return;
        this.openDetailModal(q);
    }

    // ===== QUESTION DETAIL (view-only) =====
    openDetailModal(q) {
        this.renderQuestionDetail(q);
        document.getElementById('questionDetailModal').classList.add('open');
    }

    closeDetailModal() {
        document.getElementById('questionDetailModal').classList.remove('open');
    }

    renderQuestionDetail(id) {
        // Accept either an id or a question object for convenience.
        const q = typeof id === 'string' ? this.vault.questions.find(x => x.id === id) : id;
        if (!q) return;

        const of = this.vault.optionalFields || {};
        const extraSection = (label, value, colorVar) => `
            <div class="detail-section">
                <h4>${label}</h4>
                <div class="answer-reveal" style="border-left-color: var(${colorVar});">${escapeHtml(value)}</div>
            </div>
        `;

        let extraHtml = '';
        if (of.learning && q.learning) extraHtml += extraSection('Key Learning', q.learning, '--accent-orange');
        if (of.mistakes && q.mistakes) extraHtml += extraSection('Mistakes Made', q.mistakes, '--accent-red');
        if (of.better && q.better) extraHtml += extraSection('Better Approach', q.better, '--accent-green');
        if (of.complexity && (q.timeComplexity || q.spaceComplexity)) {
            extraHtml += `
                <div class="detail-section">
                    <h4>Complexity</h4>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${q.timeComplexity ? `<span class="tag">Time: ${escapeHtml(q.timeComplexity)}</span>` : ''}
                        ${q.spaceComplexity ? `<span class="tag">Space: ${escapeHtml(q.spaceComplexity)}</span>` : ''}
                    </div>
                </div>
            `;
        }
        if (of.tags && q.tags && q.tags.length) {
            extraHtml += `
                <div class="detail-section">
                    <h4>Tags</h4>
                    <div class="q-tags">${q.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
                </div>
            `;
        }

        const html = `
            <div class="modal-header">
                <h2>${escapeHtml(q.title)}</h2>
                <button class="modal-close" id="detailModalClose"><i class="fas fa-times"></i></button>
            </div>
            <div class="detail-tags">
                <span class="tag-difficulty tag-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
                <span class="tag">${escapeHtml(q.topic)}</span>
            </div>
            <div class="detail-section">
                <h4>Question Statement</h4>
                <div class="question-text">${q.statement ? escapeHtml(q.statement) : 'No statement provided.'}</div>
            </div>
            <div class="detail-open-cards">
                <button class="detail-open-card" id="openAnswerBtn">
                    <i class="fas fa-code"></i>
                    <span>Your Answer</span>
                    <i class="fas fa-chevron-right"></i>
                </button>
                <button class="detail-open-card" id="openExplanationBtn">
                    <i class="fas fa-book-open"></i>
                    <span>Detailed Explanation</span>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            ${extraHtml}
            <div class="status-toggle-row">
                <button class="status-toggle-btn ${q.favorite ? 'active-fav' : ''}" id="toggleFavBtn">
                    <i class="fas fa-star"></i> ${q.favorite ? 'Favorited' : 'Mark as Favorite'}
                </button>
                <button class="status-toggle-btn ${q.mastered ? 'active-mastered' : ''}" id="toggleMasteredBtn">
                    <i class="fas fa-check-circle"></i> ${q.mastered ? 'Mastered' : 'Mark as Mastered'}
                </button>
            </div>
            <div class="form-actions">
                <button class="btn-danger" id="detailDeleteBtn"><i class="fas fa-trash"></i> Delete</button>
                <button class="btn-primary" id="detailEditBtn"><i class="fas fa-edit"></i> Edit</button>
            </div>
        `;

        document.getElementById('questionDetailContent').innerHTML = html;

        document.getElementById('detailModalClose').addEventListener('click', () => this.closeDetailModal());
        document.getElementById('openAnswerBtn').addEventListener('click', () => this.openAnswerPage(q));
        document.getElementById('openExplanationBtn').addEventListener('click', () => this.openExplanationPage(q));
        document.getElementById('toggleFavBtn').addEventListener('click', () => {
            this.vault.toggleFavorite(q.id);
            const updated = this.vault.questions.find(x => x.id === q.id);
            this.renderQuestionDetail(updated);
            this.refreshAll();
        });
        document.getElementById('toggleMasteredBtn').addEventListener('click', () => {
            this.vault.toggleMastered(q.id);
            const updated = this.vault.questions.find(x => x.id === q.id);
            this.renderQuestionDetail(updated);
            this.refreshAll();
        });
        document.getElementById('detailEditBtn').addEventListener('click', () => {
            this.closeDetailModal();
            this.openModal(q);
        });
        document.getElementById('detailDeleteBtn').addEventListener('click', () => {
            this.showConfirm(
                'Delete this question?',
                `"${q.title}" will be permanently removed along with its revision history. This can't be undone.`,
                'Yes, delete it',
                () => {
                    this.vault.deleteQuestion(q.id);
                    this.closeDetailModal();
                    this.refreshAll();
                    this.showNotification('🗑️ Question deleted.');
                }
            );
        });
    }

    // ===== Answer / Explanation full-page views =====
    openAnswerPage(q) {
        const content = document.getElementById('answerPageContent');
        content.innerHTML = `<div class="answer-reveal"><pre style="white-space: pre-wrap; margin: 0; background: none; border: none; padding: 0;"><code class="language-javascript">${escapeHtml(q.answer || 'No answer provided yet.')}</code></pre></div>`;
        document.getElementById('answerPage').classList.add('open');
        if (window.Prism) {
            setTimeout(() => Prism.highlightAllUnder(content), 0);
        }
    }

    openExplanationPage(q) {
        const content = document.getElementById('explanationPageContent');
        content.innerHTML = `<div class="answer-reveal" style="border-left-color: var(--accent-blue); background: rgba(59, 130, 246, 0.08); white-space: pre-wrap;">${escapeHtml(q.explanation || 'No explanation provided yet.')}</div>`;
        document.getElementById('explanationPage').classList.add('open');
    }

    // ===== EXPORT/IMPORT =====
    exportJSON() {
        const data = this.vault.exportJSON();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coderetain_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('✅ Data exported successfully!');
    }

    exportMarkdown() {
        let md = '# CodeRetain Export\n\n';
        md += `Exported: ${new Date().toLocaleString()}\n\n`;
        md += `Total Questions: ${this.vault.questions.length}\n`;
        md += `Mastered: ${this.vault.getStats().mastered}\n\n---\n\n`;

        this.vault.questions.forEach((q, i) => {
            md += `## ${i + 1}. ${q.title}\n\n`;
            md += `**Difficulty**: ${q.difficulty}\n`;
            md += `**Topic**: ${q.topic}\n`;
            md += `**Created**: ${new Date(q.createdAt).toLocaleDateString()}\n\n`;
            md += `### Statement\n${q.statement || 'N/A'}\n\n`;
            md += `### Answer\n\`\`\`\n${q.answer || 'N/A'}\n\`\`\`\n\n`;
            if (q.explanation) md += `### Explanation\n${q.explanation}\n\n`;
            if (q.learning) md += `### Key Learning\n${q.learning}\n\n`;
            if (q.mistakes) md += `### Mistakes\n${q.mistakes}\n\n`;
            if (q.better) md += `### Better Approach\n${q.better}\n\n`;
            if (q.timeComplexity || q.spaceComplexity) {
                md += `### Complexity\n`;
                if (q.timeComplexity) md += `- Time: ${q.timeComplexity}\n`;
                if (q.spaceComplexity) md += `- Space: ${q.spaceComplexity}\n`;
                md += '\n';
            }
            if (q.tags && q.tags.length) {
                md += `### Tags\n${q.tags.map(t => `- ${t}`).join('\n')}\n\n`;
            }
            md += `---\n\n`;
        });

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coderetain_export_${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('✅ Markdown exported successfully!');
    }

    importJSON(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = this.vault.importJSON(ev.target.result);
            if (result) {
                this.refreshAll();
                this.showNotification('✅ Data imported successfully!');
            } else {
                this.showNotification('❌ Invalid file format.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ===== UTILITIES =====
    updateBadges() {
        const badge = document.getElementById('revisionBadge');
        const due = this.vault.getDueQuestions().length;
        badge.textContent = due;
    }

    updateXP() {
        const xp = this.vault.xp || 0;
        document.getElementById('xpDisplay').textContent = `${xp} XP`;
    }

    setupIntervalDefaults() {
        DEFAULT_INTERVALS.forEach((val, i) => {
            const input = document.getElementById(`interval${i + 1}`);
            if (input) input.value = val;
        });
    }

    // ===== THEME =====
    initTheme() {
        const theme = this.vault.theme || 'dark';
        this.applyTheme(theme, false);
    }

    setTheme(theme) {
        this.vault.theme = theme;
        this.vault.save();
        this.applyTheme(theme, true);
    }

    applyTheme(theme, animate) {
        document.documentElement.setAttribute('data-theme', theme);
        const toggle = document.getElementById('darkModeToggleSidebar');
        if (toggle) toggle.checked = theme === 'dark';
        const label = document.getElementById('themeToggleLabel');
        if (label) {
            label.innerHTML = theme === 'dark'
                ? '<i class="fas fa-moon"></i> Dark Mode'
                : '<i class="fas fa-sun"></i> Light Mode';
        }
    }

    // ===== SIDEBAR PROFILE =====
    updateSidebarProfile() {
        const name = (this.vault.username || '').trim();
        const usernameEl = document.getElementById('sidebarUsername');
        const avatarEl = document.getElementById('sidebarAvatar');
        const levelEl = document.getElementById('sidebarLevel');
        const usernameInput = document.getElementById('usernameInput');

        usernameEl.textContent = name || 'Guest';
        avatarEl.textContent = name ? name.trim().slice(0, 2).toUpperCase() : 'U';

        const level = this.vault.getLevel();
        levelEl.textContent = `Level ${level.level} • ${level.name}`;

        if (usernameInput && usernameInput.value !== name) {
            usernameInput.value = name;
        }
    }

    // ===== OPTIONAL (EXTRA) QUESTION FIELDS =====
    applyOptionalFieldVisibility() {
        const of = this.vault.optionalFields || {};
        document.querySelectorAll('.optional-field').forEach(el => {
            const field = el.dataset.field;
            const shown = el.classList.contains('form-group-row') ? 'grid' : 'block';
            el.style.display = of[field] ? shown : 'none';
        });
    }

    syncOptionalFieldCheckboxes() {
        const of = this.vault.optionalFields || {};
        const map = {
            fieldLearning: 'learning',
            fieldMistakes: 'mistakes',
            fieldBetter: 'better',
            fieldComplexity: 'complexity',
            fieldTags: 'tags'
        };
        Object.keys(map).forEach(elId => {
            const el = document.getElementById(elId);
            if (el) el.checked = !!of[map[elId]];
        });
    }

    setupOptionalFieldToggles() {
        this.syncOptionalFieldCheckboxes();
        const map = {
            fieldLearning: 'learning',
            fieldMistakes: 'mistakes',
            fieldBetter: 'better',
            fieldComplexity: 'complexity',
            fieldTags: 'tags'
        };
        Object.keys(map).forEach(elId => {
            const el = document.getElementById(elId);
            if (!el || el.dataset.bound) return;
            el.dataset.bound = 'true';
            el.addEventListener('change', () => {
                if (!this.vault.optionalFields) this.vault.optionalFields = this.vault.defaultOptionalFields();
                this.vault.optionalFields[map[elId]] = el.checked;
                this.vault.save();
                this.applyOptionalFieldVisibility();
            });
        });
    }

    // ===== GENERIC CONFIRM MODAL =====
    showConfirm(title, message, confirmText, onConfirm) {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        document.getElementById('confirmModalConfirm').textContent = confirmText || 'Delete';
        this._confirmCallback = onConfirm;
        document.getElementById('confirmModal').classList.add('open');
    }

    closeConfirm() {
        document.getElementById('confirmModal').classList.remove('open');
        this._confirmCallback = null;
    }

    // ===== GENERIC INFO MODAL =====
    showInfoModal(title, bodyHtml) {
        document.getElementById('infoModalTitle').textContent = title;
        document.getElementById('infoModalBody').innerHTML = bodyHtml;
        document.getElementById('infoModal').classList.add('open');
    }

    showNotification(msg) {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification glass';
        toast.textContent = msg;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ============================================================
// INITIALIZE
// ============================================================
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
    window.app = app;
});