// NeuroCash V4 - Enhanced Personal Finance Tracker

const SUPABASE_URL = 'https://pabengrpftpsjypnfzwh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oJhoQN7LwH3yJLD4FOZ5_w_7b7g_vnM';

// Initialize Official Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
    user: null,
    movements: [],
    currentFilter: 'all',
    editingId: null
};

const formatter = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

// UI Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const financeForm = document.getElementById('finance-form');
const movementsBody = document.getElementById('movements-body');
const noDataEl = document.getElementById('no-data');

const totalIncomeEl = document.getElementById('total-income');
const totalExpensesEl = document.getElementById('total-expenses');
const totalBalanceEl = document.getElementById('total-balance');
const streakEl = document.getElementById('savings-streak');

const barIncome = document.getElementById('bar-income');
const barExpenses = document.getElementById('bar-expenses');
const barBalance = document.getElementById('bar-balance');
const labelIncome = document.getElementById('label-income');
const labelExpenses = document.getElementById('label-expenses');
const labelBalance = document.getElementById('label-balance');

const savingsAlert = document.getElementById('savings-alert');
const celebrationContainer = document.getElementById('celebration-container');

const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const logoutBtn = document.getElementById('logout-btn');
const resetBtn = document.getElementById('reset-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const filterBtns = document.querySelectorAll('.filter-btn');

const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('add-btn');

// --- Initialization ---
async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        state.user = session.user;
        showDashboard();
    } else {
        showAuth();
    }
    supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
            state.user = session.user;
            showDashboard();
        } else {
            state.user = null;
            showAuth();
        }
    });
}

// --- Navigation ---
function showDashboard() {
    authScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    loadMovements();
}

function showAuth() {
    dashboardScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
}

// --- Auth ---
loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
        email: loginForm['login-email'].value,
        password: loginForm['login-password'].value
    });
    if (error) alert('Error: ' + error.message);
};

registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({
        email: registerForm['register-email'].value,
        password: registerForm['register-password'].value
    });
    if (error) alert('Error: ' + error.message);
    else { alert('Registro exitoso. Revisa tu email.'); showLoginLink.click(); }
};

logoutBtn.onclick = async () => await supabase.auth.signOut();
showRegisterLink.onclick = (e) => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); };
showLoginLink.onclick = (e) => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); };

// --- Data Operations ---
async function loadMovements() {
    const { data, error } = await supabase
        .from('movimientos')
        .select('*')
        .order('fecha', { ascending: false });
    if (!error) {
        state.movements = data || [];
        updateUI();
    }
}

financeForm.onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(financeForm['amount'].value);
    const type = financeForm['type'].value;
    const isSavings = financeForm['is-savings'].checked;
    const description = financeForm['description'].value || 'Sin descripción';
    const currency = financeForm['currency'].value;

    const movementData = {
        user_id: state.user.id,
        cantidad: amount,
        tipo: type,
        es_ahorro: isSavings,
        descripcion: description,
        moneda: currency,
        fecha: state.editingId ? state.editingId.fecha : new Date().toISOString()
    };

    let result;
    if (state.editingId) {
        result = await supabase.from('movimientos').update(movementData).eq('id', state.editingId.id);
    } else {
        result = await supabase.from('movimientos').insert([movementData]);
    }

    if (result.error) {
        alert('Error: ' + result.error.message);
    } else {
        if (isSavings && !state.editingId) triggerCelebration();
        resetForm();
        loadMovements();
    }
};

async function deleteMovement(id) {
    if (confirm('¿Borrar este movimiento?')) {
        const { error } = await supabase.from('movimientos').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadMovements();
    }
}

function startEdit(movement) {
    state.editingId = movement;
    formTitle.textContent = "Editar movimiento";
    submitBtn.textContent = "Actualizar movimiento";
    cancelEditBtn.classList.remove('hidden');
    
    financeForm['amount'].value = movement.cantidad;
    financeForm['type'].value = movement.tipo;
    financeForm['is-savings'].checked = movement.es_ahorro;
    financeForm['description'].value = movement.descripcion;
    financeForm['currency'].value = movement.moneda;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    state.editingId = null;
    formTitle.textContent = "Agregar movimiento";
    submitBtn.textContent = "Guardar movimiento";
    cancelEditBtn.classList.add('hidden');
    financeForm.reset();
}

cancelEditBtn.onclick = resetForm;

resetBtn.onclick = async () => {
    if (confirm("¿Borrar TODOS tus movimientos?")) {
        const { error } = await supabase.from('movimientos').delete().eq('user_id', state.user.id);
        if (!error) loadMovements();
    }
};

// --- UI Logic ---
function updateUI() {
    const filtered = filterMovements(state.movements, state.currentFilter);
    movementsBody.innerHTML = '';

    let totalInc = 0;
    let totalExp = 0;
    let hasTodaySavings = false;
    const today = new Date().toLocaleDateString();

    filtered.forEach(m => {
        const amount = parseFloat(m.cantidad);
        if (m.tipo === 'ingreso') totalInc += amount;
        else totalExp += amount;

        if (m.es_ahorro && new Date(m.fecha).toLocaleDateString() === today) hasTodaySavings = true;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(m.fecha).toLocaleDateString()}</td>
            <td>
                <span class="type-tag type-${m.tipo}">${m.tipo}</span>
                ${m.es_ahorro ? '<span class="is-savings-badge">Ahorro</span>' : ''}
            </td>
            <td>${m.descripcion}</td>
            <td style="color: ${m.tipo === 'ingreso' ? 'var(--income-color)' : 'var(--expense-color)'}; font-weight: 700">
                $${formatter.format(m.cantidad)}
            </td>
            <td>${m.moneda}</td>
            <td class="actions-cell">
                <button class="btn-sm edit-btn" data-id="${m.id}">Editar</button>
                <button class="btn-sm delete-btn" data-id="${m.id}">Borrar</button>
            </td>
        `;
        
        row.querySelector('.edit-btn').onclick = () => startEdit(m);
        row.querySelector('.delete-btn').onclick = () => deleteMovement(m.id);
        
        movementsBody.appendChild(row);
    });

    noDataEl.classList.toggle('hidden', filtered.length > 0);
    
    // Totals
    const balance = totalInc - totalExp;
    totalIncomeEl.textContent = `$${formatter.format(totalInc)}`;
    totalExpensesEl.textContent = `$${formatter.format(totalExp)}`;
    totalBalanceEl.textContent = `$${formatter.format(balance)}`;
    totalBalanceEl.style.color = balance >= 0 ? 'var(--balance-color)' : 'var(--danger-color)';

    // Streak
    streakEl.textContent = `${calculateStreak(state.movements)} días`;

    // Graph
    const max = Math.max(totalInc, totalExp, Math.abs(balance), 1);
    barIncome.style.width = `${(totalInc / max) * 100}%`;
    barExpenses.style.width = `${(totalExp / max) * 100}%`;
    barBalance.style.width = `${(Math.abs(balance) / max) * 100}%`;
    labelIncome.textContent = `$${formatter.format(totalInc)}`;
    labelExpenses.textContent = `$${formatter.format(totalExp)}`;
    labelBalance.textContent = `$${formatter.format(balance)}`;

    // Saving Alert
    savingsAlert.classList.toggle('hidden', !hasTodaySavings);
}

function calculateStreak(movements) {
    if (!movements.length) return 0;
    
    // Get unique days with savings
    const savingsDays = [...new Set(movements
        .filter(m => m.es_ahorro)
        .map(m => new Date(m.fecha).toLocaleDateString())
    )].sort((a,b) => new Date(b) - new Date(a)); // Newest first

    if (!savingsDays.length) return 0;

    const today = new Date().toLocaleDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();

    // If no saving today or yesterday, streak is broken
    if (savingsDays[0] !== today && savingsDays[0] !== yesterdayStr) return 0;

    let streak = 0;
    let currentDate = new Date(savingsDays[0] === today ? today : yesterdayStr);

    for (const dayStr of savingsDays) {
        if (dayStr === currentDate.toLocaleDateString()) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

function filterMovements(items, filter) {
    if (filter === 'all') return items;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return items.filter(m => {
        const mDate = new Date(m.fecha);
        if (filter === 'today') return mDate >= startOfToday;
        if (filter === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            return mDate >= startOfWeek;
        }
        if (filter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return mDate >= startOfMonth;
        }
        return true;
    });
}

// Celebration (same as V3 but optimized)
function triggerCelebration() {
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = '50%'; p.style.top = '50%';
        p.style.setProperty('--tx', `${(Math.random() - 0.5) * 400}px`);
        p.style.setProperty('--ty', `${(Math.random() - 0.5) * 400}px`);
        p.style.background = ['#39FF14', '#00FFFF', '#FFD700'][Math.floor(Math.random()*3)];
        celebrationContainer.appendChild(p);
        setTimeout(() => p.remove(), 1000);
    }
}

filterBtns.forEach(btn => btn.onclick = () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentFilter = btn.dataset.filter;
    updateUI();
});

init();
