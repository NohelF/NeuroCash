// NeuroCash DEMO Version - Standalone (No Backend)
// ============================================================
// 1. Fully decoupled from Supabase.
// 2. Uses localStorage for data persistence mimicking a real DB.
// 3. Implements strict loading mechanisms and fake network latency.
// ============================================================

// ─── 1. State Management ───────────────────────────────────────────────
const STORAGE_KEY = 'neurocash_demo_movements';

const state = {
    loading: true, // App starts blocked by loading state
    user: null,
    movements: [],
    currentFilter: 'all',
    editingId: null
};

// ─── 2. UI Elements ─────────────────────────────────────────────────────
let loadingScreen = document.getElementById('loading-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

// For safely grabbing loading texts if they exist
const getLoadingText = () => document.querySelector('.loading-text');
const getLoadingSpinner = () => document.querySelector('.loading-spinner');

// Ensure loading screen exists locally inside the DOM if not found
if (!loadingScreen) {
    loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.className = 'screen';
    loadingScreen.innerHTML = `
        <div class="loading-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px; align-self:center;">
            <h1>NeuroCash <span style="font-size: 0.5em; background: #39FF14; color: black; padding: 2px 8px; border-radius: 4px; vertical-align: super;">DEMO</span></h1>
            <div class="loading-spinner" style="width:48px;height:48px;border:3px solid #333;border-top-color:#39FF14;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
            <p class="loading-text" style="color:#b0b0b0;animation:pulse-text 2s ease-in-out infinite;">Cargando modo demostración...</p>
        </div>
        <style>
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes pulse-text { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
            .loading-spinner.error { border-top-color:#ff4d4d; animation:none; }
        </style>
    `;
    document.body.insertBefore(loadingScreen, document.body.firstChild);
}

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

const resetBtn = document.getElementById('reset-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const filterBtns = document.querySelectorAll('.filter-btn');

const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('add-btn');

const formatter = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

// ─── 3. Strict Loading UI ───────────────────────────────────────────────
function setLoading(isLoading) {
    state.loading = isLoading;
    if (isLoading) {
        dashboardScreen?.classList.add('hidden');
        loadingScreen.classList.remove('hidden');
    } else {
        loadingScreen.classList.add('hidden');
        dashboardScreen?.classList.remove('hidden');
    }
}

// Fallback error UI if initialization critically fails
function setCriticalError(message) {
    state.loading = false;
    dashboardScreen?.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
    
    const textEl = getLoadingText();
    const spinner = getLoadingSpinner();
    if (textEl) textEl.textContent = message;
    if (spinner) spinner.classList.add('error');
}

// ─── 4. Mock Backend Services ───────────────────────────────────────────
// Helper function to simulate network latency
const simulateNetworkLatency = (min = 300, max = 800) => {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
};

const MockDB = {
    async getMovements() {
        await simulateNetworkLatency(300, 600);
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
        
        // Seed default mock data if empty
        const defaultData = [
            { id: "mock-1", fecha: new Date().toISOString(), tipo: "ingreso", cantidad: 1500, descripcion: "Salario", moneda: "USD", es_ahorro: false },
            { id: "mock-2", fecha: new Date().toISOString(), tipo: "gasto", cantidad: 45, descripcion: "Cena", moneda: "USD", es_ahorro: false },
            { id: "mock-3", fecha: new Date().toISOString(), tipo: "ingreso", cantidad: 200, descripcion: "Ahorro programado", moneda: "USD", es_ahorro: true },
        ];
        this._save(defaultData);
        return defaultData;
    },
    
    async saveMovement(movement) {
        await simulateNetworkLatency(400, 800);
        const currentData = await this.getMovements();
        const newMovement = {
            ...movement,
            id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
        const updatedData = [newMovement, ...currentData];
        this._save(updatedData);
        return newMovement;
    },

    async updateMovement(id, updatedFields) {
        await simulateNetworkLatency(400, 800);
        const currentData = await this.getMovements();
        const idx = currentData.findIndex(m => m.id === id);
        if (idx !== -1) {
            currentData[idx] = { ...currentData[idx], ...updatedFields };
            this._save(currentData);
            return currentData[idx];
        }
        throw new Error('Movimiento no encontrado');
    },

    async deleteMovement(id) {
        await simulateNetworkLatency(300, 600);
        const currentData = await this.getMovements();
        const updatedData = currentData.filter(m => m.id !== id);
        this._save(updatedData);
        return true;
    },

    async resetData() {
        await simulateNetworkLatency(500, 1000);
        this._save([]);
        return true;
    },

    _save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
};

// ─── 5. Async Bootstrap Flow (initSession) ──────────────────────────────
async function initSession() {
    setLoading(true);

    try {
        console.info('[NeuroCash Demo] Iniciando aplicación (modo standalone)...');
        
        // Simulate auth check latency
        await simulateNetworkLatency(500, 1000);
        
        // Mock a demo user permanently
        state.user = { id: "demo-user-123", name: "Demo User" };
        console.info('[NeuroCash Demo] Usuario mock cargado.');

        // Load mock data
        const data = await MockDB.getMovements();
        state.movements = data || [];
        updateUI();

    } catch (err) {
        console.error('[NeuroCash Demo] Error crítico durante el bootstrap:', err);
        setCriticalError('Oops! Error cargando la demostración. Por favor, recarga.');
        return; // Early return to avoid changing loading state to false
    } finally {
        // ALWAYS resolves the loading state unless an error occurred
        if (state.user) {
            setLoading(false);
        }
    }
}

// ─── 6. Data Operations ─────────────────────────────────────────────────
async function executeGuardedOperation(operationFn) {
    if (state.loading || !state.user) return false;
    
    // Disable inputs visually
    submitBtn.disabled = true;
    if (resetBtn) resetBtn.disabled = true;
    
    // Set loading indicator on button
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Guardando...';

    try {
        await operationFn();
        
        // Refresh local state UI seamlessly
        const freshData = await MockDB.getMovements();
        state.movements = freshData;
        updateUI();
        return true;

    } catch (err) {
        console.error('[NeuroCash Demo] Error de operación:', err);
        alert('Error: ' + err.message);
        return false;
    } finally {
        submitBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;
        submitBtn.textContent = originalText;
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

    const isSuccess = await executeGuardedOperation(async () => {
        if (state.editingId) {
            await MockDB.updateMovement(state.editingId.id, movementData);
        } else {
            await MockDB.saveMovement(movementData);
            if (isSavings) triggerCelebration();
        }
    });

    if (isSuccess) resetForm();
};

async function deleteMovement(id) {
    if (confirm('¿Borrar este movimiento?')) {
        await executeGuardedOperation(async () => {
            await MockDB.deleteMovement(id);
        });
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

if (resetBtn) {
    resetBtn.onclick = async () => {
        if (confirm("¿Borrar TODOS tus movimientos permanentemente?")) {
            await executeGuardedOperation(async () => {
                await MockDB.resetData();
            });
        }
    };
}

// ─── 7. UI Logic ────────────────────────────────────────────────────────
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

    const balance = totalInc - totalExp;
    totalIncomeEl.textContent = `$${formatter.format(totalInc)}`;
    totalExpensesEl.textContent = `$${formatter.format(totalExp)}`;
    totalBalanceEl.textContent = `$${formatter.format(balance)}`;
    totalBalanceEl.style.color = balance >= 0 ? 'var(--balance-color)' : 'var(--danger-color)';

    streakEl.textContent = `${calculateStreak(state.movements)} días`;

    const max = Math.max(totalInc, totalExp, Math.abs(balance), 1);
    barIncome.style.width = `${(totalInc / max) * 100}%`;
    barExpenses.style.width = `${(totalExp / max) * 100}%`;
    barBalance.style.width = `${(Math.abs(balance) / max) * 100}%`;
    labelIncome.textContent = `$${formatter.format(totalInc)}`;
    labelExpenses.textContent = `$${formatter.format(totalExp)}`;
    labelBalance.textContent = `$${formatter.format(balance)}`;

    savingsAlert.classList.toggle('hidden', !hasTodaySavings);
}

function calculateStreak(movements) {
    if (!movements.length) return 0;

    const savingsDays = [...new Set(movements
        .filter(m => m.es_ahorro)
        .map(m => new Date(m.fecha).toLocaleDateString())
    )].sort((a, b) => new Date(b) - new Date(a));

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

// ─── 8. Celebration ─────────────────────────────────────────────────────
function triggerCelebration() {
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.left = '50%'; p.style.top = '50%';
        p.style.setProperty('--tx', `${(Math.random() - 0.5) * 400}px`);
        p.style.setProperty('--ty', `${(Math.random() - 0.5) * 400}px`);
        p.style.background = ['#39FF14', '#00FFFF', '#FFD700'][Math.floor(Math.random() * 3)];
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

// ─── 9. Bootstrap Inicial ──────────────────────────────────────────────
initSession();
