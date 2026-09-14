// ===== Telegram WebApp Initialization =====
const tg = window.Telegram?.WebApp;

// Block access from outside Telegram
function checkTelegramAccess() {
    const notTelegram = document.getElementById('not-telegram');
    const app = document.getElementById('app');

    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        // Inside Telegram - show app
        notTelegram.classList.add('hidden');
        app.classList.remove('hidden');
        return true;
    } else {
        // Outside Telegram - show blocker
        notTelegram.classList.remove('hidden');
        app.classList.add('hidden');
        return false;
    }
}

// Initialize Telegram
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0f1724');
    tg.setBackgroundColor('#0f1724');
    
    // Enable closing confirmation
    tg.enableClosingConfirmation();
}

// Check access on load
window.addEventListener('DOMContentLoaded', () => {
    const isTelegram = checkTelegramAccess();
    
    if (isTelegram && tg) {
        // Show user info
        const user = tg.initDataUnsafe?.user;
        if (user) {
            document.getElementById('userInfo').textContent = 
                `👤 ${user.first_name || user.username || 'Trader'}`;
        }
        
        // Load app data
        loadRates();
        loadAlerts();
    }
});

// ===== Tab Navigation =====
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(target).classList.add('active');
        
        // Haptic feedback
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    });
});

// ===== Currency Rates (using free API) =====
const CURRENCY_PAIRS = [
    { symbol: 'EURUSD', name: 'EUR/USD', full: 'Euro / US Dollar' },
    { symbol: 'GBPUSD', name: 'GBP/USD', full: 'British Pound / US Dollar' },
    { symbol: 'USDJPY', name: 'USD/JPY', full: 'US Dollar / Japanese Yen' },
    { symbol: 'AUDUSD', name: 'AUD/USD', full: 'Australian Dollar / US Dollar' },
    { symbol: 'USDCAD', name: 'USD/CAD', full: 'US Dollar / Canadian Dollar' },
    { symbol: 'XAUUSD', name: 'XAU/USD', full: 'Gold / US Dollar' }
];

// Fallback rates (used if API fails)
const FALLBACK_RATES = {
    EURUSD: { price: 1.0842, change: 0.15 },
    GBPUSD: { price: 1.2673, change: -0.08 },
    USDJPY: { price: 149.52, change: 0.32 },
    AUDUSD: { price: 0.6584, change: 0.21 },
    USDCAD: { price: 1.3584, change: -0.12 },
    XAUUSD: { price: 2032.50, change: 0.45 }
};

async function loadRates() {
    const grid = document.getElementById('ratesGrid');
    grid.innerHTML = '<div class="loading">Loading rates...</div>';
    
    try {
        // Using exchangerate-api free endpoint (no key required for basic)
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        
        const rates = data.rates;
        
        const displayRates = [
            { symbol: 'EURUSD', name: 'EUR/USD', full: 'Euro / US Dollar', price: (1/rates.EUR).toFixed(4), change: 0.15 },
            { symbol: 'GBPUSD', name: 'GBP/USD', full: 'British Pound / US Dollar', price: (1/rates.GBP).toFixed(4), change: -0.08 },
            { symbol: 'USDJPY', name: 'USD/JPY', full: 'US Dollar / Japanese Yen', price: rates.JPY.toFixed(2), change: 0.32 },
            { symbol: 'AUDUSD', name: 'AUD/USD', full: 'Australian Dollar / US Dollar', price: (1/rates.AUD).toFixed(4), change: 0.21 },
            { symbol: 'USDCAD', name: 'USD/CAD', full: 'US Dollar / Canadian Dollar', price: rates.CAD.toFixed(4), change: -0.12 },
            { symbol: 'XAUUSD', name: 'XAU/USD', full: 'Gold / US Dollar', price: '2032.50', change: 0.45 }
        ];
        
        renderRates(displayRates);
    } catch (error) {
        console.error('API failed, using fallback rates:', error);
        const fallback = CURRENCY_PAIRS.map(p => ({
            ...p,
            price: FALLBACK_RATES[p.symbol].price,
            change: FALLBACK_RATES[p.symbol].change
        }));
        renderRates(fallback);
    }
}

function renderRates(rates) {
    const grid = document.getElementById('ratesGrid');
    grid.innerHTML = rates.map(r => `
        <div class="rate-card">
            <div>
                <div class="pair-name">${r.name}</div>
                <div class="pair-full">${r.full}</div>
            </div>
            <div class="price">
                <div class="price-value">${r.price}</div>
                <div class="change ${r.change >= 0 ? 'up' : 'down'}">
                    ${r.change >= 0 ? '▲' : '▼'} ${Math.abs(r.change)}%
                </div>
            </div>
        </div>
    `).join('');
}

// ===== Price Alerts (stored in localStorage) =====
function loadAlerts() {
    const alerts = JSON.parse(localStorage.getItem('fx_alerts') || '[]');
    const list = document.getElementById('alertsList');
    
    if (alerts.length === 0) {
        list.innerHTML = '<p class="empty-msg">No alerts yet. Create your first alert!</p>';
        return;
    }
    
    list.innerHTML = alerts.map((alert, i) => `
        <div class="alert-item">
            <div class="alert-info">
                <strong>${alert.pair}</strong>
                <span>${alert.condition === 'above' ? '↑ Above' : '↓ Below'} ${alert.price}</span>
            </div>
            <button class="delete-btn" onclick="deleteAlert(${i})">Delete</button>
        </div>
    `).join('');
}

function createAlert() {
    const pair = document.getElementById('alertPair').value;
    const condition = document.getElementById('alertCondition').value;
    const price = document.getElementById('alertPrice').value;
    
    if (!price) {
        if (tg?.showAlert) tg.showAlert('Please enter a target price');
        else alert('Please enter a target price');
        return;
    }
    
    const alerts = JSON.parse(localStorage.getItem('fx_alerts') || '[]');
    alerts.push({ pair, condition, price, created: Date.now() });
    localStorage.setItem('fx_alerts', JSON.stringify(alerts));
    
    document.getElementById('alertPrice').value = '';
    loadAlerts();
    
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    if (tg?.showPopup) {
        tg.showPopup({ title: '✅ Alert Created', message: `Alert set for ${pair} ${condition} ${price}` });
    }
}

function deleteAlert(index) {
    const alerts = JSON.parse(localStorage.getItem('fx_alerts') || '[]');
    alerts.splice(index, 1);
    localStorage.setItem('fx_alerts', JSON.stringify(alerts));
    loadAlerts();
    
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

// ===== Trading Tools =====
function calculatePosition() {
    const balance = parseFloat(document.getElementById('accountBalance').value);
    const risk = parseFloat(document.getElementById('riskPercent').value);
    const stopLoss = parseFloat(document.getElementById('stopLoss').value);
    
    if (!balance || !risk || !stopLoss) {
        alert('Please fill all fields');
        return;
    }
    
    const riskAmount = balance * (risk / 100);
    const pipValue = 10; // Standard lot pip value
    const lotSize = riskAmount / (stopLoss * pipValue);
    
    const result = document.getElementById('positionResult');
    result.innerHTML = `
        💵 Risk Amount: $${riskAmount.toFixed(2)}<br>
        📊 Recommended Lot Size: ${lotSize.toFixed(2)} lots<br>
        ⚠️ Max Loss: $${riskAmount.toFixed(2)}
    `;
    result.classList.add('show');
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function calculatePip() {
    const pair = document.getElementById('pipPair').value;
    const lots = parseFloat(document.getElementById('lotSize').value);
    
    if (!lots) {
        alert('Please enter lot size');
        return;
    }
    
    let pipValue = 10; // Standard for USD-quoted pairs
    if (pair === 'USDJPY') pipValue = 6.7; // Approx
    
    const totalPip = pipValue * lots;
    
    const result = document.getElementById('pipResult');
    result.innerHTML = `
        📊 Pair: ${pair}<br>
        💰 Pip Value per 1.0 lot: $${pipValue}<br>
        💵 Your Pip Value (${lots} lots): $${totalPip.toFixed(2)}
    `;
    result.classList.add('show');
}

function calculatePL() {
    const entry = parseFloat(document.getElementById('entryPrice').value);
    const exit = parseFloat(document.getElementById('exitPrice').value);
    const lots = parseFloat(document.getElementById('plLots').value);
    const direction = document.getElementById('plDirection').value;
    
    if (!entry || !exit || !lots) {
        alert('Please fill all fields');
        return;
    }
    
    let pips = (exit - entry) * 10000;
    if (direction === 'short') pips = -pips;
    
    const profit = pips * 10 * lots;
    const isProfit = profit >= 0;
    
    const result = document.getElementById('plResult');
    result.style.color = isProfit ? 'var(--success)' : 'var(--danger)';
    result.innerHTML = `
        ${isProfit ? '📈' : '📉'} Pips: ${pips.toFixed(1)}<br>
        ${isProfit ? '💰 Profit' : '💸 Loss'}: $${Math.abs(profit).toFixed(2)}<br>
        📊 Direction: ${direction.toUpperCase()}
    `;
    result.classList.add('show');
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

// ===== Learn More Toggle =====
function toggleLearn(btn) {
    const content = btn.nextElementSibling;
    const isOpen = content.classList.contains('show');
    
    content.classList.toggle('show');
    btn.textContent = isOpen ? 'Read more →' : 'Show less ↑';
}

// Auto-refresh rates every 60 seconds
setInterval(() => {
    if (document.getElementById('rates').classList.contains('active')) {
        loadRates();
    }
}, 60000);

console.log('FXMarket Pro loaded ✅');
