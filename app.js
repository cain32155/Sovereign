/* ==========================================
   ARISE: THE SYSTEM CORE ENGINE
   ========================================== */

const DEFAULT_STATE = {
    isLoggedIn: false,
    isOnboardingComplete: false,
    questionIndex: 0,
    answers: {},
    player: {
        name: "Sung Jin-Woo",
        avatar: "👤",
        rank: "E",
        class: "Unknown",
        level: 1,
        xp: 0,
        xpNeeded: 100,
        hp: 100,
        maxHp: 100,
        fatigue: 0,
        gold: 0,
        statPoints: 0,
        stats: { str: 10, agi: 10, vit: 10, int: 10, per: 10 },
        statBuffs: { str: 0, agi: 0, vit: 0, int: 0, per: 0 }
    },
    quests: {
        daily: [],
        redGates: [],
        campaign: [
            { id: "c1", name: "The Weakest Hunter", desc: "Awaken your body. Snap a photo of your gym or equipment.", type: "physical", completed: false, xp: 100, gold: 50 },
            { id: "c2", name: "First Steps", desc: "Walk or Run 1km.", type: "physical", completed: false, xp: 200, gold: 100 },
            { id: "c3", name: "E-Rank Benchmark", desc: "Do 50 Pushups and 50 Squats.", type: "physical", completed: false, xp: 500, gold: 250, statReward: {stat: 'str', amt: 3} }
        ],
        penaltyActive: false
    },
    shop: {
        irl: [],
        cosmetics: [
            { id: "aura_berserk", name: "Aura: Berserk", type: "aura", theme: "berserk", cost: 1000, icon: "🔥" },
            { id: "aura_healer", name: "Aura: Healer", type: "aura", theme: "healer", cost: 1000, icon: "🌿" },
            { id: "aura_assassin", name: "Aura: Assassin", type: "aura", theme: "assassin", cost: 1000, icon: "🗡️" },
            { id: "aura_abyss", name: "Aura: Abyss", type: "aura", theme: "default", cost: 1000, icon: "🌌" },
            { id: "title_demon", name: "Title: Demon Hunter", type: "title", stat: "str", bonus: 2, cost: 500, icon: "👹" },
            { id: "title_magus", name: "Title: Grand Magus", type: "title", stat: "int", bonus: 2, cost: 500, icon: "🧙‍♂️" },
            { id: "avatar_wolf", name: "Avatar: Dire Wolf", type: "avatar", icon: "🐺", cost: 800 },
            { id: "avatar_king", name: "Avatar: Sovereign", type: "avatar", icon: "👑", cost: 2000 }
        ]
    },
    inventory: {
        equippedAura: "default",
        equippedTitle: "",
        manaCrystals: 0,
        purchased: []
    },
    shadows: {
        extractionsAvailable: 0,
        army: []
    },
    stealthStreak: 0,
    mindscapeCharges: 0,
    viceStreak: 0,
    boss: {
        name: "Sovereign of Vice",
        isActive: false,
        hp: 10000,
        maxHp: 10000
    }
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
let currentUserEmail = null;

// Local Storage
function saveState() {
    if (!currentUserEmail) return;
    try { localStorage.setItem("arise_state_" + currentUserEmail, JSON.stringify(state)); } catch(e) {}
}

function loadState(email) {
    try {
        const s = localStorage.getItem("arise_state_" + email);
        if (s) { 
            state = JSON.parse(s); 
            currentUserEmail = email;
            return true; 
        }
    } catch(e) {}
    
    // New User init
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    currentUserEmail = email;
    return false;
}

// Global elements
const panels = {
    auth: document.getElementById("auth-screen"),
    onboarding: document.getElementById("onboarding-screen"),
    dashboard: document.getElementById("dashboard-screen")
};

// ==========================================
// BOOT
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    const activeEmail = localStorage.getItem("arise_current_user");
    if (activeEmail && loadState(activeEmail)) {
        if (state.isLoggedIn && state.isOnboardingComplete) {
            transitionView("auth-screen", "dashboard-screen");
            syncDashboard();
            applyAura();
            updateDailyTimer();
        } else if (state.isLoggedIn) {
            transitionView("auth-screen", "onboarding-screen");
            startOnboarding();
        }
    }
});

// Utility
function transitionView(from, to) {
    document.getElementById(from).classList.remove("active");
    setTimeout(() => {
        document.getElementById(from).style.display = "none";
        document.getElementById(to).style.display = "flex";
        setTimeout(() => document.getElementById(to).classList.add("active"), 50);
    }, 400);
}

// ==========================================
// SYSTEM TOAST NOTIFICATIONS
// ==========================================
function showToast(msg, type = "success") {
    const container = document.getElementById("system-toast-container");
    if (!container) return;

    // Try to auto-detect if it's an error based on keywords
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes("fail") || lowerMsg.includes("error") || lowerMsg.includes("penalty") || lowerMsg.includes("decimated") || lowerMsg.includes("slashed") || lowerMsg.includes("requires")) {
        type = "error";
    }

    const toast = document.createElement("div");
    toast.className = `system-toast toast-${type}`;
    
    const title = document.createElement("span");
    title.className = "toast-title";
    title.innerText = type === "error" ? "[SYSTEM WARNING]" : "[SYSTEM NOTIFICATION]";
    
    const body = document.createElement("span");
    body.innerText = msg;
    
    toast.appendChild(title);
    toast.appendChild(body);
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Override default alert
window.alert = function(msg) {
    showToast(msg);
};

// ==========================================
// AUTH & ONBOARDING
// ==========================================
document.getElementById("show-login-btn").addEventListener("click", () => {
    document.getElementById("show-login-btn").classList.add("hidden");
    document.getElementById("auth-form-container").classList.remove("hidden");
});

document.getElementById("auth-request-otp-btn").addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value.trim().toLowerCase();
    if (!email) return alert("System requires email.");
    
    document.getElementById("auth-request-otp-btn").innerText = "DISPATCHING...";
    
    try {
        const res = await fetch("https://sovereign-6irh.onrender.com/api/auth/request-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        
        if (res.ok) {
            document.getElementById("auth-step-1").classList.add("hidden");
            document.getElementById("auth-step-2").classList.remove("hidden");
        } else {
            alert("Failed to send OTP.");
            document.getElementById("auth-request-otp-btn").innerText = "SEND AUTHORIZATION CODE";
        }
    } catch(err) {
        alert("Server Offline.");
        document.getElementById("auth-request-otp-btn").innerText = "SEND AUTHORIZATION CODE";
    }
});

document.getElementById("auth-verify-otp-btn").addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value.trim().toLowerCase();
    const code = document.getElementById("auth-otp").value.trim();
    if (!code) return alert("Code required.");
    
    document.getElementById("auth-verify-otp-btn").innerText = "VERIFYING...";
    
    try {
        const res = await fetch("https://sovereign-6irh.onrender.com/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });
        
        const data = await res.json();
        
        if (res.ok && data.token) {
            localStorage.setItem("arise_token", data.token);
            localStorage.setItem("arise_current_user", email);
            
            // Setup User Session
            loadState(email);
            state.player.name = data.user.hunterName;
            state.isLoggedIn = true;
            saveState();

            document.getElementById("auth-form-container").classList.add("hidden");
            if (state.isOnboardingComplete) {
                transitionView("auth-screen", "dashboard-screen");
                syncDashboard();
                applyAura();
                updateDailyTimer();
            } else {
                transitionView("auth-screen", "onboarding-screen");
                startOnboarding();
            }
        } else {
            alert(data.error || "Invalid code.");
            document.getElementById("auth-verify-otp-btn").innerText = "VERIFY & AWAKEN";
        }
    } catch(err) {
        alert("Network Error: The Sovereign API might be cold-starting. Please wait 30 seconds and try again.");
        document.getElementById("auth-verify-otp-btn").innerText = "VERIFY & AWAKEN";
    }
});

document.getElementById("btn-sign-out").addEventListener("click", () => {
    state.isLoggedIn = false;
    saveState();
    localStorage.removeItem("arise_current_user");
    currentUserEmail = null;
    
    // Reset login UI
    document.getElementById("auth-form-container").classList.add("hidden");
    document.getElementById("show-login-btn").classList.remove("hidden");
    document.getElementById("auth-password").value = "";
    
    transitionView("dashboard-screen", "auth-screen");
});

// Terminal Animation
setTimeout(() => {
    document.getElementById("show-login-btn").classList.remove("hidden-init");
}, 3500);

const QUESTIONS = [
    { key: "q_arch", q: "1. [Primary Grind] What is your main stat focus right now?", opts: ["Physical Recomposition", "System Architecture (Code/Hardware)", "Lore Creation (Art/Writing)", "Agility (Productivity)"] },
    { key: "q_env", q: "2. [Environment] Where is your primary Dungeon?", opts: ["Commercial Gym", "Home Office/Desk", "College Dorm/Library", "The Outdoors"] },
    { key: "q_inv", q: "3. [Inventory: Hardware] What hardware is currently in your inventory?", opts: ["Heavy Free Weights", "Microcontrollers/Electronics", "High-End PC/Laptop", "Dedicated Camera/Sketchpad"] },
    { key: "q_fuel", q: "4. [Inventory: Consumables] What is your primary fuel source?", opts: ["Clean Meal Prep", "Fast Food/Takeout", "Excessive Caffeine", "Home-cooked meals"] },
    { key: "q_weak", q: "5. [Weakness] What status ailment hits you the hardest?", opts: ["Doomscrolling", "Terrible Diet/Nutrition", "Skipping Workouts", "Burnout/Writer's Block"] },
    { key: "q_cmb", q: "6. [Combat Style] When grinding, do you prefer?", opts: ["Deep Solo Isolation", "Co-op/Working with others", "Body Doubling/Cafe"] },
    { key: "q_time", q: "7. [Time Constraint] What is your daily grinding window?", opts: ["Early Morning", "Mid-day/Afternoon", "Late Night", "Erratic/Fragmented"] },
    { key: "q_rest", q: "8. [Recovery] What is your current sleep protocol?", opts: ["< 5 hours (Critical)", "6-7 hours (Average)", "8+ hours (Optimal)", "Shift Work"] },
    { key: "q_sec", q: "9. [Secondary Grind] If you max out your primary, what is next?", opts: ["Physical Fitness", "Financial Wealth", "Skill Mastery", "Mental Clarity"] },
    { key: "q_trig", q: "10. [Trigger] What usually causes quest failure?", opts: ["Lack of Time", "Fatigue", "Distractions/Phone", "Lack of clear plan"] },
    { key: "q_mot", q: "11. [Motivation] What is the ultimate reward you seek?", opts: ["Aesthetic Dominance", "Financial Freedom", "Creating a Legacy", "Pure Discipline"] },
    { key: "q_plg", q: "12. [Pledge] Are you ready to accept the System's penalties?", opts: ["I am ready", "I will try", "Show no mercy"] }
];

const chatFeed = document.getElementById("onboarding-chat-feed");
const chatOptions = document.getElementById("chat-multi-options");

function startOnboarding() {
    chatFeed.innerHTML = "";
    state.questionIndex = 0;
    state.answers = {};
    appendSys("Mana flow detected. Beginning Hunter Registration...");
    setTimeout(() => askQuestion(0), 1000);
}

function appendSys(text, cb) {
    const b = document.createElement("div");
    b.className = "chat-bubble system-bubble";
    b.innerHTML = `<strong>[SYSTEM]</strong><br>${text}`;
    chatFeed.appendChild(b);
    chatFeed.scrollTop = chatFeed.scrollHeight;
    if(cb) setTimeout(cb, 500);
}

function appendPlayer(text) {
    const b = document.createElement("div");
    b.className = "chat-bubble player-bubble";
    b.innerHTML = `<strong>[PLAYER]</strong><br>${text}`;
    chatFeed.appendChild(b);
    chatFeed.scrollTop = chatFeed.scrollHeight;
}

function askQuestion(idx) {
    if (idx >= QUESTIONS.length) {
        processAwakening();
        return;
    }
    const qObj = QUESTIONS[idx];
    appendSys(qObj.q, () => {
        chatOptions.innerHTML = "";
        qObj.opts.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "chat-opt-btn";
            btn.textContent = opt;
            btn.onclick = () => submitAnswer(opt);
            chatOptions.appendChild(btn);
        });
        chatOptions.classList.remove("hidden");
    });
}

function submitAnswer(ans) {
    chatOptions.classList.add("hidden");
    appendPlayer(ans);
    const key = QUESTIONS[state.questionIndex].key;
    state.answers[key] = ans;
    state.questionIndex++;
    saveState();
    setTimeout(() => askQuestion(state.questionIndex), 800);
}

function processAwakening() {
    const a = state.answers;
    
    // Safely extract answers with fallback to prevent crashes
    const arch = a.q_arch || "";
    const env = a.q_env || "";
    const inv = a.q_inv || "";
    const weak = a.q_weak || "";
    
    // Archetype Stat Calibration
    if(arch.includes("Physical")) { state.player.class = "Fighter"; state.player.stats.str = 15; }
    else if(arch.includes("System Architecture")) { state.player.class = "Architect"; state.player.stats.int = 15; }
    else if(arch.includes("Lore")) { state.player.class = "Creator"; state.player.stats.per = 15; }
    else { state.player.class = "Shadow"; state.player.stats.agi = 15; }
    
    state.player.maxHp = 100;
    state.player.hp = 100;
    state.player.gold = 200;
    
    // Save Profile
    state.player.profile = { arch, env, inv, weak };
    
    state.isOnboardingComplete = true;
    generateDailies();
    saveState();
    
    const overlay = document.getElementById("awakening-ceremony");
    const card = document.getElementById("awakened-class-card");
    const btn = document.getElementById("enter-system-btn");
    
    overlay.classList.remove("hidden");
    setTimeout(() => {
        card.innerHTML = `<h3>CLASS EVALUATED</h3><h1 class="text-purple">${state.player.class.toUpperCase()}</h1><p>Stats calibrated. Arise.</p>`;
        setTimeout(() => btn.classList.remove("hidden"), 1000);
    }, 1500);
}

document.getElementById("enter-system-btn").addEventListener("click", () => {
    document.getElementById("awakening-ceremony").classList.add("hidden");
    transitionView("onboarding-screen", "dashboard-screen");
    syncDashboard();
});

// ==========================================
// DASHBOARD SYNC
// ==========================================
function syncDashboard() {
    // Top
    document.getElementById("player-name").textContent = state.player.name.toUpperCase();
    document.getElementById("player-rank").textContent = `${state.player.rank}-RANK HUNTER`;
    document.getElementById("player-class").textContent = `CLASS: ${state.player.class.toUpperCase()}`;
    
    if (state.player.profileUrl) {
        document.getElementById("player-avatar").innerHTML = `<img src="${state.player.profileUrl}" width="100%" height="100%" style="border-radius: 50%; object-fit: cover;" />`;
    } else if (state.player.avatar && state.player.avatar !== "👤") {
        document.getElementById("player-avatar").textContent = state.player.avatar;
    } else {
        document.getElementById("player-avatar").innerHTML = `<img src="https://api.dicebear.com/7.x/adventurer/svg?seed=${state.player.name}" width="100%" height="100%" style="border-radius: 50%;" />`;
    }
    
    if (state.inventory.equippedTitle) {
        document.getElementById("player-title-display").textContent = state.inventory.equippedTitle;
    }
    
    // Bars
    document.getElementById("hp-value").textContent = `${state.player.hp} / ${state.player.maxHp}`;
    document.getElementById("hp-progress-bar").style.width = `${(state.player.hp / state.player.maxHp)*100}%`;
    
    document.getElementById("fatigue-value").textContent = `${state.player.fatigue} / 100`;
    document.getElementById("fatigue-progress-bar").style.width = `${state.player.fatigue}%`;
    
    document.getElementById("xp-text").textContent = `${state.player.xp} / ${state.player.xpNeeded}`;
    document.getElementById("xp-progress-bar").style.width = `${(state.player.xp / state.player.xpNeeded)*100}%`;
    document.getElementById("hud-level-tag").textContent = `LVL ${state.player.level}`;
    
    document.getElementById("gold-balance").textContent = state.player.gold;
    
    // Stats
    const p = state.player;
    ['str','agi','vit','int','per'].forEach(s => {
        document.getElementById(`stat-${s}`).textContent = p.stats[s];
        document.getElementById(`buff-${s}`).textContent = `+${p.statBuffs[s]}`;
    });
    
    if(p.statPoints > 0) {
        document.getElementById("stat-points-alert").classList.remove("hidden");
        document.getElementById("stat-points-count").textContent = p.statPoints;
        document.querySelectorAll(".btn-allocate").forEach(b => b.disabled = false);
    } else {
        document.getElementById("stat-points-alert").classList.add("hidden");
        document.querySelectorAll(".btn-allocate").forEach(b => b.disabled = true);
    }
    
    renderQuests();
    if (typeof renderBuffs === 'function') renderBuffs();
    if (typeof renderShop === 'function') renderShop();
    if (typeof renderHomepageElements === 'function') renderHomepageElements();
    
    document.getElementById("mana-crystals-count").textContent = state.inventory.manaCrystals;
}

let currentChatFriendId = null;
let chatPollInterval = null;

async function renderNetworkTab() {
    refreshFriendsList();
}

async function refreshFriendsList() {
    const listContainer = document.getElementById("friends-list-container");
    if (!listContainer) return;
    
    const email = localStorage.getItem("arise_current_user");
    if (!email) return;

    try {
        const res = await fetch(`https://sovereign-6irh.onrender.com/api/friends/list?email=${email}`);
        const data = await res.json();
        
        if (data.success) {
            listContainer.innerHTML = "";
            if (data.friends.length === 0) {
                listContainer.innerHTML = `<div class="text-muted text-center mt-4" style="font-size: 0.8rem;">No active connections.</div>`;
                return;
            }
            
            data.friends.forEach(f => {
                const isSender = f.userId === data.userId;
                const friendUser = isSender ? f.friend : f.user;
                
                const div = document.createElement("div");
                div.style = "display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(0,0,0,0.5); border-radius: 4px; border-left: 2px solid var(--color-primary); margin-bottom: 5px; cursor: pointer;";
                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${friendUser.profileUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friendUser.hunterName}`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        <div>
                            <div style="font-weight: bold; font-size: 0.9rem; color: var(--color-secondary);">${friendUser.hunterName}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">${f.status === 'PENDING' ? 'Pending Request' : friendUser.rank + '-Rank'}</div>
                        </div>
                    </div>
                `;
                
                if (f.status === 'ACCEPTED') {
                    div.onclick = () => openChat(friendUser.id, friendUser.hunterName);
                } else if (!isSender) {
                    const btn = document.createElement("button");
                    btn.className = "btn-glow-blue btn-xs";
                    btn.innerText = "ACCEPT";
                    btn.onclick = (e) => { e.stopPropagation(); addFriend(friendUser.hunterName); };
                    div.appendChild(btn);
                }
                
                listContainer.appendChild(div);
            });
        }
    } catch (e) {
        listContainer.innerHTML = `<div class="text-red text-center mt-4">Failed to connect to Network.</div>`;
    }
}

async function addFriend(hunterName) {
    const email = localStorage.getItem("arise_current_user");
    try {
        const res = await fetch("https://sovereign-6irh.onrender.com/api/friends/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, friendHunterName: hunterName })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message);
            refreshFriendsList();
        } else {
            showToast(data.error, "error");
        }
    } catch (e) {
        showToast("Network Error", "error");
    }
}

function openChat(friendId, friendName) {
    currentChatFriendId = friendId;
    document.getElementById("chat-active-friend").innerHTML = `<i class="fas fa-comment-dots"></i> ${friendName}`;
    document.getElementById("chat-input-field").disabled = false;
    document.getElementById("btn-send-message").disabled = false;
    
    if (chatPollInterval) clearInterval(chatPollInterval);
    loadChatMessages();
    chatPollInterval = setInterval(loadChatMessages, 5000);
}

async function loadChatMessages() {
    if (!currentChatFriendId) return;
    const email = localStorage.getItem("arise_current_user");
    try {
        const res = await fetch(`https://sovereign-6irh.onrender.com/api/messages/list?email=${email}&friendId=${currentChatFriendId}`);
        const data = await res.json();
        if (data.success) {
            const container = document.getElementById("chat-messages-container");
            const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 10;
            
            container.innerHTML = "";
            if (data.messages.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; margin-top: 100px;">Channel secured. Begin transmission.</div>`;
                return;
            }
            
            data.messages.forEach(m => {
                const isSelf = m.senderId !== currentChatFriendId;
                const div = document.createElement("div");
                div.style = `max-width: 80%; padding: 10px; border-radius: 8px; font-size: 0.85rem; ${isSelf ? 'align-self: flex-end; background: rgba(0, 229, 255, 0.1); border-right: 2px solid var(--color-primary);' : 'align-self: flex-start; background: rgba(255, 255, 255, 0.05); border-left: 2px solid var(--text-muted);'}`;
                div.innerText = m.content;
                container.appendChild(div);
            });
            
            if (isScrolledToBottom) container.scrollTop = container.scrollHeight;
        }
    } catch (e) {
        console.error(e);
    }
}

// Stat Allocation
document.querySelectorAll(".btn-allocate").forEach(btn => {
    btn.addEventListener("click", (e) => {
        if(state.player.statPoints > 0) {
            const stat = e.target.getAttribute("data-stat");
            state.player.stats[stat]++;
            state.player.statPoints--;
            saveState();
            syncDashboard();
        }
    });
});

function applyAura() {
    document.body.setAttribute("data-theme", state.inventory.equippedAura);
}

// ==========================================
// QUESTS & VERIFICATION
// ==========================================
function generateDailies() {
    const p = state.player.profile || { arch: "", env: "", inv: "", weak: "" };
    
    let q1 = { id: "d1", name: "The Grind", desc: "Work on your primary stat.", type: "physical", mlKeywords: [], xp: 50, gold: 20, completed: false };
    
    if (p.arch.includes("Physical")) {
        q1.name = "The Iron Trial"; q1.desc = "Hit a compound lift or workout today."; q1.type = "physical";
        if (p.inv.includes("Weights")) q1.mlKeywords = ['dumbbell', 'barbell', 'weight'];
        else q1.mlKeywords = ['sneaker', 'shoe', 'person', 'park'];
    } else if (p.arch.includes("System")) {
        q1.name = "Hardware Synchronization"; q1.desc = "Progress on codebase or prototype."; q1.type = "physical";
        if (p.inv.includes("Microcontrollers")) q1.mlKeywords = ['breadboard', 'electronics', 'circuit', 'led', 'computer'];
        else q1.mlKeywords = ['screen', 'monitor', 'keyboard', 'laptop', 'computer'];
    } else if (p.arch.includes("Lore")) {
        q1.name = "The Scribe's Trial"; q1.desc = "Create 1 new page, sketch, or chapter."; q1.type = "physical";
        q1.mlKeywords = ['book', 'notebook', 'paper', 'pen', 'screen'];
    } else {
        q1.name = "Agility Training"; q1.desc = "Clear 3 tasks from your backlog."; q1.type = "mental"; 
    }

    let q2 = { id: "d2", name: "Conquer the Vice", desc: "Overcome your weakness.", type: "mental", completed: false, xp: 50, gold: 20 };
    if (p.weak.includes("Doomscrolling")) {
        q2.name = "Digital Detox"; q2.desc = "Leave phone in another room for 2 hours."; q2.type = "recovery";
    } else if (p.weak.includes("Diet")) {
        q2.name = "Dietary Recovery"; q2.desc = "Eat 1 entirely clean meal."; q2.type = "physical"; q2.mlKeywords = ['food', 'plate', 'vegetable', 'fruit', 'bowl'];
    } else if (p.weak.includes("Burnout")) {
        q2.name = "Mental Recovery"; q2.desc = "Go for a 15-minute walk without music."; q2.type = "recovery";
    } else {
        q2.name = "Consistency Push"; q2.desc = "Do not skip your grind today."; q2.type = "mental";
    }

    state.quests.daily = [q1, q2];
}

function renderQuests() {
    // Campaign Quests
    const campList = document.getElementById("campaign-container");
    if (campList) {
        campList.innerHTML = "";
        if (!state.quests.campaign) {
            state.quests.campaign = JSON.parse(JSON.stringify(DEFAULT_STATE.quests.campaign));
        }
        const nextCamp = state.quests.campaign.find(q => !q.completed);
        if (nextCamp) {
            const d = document.createElement("div");
            d.className = "quest-item";
            d.style.borderColor = "var(--color-gold)";
            d.style.boxShadow = "0 0 10px rgba(255, 215, 0, 0.2)";
            d.innerHTML = `
                <div>
                    <span class="q-title text-gold">${nextCamp.name}</span>
                    <span class="q-desc">${nextCamp.desc} (Rewards: ${nextCamp.xp}XP, ${nextCamp.gold}G)</span>
                </div>
                <div>
                    <button class="btn-glow-gold btn-xs" onclick="startVerification('${nextCamp.id}')">COMPLETE</button>
                </div>
            `;
            campList.appendChild(d);
        } else {
            campList.innerHTML = "<p class='text-muted'>All campaign quests completed. Waiting for System update...</p>";
        }
    }

    // Daily Quests
    const list = document.getElementById("daily-quest-items");
    list.innerHTML = "";
    state.quests.daily.forEach(q => {
        const d = document.createElement("div");
        d.className = "quest-item";
        d.innerHTML = `
            <div>
                <span class="q-title">${q.name}</span>
                <span class="q-desc">${q.desc} (Rewards: ${q.xp}XP, ${q.gold}G)</span>
            </div>
            <div>
                ${q.completed ? `<span class="badge-blue">CLEARED</span>` : `<button class="btn-glow-blue btn-xs" onclick="startVerification('${q.id}')">COMPLETE</button>`}
            </div>
        `;
        list.appendChild(d);
    });
    
    const redList = document.getElementById("red-gate-container");
    redList.innerHTML = "";
    state.quests.redGates.forEach(q => {
        const d = document.createElement("div");
        d.className = "quest-item red-gate";
        d.innerHTML = `
            <div>
                <span class="q-title text-red">${q.name}</span>
                <span class="q-desc">${q.desc} (Rewards: ${q.xp}XP, ${q.gold}G)</span>
            </div>
            <div>
                ${q.completed ? `<span class="badge-blue">CLEARED</span>` : `<button class="btn-glow-red btn-xs" onclick="startVerification('${q.id}')">DEFEAT</button>`}
            </div>
        `;
        redList.appendChild(d);
    });
}

// Verification Protocol
let currentQuestToVerify = null;
let webcamStream = null;

window.startVerification = function(id) {
    currentQuestToVerify = id;
    const q = state.quests.daily.find(x => x.id === id) || 
              state.quests.redGates.find(x => x.id === id) ||
              (state.quests.campaign && state.quests.campaign.find(x => x.id === id));
              
    document.getElementById("verification-modal").classList.remove("hidden");
    
    if (q.type === "physical") {
        document.getElementById("verification-prompt").textContent = "[PHYSICAL TASK] Snap a photo of your workout/equipment as proof.";
        document.getElementById("verification-camera-zone").classList.remove("hidden");
        document.getElementById("verification-text-zone").classList.add("hidden");
        
        // Init Camera
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                webcamStream = stream;
                document.getElementById("webcam-feed").srcObject = stream;
            }).catch(e => {
                document.getElementById("verification-prompt").textContent += " (Camera denied. Bypass allowed for testing).";
            });
    } else if (q.type === "recovery") {
        document.getElementById("verification-prompt").textContent = "[RECOVERY TASK] Please verify that you achieved the required rest.";
        document.getElementById("verification-camera-zone").classList.add("hidden");
        document.getElementById("verification-text-zone").classList.add("hidden");
    } else {
        document.getElementById("verification-prompt").textContent = "[MENTAL TASK] Log your exact output (min 20 chars).";
        document.getElementById("verification-camera-zone").classList.add("hidden");
        document.getElementById("verification-text-zone").classList.remove("hidden");
        document.getElementById("verification-log").value = "";
    }
}

document.getElementById("btn-cancel-verification").addEventListener("click", closeVerification);

function closeVerification() {
    document.getElementById("verification-modal").classList.add("hidden");
    if(webcamStream) {
        webcamStream.getTracks().forEach(t => t.stop());
        webcamStream = null;
    }
}

document.getElementById("btn-submit-verification").addEventListener("click", () => {
    const q = state.quests.daily.find(x => x.id === currentQuestToVerify) || 
              state.quests.redGates.find(x => x.id === currentQuestToVerify) ||
              (state.quests.campaign && state.quests.campaign.find(x => x.id === currentQuestToVerify));
              
    const btn = document.getElementById("btn-submit-verification");
    
    if (q.type === "mental") {
        const text = document.getElementById("verification-log").value;
        if (text.length < 20) {
            alert("System Error: Log too short. Submit adequate proof.");
            return;
        }
        processQuestCompletion(q);
    } else if (q.type === "physical") {
        btn.disabled = true;
        btn.textContent = "Loading ML Model...";
        
        // Capture photo
        const video = document.getElementById("webcam-feed");
        const canvas = document.getElementById("photo-canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // TensorFlow ML Integration
        if (typeof mobilenet !== 'undefined') {
            mobilenet.load().then(model => {
                btn.textContent = "Analyzing Pixels...";
                model.classify(canvas).then(predictions => {
                    let valid = false;
                    let keywords = q.mlKeywords || ['person', 'dumbbell', 'barbell', 'sneaker', 'shoe', 'keyboard', 'screen'];
                    if (keywords.length === 0) keywords = ['person']; // Fallback
                    
                    console.log("ML Predictions:", predictions, "Looking for:", keywords);
                    
                    for(let i=0; i<predictions.length; i++) {
                        const label = predictions[i].className.toLowerCase();
                        if(keywords.some(k => label.includes(k))) { valid = true; break; }
                    }
                    
                    if (valid) { 
                        // Removed the overly lenient probability fallback! Must match keyword.
                        btn.disabled = false;
                        btn.textContent = "SUBMIT PROOF";
                        alert(`ML Image Verified (${Math.round(predictions[0].probability * 100)}% confidence: ${predictions[0].className}). The System accepts your proof.`);
                        processQuestCompletion(q);
                    } else {
                        btn.disabled = false;
                        btn.textContent = "SUBMIT PROOF";
                        alert(`System Denial: Invalid Proof. The ML model detected a "${predictions[0].className}". Must contain a person or fitness object.`);
                    }
                });
            }).catch(err => {
                alert("Failed to load ML model. Are you offline? Proceeding with standard bypass.");
                btn.disabled = false;
                btn.textContent = "SUBMIT PROOF";
                processQuestCompletion(q);
            });
        } else {
            alert("TensorFlow.js not loaded. Bypassing verification for testing.");
            processQuestCompletion(q);
        }
    } else {
        // Recovery
        processQuestCompletion(q);
    }
});

function processQuestCompletion(q) {
    q.completed = true;
    state.player.xp += q.xp;
    state.player.gold += q.gold;
    
    // Apply stat rewards if applicable
    if (q.statReward) {
        state.player.stats[q.statReward.stat] += q.statReward.amt;
        alert(`Stat Increased! +${q.statReward.amt} ${q.statReward.stat.toUpperCase()}`);
    }
    
    // Level Up logic
    if (state.player.xp >= state.player.xpNeeded) {
        state.player.level++;
        state.player.xp -= state.player.xpNeeded;
        state.player.xpNeeded = Math.floor(state.player.xpNeeded * 1.5);
        state.player.statPoints += 5;
        alert(`LEVEL UP! You are now Level ${state.player.level}. +5 Stat Points.`);
    }
    
    // Random Drop
    if (Math.random() < 0.3) {
        state.inventory.manaCrystals++;
        alert("Dropped: 1x Mana Crystal!");
    }
    
    saveState();
    closeVerification();
    syncDashboard();
}

// ==========================================
// TABS & MODULES
// ==========================================
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        let targetBtn = e.target;
        if (!targetBtn.classList.contains("tab-btn")) {
            targetBtn = targetBtn.closest(".tab-btn");
        }
        
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
        
        targetBtn.classList.add("active");
        document.getElementById(targetBtn.getAttribute("data-target")).classList.add("active");
        
        // Mobile Sidebar Close
        const sidebar = document.getElementById("sidebar");
        if (sidebar && sidebar.classList.contains("open")) {
            sidebar.classList.remove("open");
        }
    });
});

// Mobile Hamburger Menu
document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
});

// Gate Scanner (Boss Raids)
document.getElementById("btn-scan-gates").addEventListener("click", () => {
    const btn = document.getElementById("btn-scan-gates");
    btn.disabled = true;
    btn.textContent = "SCANNING...";
    
    setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "SCAN FOR GATES";
        
        if (Math.random() < 0.3) {
            // Spawn Boss Raid
            document.getElementById("boss-raid-desc").textContent = "A Red Gate has opened! Objective: Burn 500 Calories or Run 5km today.";
            document.getElementById("boss-raid-overlay").classList.remove("hidden");
        } else {
            const gold = Math.floor(Math.random() * 20) + 5;
            state.player.gold += gold;
            alert(`You found a minor D-Rank Gate and cleared it automatically. +${gold} Gold.`);
            saveState();
            syncDashboard();
        }
    }, 2000);
});

document.getElementById("btn-engage-boss").addEventListener("click", () => {
    document.getElementById("boss-raid-overlay").classList.add("hidden");
    state.quests.redGates.push({ id: "boss_"+Date.now(), name: "Sovereign's Test", desc: "Burn 500 Calories or 5km Run.", type: "physical", completed: false, xp: 200, gold: 100, statReward: {stat: 'str', amt: 5} });
    alert("Boss Quest added to your log. Do not fail.");
    saveState();
    syncDashboard();
});

// Digital Detox Protocol (The Dungeon Gate)
let detoxInterval;
let isDetoxActive = false;

document.getElementById("btn-enter-gate").addEventListener("click", () => {
    const mins = parseInt(document.getElementById("gate-duration").value) || 25;
    let secs = mins * 60;
    
    isDetoxActive = true;
    document.getElementById("detox-overlay").classList.remove("hidden");
    
    detoxInterval = setInterval(() => {
        secs--;
        let m = Math.floor(secs / 60).toString().padStart(2, '0');
        let s = (secs % 60).toString().padStart(2, '0');
        document.getElementById("detox-timer").textContent = `${m}:${s}`;
        
        if (secs <= 0) {
            clearInterval(detoxInterval);
            isDetoxActive = false;
            document.getElementById("detox-overlay").classList.add("hidden");
            state.player.gold += mins * 2;
            state.player.xp += mins * 3;
            alert(`Detox Cleared! Earned ${mins*2}G and ${mins*3}XP.`);
            saveState();
            syncDashboard();
        }
    }, 1000);
});

document.getElementById("detox-deactivate-btn").addEventListener("click", () => {
    clearInterval(detoxInterval);
    isDetoxActive = false;
    document.getElementById("detox-overlay").classList.add("hidden");
    state.player.hp -= 30; // Massive damage
    alert("System Penalty: Detox Aborted. HP Decimated.");
    saveState();
    syncDashboard();
});

// Detox Cheat Detection (Page Visibility)
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && isDetoxActive) {
        // The user minimized the app or switched tabs!
        clearInterval(detoxInterval);
        isDetoxActive = false;
        document.getElementById("detox-overlay").classList.add("hidden");
        state.player.hp -= 50; 
        state.player.gold = 0; // Extremely severe penalty
        alert("SYSTEM VIOLATION DETECTED: You left the Detox Zone. HP Slashed by 50. All Gold Forfeited.");
        saveState();
        syncDashboard();
    }
});

// Stealth Mode
document.getElementById("btn-activate-stealth").addEventListener("click", () => {
    document.getElementById("btn-activate-stealth").classList.add("hidden");
    document.getElementById("btn-abort-stealth").classList.remove("hidden");
    alert("Stealth Mode Activated. Social media is now poison. The System expects discipline today.");
    state.stealthStreak++;
    saveState();
});

document.getElementById("btn-abort-stealth").addEventListener("click", () => {
    document.getElementById("btn-abort-stealth").classList.add("hidden");
    document.getElementById("btn-activate-stealth").classList.remove("hidden");
    state.player.hp = Math.floor(state.player.hp / 2);
    alert("System Penalty: You yielded to temptation. HP slashed in half.");
    saveState();
    syncDashboard();
});

// Mindscape
document.getElementById("btn-enter-mindscape").addEventListener("click", () => {
    document.getElementById("mindscape-overlay").classList.remove("hidden");
});
document.getElementById("btn-exit-mindscape").addEventListener("click", () => {
    document.getElementById("mindscape-overlay").classList.add("hidden");
});
document.getElementById("btn-complete-mindscape").addEventListener("click", () => {
    const log = document.getElementById("mindscape-journal").value;
    if (log.length > 20) {
        state.mindscapeCharges++;
        document.getElementById("mindscape-overlay").classList.add("hidden");
        alert("Aura of Clarity strengthened! Next penalty will be absorbed.");
        saveState();
        syncDashboard();
    } else {
        alert("Focus deeper. Provide more reflection.");
    }
});

// ==========================================
// SHOP SYSTEM
// ==========================================
function renderShop() {
    const irlGrid = document.getElementById("irl-shop-grid");
    const cosGrid = document.getElementById("cosmetics-shop-grid");
    
    irlGrid.innerHTML = "";
    state.shop.irl.forEach(item => {
        irlGrid.innerHTML += `
            <div class="shop-item-card">
                <span class="item-badge irl">IRL REWARD</span>
                <span class="item-title">${item.name}</span>
                <div class="item-footer">
                    <span class="item-price">${item.cost} G</span>
                    <button class="btn-glow-blue btn-xs" onclick="buyItem('${item.id}', 'irl')">BUY</button>
                </div>
            </div>
        `;
    });
    
    cosGrid.innerHTML = "";
    state.shop.cosmetics.forEach(item => {
        const owned = state.inventory.purchased.includes(item.id);
        let btnStr = `<button class="btn-glow-purple btn-xs" onclick="buyItem('${item.id}', 'cos')">BUY</button>`;
        if (owned) {
            btnStr = `<button class="btn-outline-gold btn-xs" onclick="equipItem('${item.id}')">EQUIP</button>`;
        }
        cosGrid.innerHTML += `
            <div class="shop-item-card">
                <span class="item-badge cosmetic">SYSTEM</span>
                <span class="item-title">${item.icon} ${item.name}</span>
                <div class="item-footer">
                    <span class="item-price">${owned ? 'OWNED' : item.cost + ' G'}</span>
                    ${btnStr}
                </div>
            </div>
        `;
    });
}

document.getElementById("btn-add-irl-reward").addEventListener("click", () => {
    const name = prompt("Name the IRL reward:");
    if (!name) return;
    
    // Heuristic Auditor
    let price = 50;
    const lower = name.toLowerCase();
    if(lower.includes("car") || lower.includes("pc") || lower.includes("vacation")) price = 10000;
    else if(lower.includes("keyboard") || lower.includes("shoes") || lower.includes("game")) price = 1500;
    else if(lower.includes("coffee") || lower.includes("nap") || lower.includes("movie")) price = 100;
    
    const confirmPrice = confirm(`System Auditor Evaluation:\nValue determined at ${price} Gold.\nAccept terms?`);
    if (confirmPrice) {
        state.shop.irl.push({ id: 'irl_'+Date.now(), name, cost: price });
        saveState();
        syncDashboard();
    }
});

window.buyItem = function(id, type) {
    let item;
    if (type === 'irl') item = state.shop.irl.find(i => i.id === id);
    else item = state.shop.cosmetics.find(i => i.id === id);
    
    if (state.player.gold >= item.cost) {
        state.player.gold -= item.cost;
        if (type === 'cos') {
            state.inventory.purchased.push(item.id);
            alert(`Purchased Cosmetic: ${item.name}`);
        } else {
            alert(`Transaction Complete! Enjoy your IRL reward: ${item.name}`);
        }
        saveState();
        syncDashboard();
    } else {
        alert("System Denial: Insufficient Gold.");
    }
}

window.equipItem = function(id) {
    const item = state.shop.cosmetics.find(i => i.id === id);
    if (item.type === "aura") state.inventory.equippedAura = item.theme;
    if (item.type === "title") state.inventory.equippedTitle = item.name;
    if (item.type === "avatar") state.player.avatar = item.icon;
    saveState();
    syncDashboard();
}

// Synthesis
document.querySelectorAll(".btn-craft").forEach(btn => {
    btn.addEventListener("click", (e) => {
        const cost = parseInt(e.target.getAttribute("data-cost"));
        if (state.inventory.manaCrystals >= cost) {
            state.inventory.manaCrystals -= cost;
            state.player.hp = Math.min(state.player.maxHp, state.player.hp + 30);
            alert("Crafted Elixir of Vitality! Recovered 30 HP.");
            saveState();
            syncDashboard();
        } else {
            alert("Insufficient Mana Crystals.");
        }
    });
});

// ==========================================
// MINDSCAPE & NETWORK LISTENERS
// ==========================================
document.getElementById("btn-enter-mindscape")?.addEventListener("click", () => {
    document.getElementById("mindscape-overlay").classList.remove("hidden");
});

document.getElementById("btn-exit-mindscape")?.addEventListener("click", () => {
    document.getElementById("mindscape-overlay").classList.add("hidden");
});

document.getElementById("btn-complete-mindscape")?.addEventListener("click", () => {
    document.getElementById("mindscape-overlay").classList.add("hidden");
    state.buffs.push({ name: "Aura of Clarity", stat: "all", amt: 0, expires: Date.now() + 86400000 });
    saveState();
    syncDashboard();
});

// Network Tab Listeners
document.getElementById("btn-form-guild")?.addEventListener("click", async () => {
    const statusDiv = document.getElementById("discord-queue-status");
    if(statusDiv) statusDiv.classList.remove("hidden");
    
    try {
        const res = await fetch("https://sovereign-6irh.onrender.com/api/guild/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: state.player.name || "TestUser", guildName: (state.player.name || "TestUser") + "'s Guild" })
        });
        const data = await res.json();
        
        // Simulate backend queue delay for Discord API provisioning in the UI
        setTimeout(() => {
            if(statusDiv) statusDiv.classList.add("hidden");
            alert("SYSTEM ALERT: Guild formed! Discord Channel provisioned successfully.");
            
            document.getElementById("current-guild-display").textContent = data.guild?.name || "Guild";
            document.getElementById("current-guild-display").classList.remove("text-muted");
            document.getElementById("current-guild-display").classList.add("text-gold");
            
            const btn = document.getElementById("btn-connect-discord");
            if(btn) {
                btn.innerHTML = `<i class="fab fa-discord"></i> ENTER DISCORD SERVER`;
                // Open exactly to the ARISE Master Server!
                btn.onclick = () => window.open("https://discord.com/channels/1510574556513828884", "_blank");
            }
        }, 3000);
    } catch (e) {
        if(statusDiv) statusDiv.classList.add("hidden");
        alert("SYSTEM ERROR: Backend is offline. Is Node server running?");
    }
});

document.getElementById("btn-connect-discord")?.addEventListener("click", (e) => {
    if(!e.target.onclick) {
        alert("SYSTEM ALERT: You must form or join a Guild first.");
    }
});

// ==========================================
// NEW UI LISTENERS & GATE LOGIC
// ==========================================
document.querySelectorAll("#hub-tabs .chat-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll("#hub-tabs .chat-tab-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        renderNetworkTab();
    });
});

function initGateScanner() {
    const mapContainer = document.getElementById("gate-map-container");
    if (!mapContainer) return;
    
    mapContainer.innerHTML = "";
    
    const gateTypes = [
        { rank: 'E', class: 'gate-rank-e', quest: 'Walk 10,000 steps' },
        { rank: 'D', class: 'gate-rank-d', quest: 'Read 20 pages' },
        { rank: 'C', class: 'gate-rank-c', quest: 'Code for 2 hours' },
        { rank: 'B', class: 'gate-rank-b', quest: 'Run 5km' },
        { rank: 'A', class: 'gate-rank-a', quest: 'Deep work 4 hours' },
        { rank: 'S', class: 'gate-rank-s', quest: 'Complete the impossible task on your backlog' }
    ];
    
    const numGates = Math.floor(Math.random() * 3) + 3;
    for(let i=0; i<numGates; i++) {
        const type = gateTypes[Math.floor(Math.random() * gateTypes.length)];
        const posX = 10 + Math.random() * 80;
        const posY = 15 + Math.random() * 70;
        
        const portal = document.createElement("div");
        portal.className = `gate-portal ${type.class}`;
        portal.style.left = `${posX}%`;
        portal.style.top = `${posY}%`;
        
        const ring = document.createElement("div");
        ring.className = "pulse-ring";
        portal.appendChild(ring);
        
        portal.addEventListener("click", () => {
            const accept = confirm(`SYSTEM ALERT: ${type.rank}-Rank Gate Detected!\\nObjective: ${type.quest}\\n\\nDo you wish to enter this gate?`);
            if (accept) {
                alert(`You have entered the ${type.rank}-Rank Gate. Objective added to active quests.`);
                portal.remove();
            }
        });
        
        mapContainer.appendChild(portal);
    }
}

document.getElementById("btn-scan-gates")?.addEventListener("click", () => {
    initGateScanner();
});

window.submitArbitrationVote = async function(submissionId, vote) {
    try {
        await fetch('https://sovereign-6irh.onrender.com/api/reviews/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submissionId, reviewerId: state.player.name || "TestUser", vote })
        });
        alert(`SYSTEM ALERT: Verification ${vote}. +5 Mana Crystals awarded.`);
        renderNetworkTab(); // reload queue to get next item
    } catch (e) {
        alert('SYSTEM ERROR: Failed to submit vote.');
    }
}

// ==========================================
// DAILY TIMER LOGIC
// ==========================================
window.updateDailyTimer = function() {
    const timerElement = document.getElementById("daily-timer");
    if (!timerElement) return;
    
    // Clear existing timer if any to prevent duplicates
    if (window.dailyTimerInterval) clearInterval(window.dailyTimerInterval);
    
    const tick = () => {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const diff = tomorrow - now;
        
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
        const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
        const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
        
        timerElement.textContent = `TIME REMAINING: ${h}:${m}:${s}`;
    };
    
    tick(); // run instantly
    window.dailyTimerInterval = setInterval(tick, 1000);
}
// ==========================================
// PROFILE SETTINGS LOGIC
// ==========================================
document.getElementById("btn-save-settings")?.addEventListener("click", async () => {
    const newName = document.getElementById("settings-username").value.trim();
    const newAvatar = document.getElementById("settings-avatar-url").value.trim();
    
    if (!newName && !newAvatar) return showToast("No changes detected.", "error");

    const email = localStorage.getItem("arise_current_user");
    const updateData = { email };
    
    if (newName) updateData.hunterName = newName;
    if (newAvatar) updateData.profileUrl = newAvatar;

    document.getElementById("btn-save-settings").innerText = "SAVING...";

    try {
        const res = await fetch("https://sovereign-6irh.onrender.com/api/user/update-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateData)
        });
        
        const data = await res.json();
        
        if (res.ok) {
            if (newName) state.player.name = newName;
            if (newAvatar) state.player.profileUrl = newAvatar;
            saveState();
            syncDashboard();
            showToast("Profile Settings Synchronized!");
            
            document.getElementById("settings-username").value = "";
            document.getElementById("settings-avatar-url").value = "";
        } else {
            showToast(data.error || "Failed to update settings.", "error");
        }
    } catch (e) {
        showToast("System Error: Could not connect to database.", "error");
    }
    
    document.getElementById("btn-save-settings").innerText = "SAVE PROFILE UPDATES";
});

// ==========================================
// FRIENDS & MESSAGING UI LOGIC
// ==========================================
document.getElementById("btn-add-friend")?.addEventListener("click", () => {
    const friendName = document.getElementById("friend-search-input").value.trim();
    if (!friendName) return showToast("Enter a Hunter Name.", "error");
    addFriend(friendName);
    document.getElementById("friend-search-input").value = "";
});

document.getElementById("btn-send-message")?.addEventListener("click", async () => {
    const content = document.getElementById("chat-input-field").value.trim();
    if (!content || !currentChatFriendId) return;
    
    const email = localStorage.getItem("arise_current_user");
    document.getElementById("btn-send-message").disabled = true;
    
    try {
        const res = await fetch("https://sovereign-6irh.onrender.com/api/messages/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, receiverId: currentChatFriendId, content })
        });
        
        if (res.ok) {
            document.getElementById("chat-input-field").value = "";
            loadChatMessages();
        } else {
            showToast("Failed to send message.", "error");
        }
    } catch(e) {
        showToast("Comms Error.", "error");
    }
    document.getElementById("btn-send-message").disabled = false;
});

// ==========================================
// HOMEPAGE RENDERING LOGIC
// ==========================================

const SYSTEM_QUOTES = [
    "If I am to be a tool, then I'll be a tool that thinks for itself.",
    "The system uses me, and I use the system.",
    "There is no limit to my growth.",
    "A hunter must always be prepared.",
    "I alone level up.",
    "I will protect my family, even if it means fighting the world.",
    "ARISE.",
    "The only one who can save me is myself.",
    "To survive, I must become stronger than the monsters."
];

window.renderHomepageElements = function() {
    // Render Daily Progress Ring
    const totalDailies = state.quests.filter(q => q.type === 'daily').length || 1; // avoid / 0
    const completedDailies = state.quests.filter(q => q.type === 'daily' && q.completed).length;
    const percentage = Math.round((completedDailies / totalDailies) * 100);
    
    const ringText = document.getElementById("daily-progress-text");
    if (ringText) ringText.innerText = `${percentage}%`;
    
    const ringContainer = document.querySelector(".daily-ring-container");
    if (ringContainer) {
        ringContainer.style.background = `conic-gradient(var(--color-primary) ${percentage}%, rgba(255,255,255,0.05) ${percentage}%)`;
    }
    
    // Set random quote
    const quoteEl = document.getElementById("system-quote-text");
    if (quoteEl) {
        const randomQuote = SYSTEM_QUOTES[Math.floor(Math.random() * SYSTEM_QUOTES.length)];
        quoteEl.innerText = `"${randomQuote}"`;
    }
    
    // Add generic System Logs just for flavor based on recent levels
    const sysLog = document.getElementById("system-log-terminal");
    if (sysLog) {
        sysLog.innerHTML = `
            <div style="color: var(--text-muted);">[SYSTEM] Neural link established.</div>
            <div style="color: var(--color-primary);">[SYSTEM] Welcome back, Sovereign.</div>
            <div style="color: var(--text-muted);">[LOG] Last synced: ${new Date().toLocaleTimeString()}</div>
            <div style="color: var(--color-gold);">[STATUS] Current Rank: ${state.player.rank}</div>
            <div style="color: var(--color-blue);">[STATS] Level ${state.player.level} | XP ${state.player.xp}/${state.player.xpToNextLevel}</div>
        `;
    }
}
