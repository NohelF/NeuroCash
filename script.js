// NeuroCash V3 - Advanced Personal Finance Tracker

const SUPABASE_URL = 'https://pabengrpftpsjypnfzwh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_oJhoQN7LwH3yJLD4FOZ5_w_7b7g_vnM';

// Initialize Official Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
    user: null,
    movements: [],
    currentFilter: 'all'
};

// UI Elements
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const financeForm = document.getElementById('finance-form');
const movementsBody = document.getElementById('movements-body');
const flowBody = document.getElementById('flow-body');
const noDataEl = document.getElementById('no-data');

const totalIncomeEl = document.getElementById('total-income');
const totalExpensesEl = document.getElementById('total-expenses');
const totalBalanceEl = document.getElementById('total-balance');

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
const filterBtns = document.querySelectorAll('.filter-btn');

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

// --- Auth Handlers ---
showRegisterLink.onclick = (e) => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); };
showLoginLink.onclick = (e) => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); };

loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Error: ' + error.message);
};

registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert('Error: ' + error.message);
    else { alert('Registro exitoso. Revisa tu email.'); showLoginLink.click(); }
};

logoutBtn.onclick = async () => { await supabase.auth.signOut(); };

// --- Reset Data Handler ---
resetBtn.onclick = async () => {
    if (confirm("¿Estás seguro de que quieres borrar todos tus movimientos? Esta acción no se puede deshacer.")) {
        const { error } = await supabase
            .from('movimientos')
            .delete()
            .eq('user_id', state.user.id);

        if (error) {
            alert('Error al borrar datos: ' + error.message);
        } else {
            state.movements = [];
            updateUI();
        }
    }
};

// --- Dashboard Logic ---
async function loadMovements() {
    try {
        const { data, error } = await supabase
            .from('movimientos')
            .select('*')
            .order('fecha', { ascending: true }); // We load ascending for flow calculation, then reverse for movement list

        if (error) throw error;
        state.movements = data || [];
        updateUI();
    } catch (err) {
        console.error('Error fetching data:', err.message);
    }
}

financeForm.onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;
    const description = document.getElementById('description').value || 'Sin descripción';
    const currency = document.getElementById('currency').value;

    const newMovement = {
        user_id: state.user.id,
        cantidad: amount,
        tipo: type,
        descripcion: description,
        moneda: currency,
        fecha: new Date().toISOString()
    };

    const { error } = await supabase.from("movimientos").insert([newMovement]);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        if (type === 'ahorro') {
            triggerCelebration();
        }
        financeForm.reset();
        loadMovements();
    }
};

filterBtns.forEach(btn => {
    btn.onclick = () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentFilter = btn.dataset.filter;
        updateUI();
    };
});

// --- UI Updates ---
function updateUI() {
    // 1. Filter movements
    const filtered = filterMovements(state.movements, state.currentFilter);
    const sortedDesc = [...filtered].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    // 2. Render Movements Table
    movementsBody.innerHTML = '';
    if (sortedDesc.length === 0) {
        noDataEl.classList.remove('hidden');
    } else {
        noDataEl.classList.add('hidden');
        sortedDesc.forEach(m => {
            const row = document.createElement('tr');
            const isIncome = m.tipo === 'ingreso';
            const isSavings = m.tipo === 'ahorro';
            const colorClass = isIncome ? 'var(--income-color)' : (isSavings ? 'var(--savings-color)' : 'var(--expense-color)');
            
            row.innerHTML = `
                <td>${new Date(m.fecha).toLocaleDateString()}</td>
                <td><span class="type-tag type-${m.tipo}">${m.tipo}</span></td>
                <td>${m.descripcion}</td>
                <td class="amount-text" style="color: ${colorClass}">
                    ${isIncome ? '+' : '-'}$${parseFloat(m.cantidad).toFixed(2)}
                </td>
                <td>${m.moneda}</td>
            `;
            movementsBody.appendChild(row);
        });
    }

    // 3. Render Cash Flow and Totals
    flowBody.innerHTML = '';
    let totalIncome = 0;
    let totalExpenses = 0;
    let cumulativeBalance = 0;
    let hasDailySavings = false;
    const todayStr = new Date().toLocaleDateString();

    // Calculate totals and flow
    // We use "filtered" movements for the dashboard view
    filtered.forEach(m => {
        const amount = parseFloat(m.cantidad);
        const mDate = new Date(m.fecha).toLocaleDateString();
        
        let inc = 0;
        let exp = 0;

        if (m.tipo === 'ingreso') {
            totalIncome += amount;
            inc = amount;
            cumulativeBalance += amount;
        } else {
            // Expenses and Savings both count as outgoing from "current cash" for flow purposes?
            // Usually, savings is a category of allocation.
            // Requirement 2: Balance logic: balance = balance anterior + ingreso - gasto
            // So savings should probably count as "gasto" for the "available cash" balance, or we treat it separately.
            // I'll treat "gasto" and "ahorro" as outgoing for the cash flow calculation.
            totalExpenses += amount;
            exp = amount;
            cumulativeBalance -= amount;
        }

        if (m.tipo === 'ahorro' && mDate === todayStr) {
            hasDailySavings = true;
        }

        const flowRow = document.createElement('tr');
        flowRow.innerHTML = `
            <td>${mDate}</td>
            <td style="color: var(--income-color)">${inc > 0 ? '$'+inc.toFixed(2) : '-'}</td>
            <td style="color: var(--expense-color)">${exp > 0 ? '$'+exp.toFixed(2) : '-'}</td>
            <td style="font-weight: 700; color: ${cumulativeBalance >= 0 ? 'var(--balance-color)' : 'var(--danger-color)'}">
                $${cumulativeBalance.toFixed(2)}
            </td>
        `;
        flowBody.appendChild(flowRow);
    });

    // 4. Update Summary Cards
    totalIncomeEl.textContent = `$${totalIncome.toFixed(2)}`;
    totalExpensesEl.textContent = `$${totalExpenses.toFixed(2)}`;
    totalBalanceEl.textContent = `$${cumulativeBalance.toFixed(2)}`;
    totalBalanceEl.style.color = cumulativeBalance >= 0 ? 'var(--balance-color)' : 'var(--danger-color)';

    // 5. Update Graph
    const max = Math.max(totalIncome, totalExpenses, Math.abs(cumulativeBalance), 1);
    barIncome.style.width = `${(totalIncome / max) * 100}%`;
    barExpenses.style.width = `${(totalExpenses / max) * 100}%`;
    barBalance.style.width = `${(Math.abs(cumulativeBalance) / max) * 100}%`;
    
    labelIncome.textContent = `$${totalIncome.toFixed(2)}`;
    labelExpenses.textContent = `$${totalExpenses.toFixed(2)}`;
    labelBalance.textContent = `$${cumulativeBalance.toFixed(2)}`;

    // 6. Savings Alert
    if (hasDailySavings) {
        savingsAlert.classList.remove('hidden');
    } else {
        savingsAlert.classList.add('hidden');
    }
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

// --- Visual Effects ---
function triggerCelebration() {
    for (let i = 0; i < 30; i++) {
        createParticle();
    }
    // Glow effect on screen
    dashboardScreen.classList.add('save-glow');
    setTimeout(() => dashboardScreen.classList.remove('save-glow'), 800);
}

function createParticle() {
    const p = document.createElement('div');
    p.classList.add('particle');
    
    // Start position (around the button area or center)
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    
    // Custom trajectory
    const tx = (Math.random() - 0.5) * 400;
    const ty = (Math.random() - 0.5) * 400;
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    
    // Random color
    const colors = ['#39FF14', '#00FFFF', '#FFD700', '#FFFFFF'];
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    celebrationContainer.appendChild(p);
    setTimeout(() => p.remove(), 1000);
}

// Start the app
init();
