/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * CHAT SYSTEM â€” js/chat.js
 *   Simulated live chat matching Spribe/Interbet reference UI:
 *   masked usernames Â· colored avatars Â· HH:MM:SS timestamps
 *   heart/like buttons Â· context-aware messages Â· rain events
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

class ChatSystem {
    constructor(betManager) {
        this.betManager = betManager;
        this.messagesEl  = document.getElementById('chatMessages');
        this.inputEl     = document.getElementById('chatInput');
        this.sendBtn     = document.getElementById('chatSendBtn');
        this.onlineEl    = document.getElementById('chatOnline');
        this.rainBanner  = document.getElementById('rainBanner');
        this.rainClaimBtn= document.getElementById('rainClaimBtn');
        this.rainAmountEl= document.getElementById('rainAmount');
        this.rainTimerEl = document.getElementById('rainTimer');

        this._maxMessages = 60;
        this._rainActive  = false;
        this._rainTimerId = null;
        this._gameState   = 'waiting';

        /* â”€â”€ Avatar colour palette (matches Spribe style) â”€â”€â”€â”€â”€â”€â”€ */
        this._COLORS = [
            '#e63946','#457b9d','#2a9d8f','#e9c46a','#f4a261',
            '#264653','#a8dadc','#6d6875','#b5838d','#e76f51',
            '#3a86ff','#8338ec','#fb5607','#ff006e','#ffbe0b',
            '#06d6a0','#118ab2','#073b4c','#ef233c','#d62828'
        ];

        /* â”€â”€ Realistic player names (diverse African / global) â”€â”€â”€ */
        this._names = [
            'LuckyCharm_KE','SpinMaster_KE','JackpotJoe','DiamondHands',
            'MegaWins_KE','WolfPack254','FalconBet_KE','SwiftBet_KE',
            'BraveHeart254','IronMan_KE','NightOwl254','IceCold_254',
            'HawkBet_254','DolphinBet','SharpBet254','TriumphKE',
            'FearlessBet','EagleEye_KE','StarPlayer','FlyCash_254',
            'BigWin_NBO','BlazeBet_KE','GoldRush_KE','DragonBet254',
            'PhoenixBet','SunBet_KE','TigerLuck_KE','CobraBet254',
            'VictoryBet','GloryBet254','ChampBet_254','QuickBet_KE',
            'BoldBet_KE','ValiantBet','NobleGamer','RoyalBet_KE',
            'PrinceBet254','ProGamer_KE','CryptoQueen','RocketBet',
            'NairobiAce','MombasaKid','WinStreak254','TurboPlayer',
            'EliteBet99','SilverFox254','CashFlow254','PantherBet',
            'SpartanBet','GladiatorBet'
        ];

        /* â”€â”€ Context-aware message pools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        this._waitingMsgs = [
            'Betting 500 this round ðŸ’°',
            'Going all in! ðŸ”¥',
            '2x and out, playing safe ðŸ“ˆ',
            'Let\'s see a 50x tonight! ðŸš€',
            'Who else betting big?',
            'Small bets steady wins ðŸŽ¯',
            'I feel lucky this round ðŸ€',
            'Auto cash at 2x, safe play',
            'Third time\'s the charm ðŸŽ²',
            'Let me recoup my losses ðŸ˜…',
            'Max bet! Let\'s go! ðŸ’ª',
            'This round is mine ðŸ”¥',
            'Watch me hit 10x today',
            'Just deposited, let\'s gooo',
            'Low bets gang ðŸ™Œ',
            'I got a feeling about this one',
            'Dropping 1K on this ðŸ’¸',
            'Anyone else on auto bet?',
            '5 seconds to liftoff âœˆï¸',
            'Round starts soon... ready!',
        ];

        this._flyingMsgs = [
            'HOLD! Don\'t cash out yet! ðŸ’ŽðŸ™Œ',
            'Cash out NOW!!! ðŸ˜±',
            'It\'s climbing!! ðŸ“ˆ',
            'OMG it\'s still going!!',
            'I cashed out at 2x, phew ðŸ˜…',
            'HOLD HOLD HOLD ðŸ”¥ðŸ”¥ðŸ”¥',
            'Should I cash out?! Help!',
            'Already at 5x, wow!',
            'Paper hands cashed too early ðŸ˜‚',
            'I\'m sweating rn ðŸ˜°',
            'Let it fly baby âœˆï¸',
            'Cashed out! Easy money ðŸ’¸',
            'My heart is racing ðŸ’“',
            'Just cashed at 3x ðŸ˜Ž',
            'I\'m holding to 10x ðŸŽ¯',
            'Not yet not yet not yet...',
            'Who else still holding?!',
            'Going to 20x!! ðŸš€ðŸš€',
            'Don\'t be greedy now...',
            'GREEN CANDLE ðŸŸ¢ðŸŸ¢ðŸŸ¢',
        ];

        this._crashedMsgs = [
            'Knew it would crash there ðŸ’€',
            'Should have cashed at 2x ðŸ˜©',
            'GG easy win! ðŸ’¸',
            'F for those who didn\'t cash ðŸ˜”',
            'That was close! Got out just in time',
            'Lost everything that round ðŸ˜­',
            'The plane betrayed us âœˆï¸ðŸ’¥',
            'Crashed so fast wtf ðŸ˜‚',
            'At least I cashed out ðŸ˜Œ',
            'My auto cashout saved me ðŸ™',
            'That 1.02x crash was brutal',
            'Time to bet again!',
            'I called it! I knew it!',
            'Pain. Just pain. ðŸ’”',
            'Easy 3x, love this game â¤ï¸',
            'Wow that was a high one!',
            'RIP my balance ðŸª¦',
            'Another round, another chance ðŸŽ°',
            'Patience is key guys ðŸ”‘',
            'Redemption arc next round ðŸ˜¤',
        ];

        this._generalMsgs = [
            'Who else is up tonight? ðŸŒ™',
            'First time here, any tips?',
            'This game is so addictive lol',
            'Best game ever tbh ðŸŽ®',
            'Greetings from Mombasa! ðŸ–ï¸',
            'Nairobi gang represent ðŸ‡°ðŸ‡ª',
            'Just won 5K let\'s gooo ðŸŽ‰',
            'Anyone else playing all night? ðŸ˜‚',
            'Rain please! ðŸŒ§ï¸',
            'Where\'s the rain at?? â˜”',
            'Admin send rain! ðŸ™',
            'Can someone explain auto bet?',
            'Started with 100, now at 5000!',
            'My strategy: never go above 3x',
            'Just lost 2K in 5 minutes ðŸ¤¡',
            'Gotta know when to fold â™ ï¸',
            'I have never seen this ðŸ˜®',
            'We have seen it all ðŸ˜Ž',
            '13 blues yohhh ðŸ˜¤',
            'Yoh I\'m out ðŸš¶',
            'From 7k bets to half ðŸ“‰',
            'I ate all the bluereeeee ðŸ”µ',
        ];

        this._init();
    }

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    _maskName(name) {
        // "LuckyCharm_KE" â†’ "l***e"  (first + *** + last)
        if (!name || name.length < 2) return name;
        const clean = name.replace(/[^a-zA-Z0-9]/g, ''); // strip underscores etc.
        if (clean.length < 3) return clean[0] + '***';
        return clean[0].toLowerCase() + '***' + clean[clean.length - 1].toLowerCase();
    }

    _avatarColor(name) {
        // deterministic color per name
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return this._COLORS[Math.abs(hash) % this._COLORS.length];
    }

    _timestamp() {
        return new Date().toTimeString().slice(0, 8); // HH:MM:SS
    }

    _getContextMessage() {
        const useCtx = Math.random() < 0.65;
        if (useCtx) {
            switch (this._gameState) {
                case 'waiting':  return this._waitingMsgs[Math.floor(Math.random() * this._waitingMsgs.length)];
                case 'flying':   return this._flyingMsgs[Math.floor(Math.random() * this._flyingMsgs.length)];
                case 'crashed':
                case 'cooldown': return this._crashedMsgs[Math.floor(Math.random() * this._crashedMsgs.length)];
            }
        }
        return this._generalMsgs[Math.floor(Math.random() * this._generalMsgs.length)];
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    _init() {
        if (this.sendBtn) this.sendBtn.addEventListener('click', () => this._sendUserMessage());
        if (this.inputEl) this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._sendUserMessage();
        });
        if (this.rainClaimBtn) this.rainClaimBtn.addEventListener('click', () => this._claimRain());

        this._startAutoChat();
        this._scheduleRain();
        this._updateOnlineCount();
        setInterval(() => this._updateOnlineCount(), 18000);

        // Seed with initial messages
        for (let i = 0; i < 8; i++) {
            // Stagger back in time so timestamps look natural
            setTimeout(() => this._addBotMessage(), i * 120);
        }
    }

    setGameState(state) { this._gameState = state; }

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MESSAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    _sendUserMessage() {
        const text = this.inputEl ? this.inputEl.value.trim() : '';
        if (!text) return;
        this._addMessage('You', text, true);
        if (this.inputEl) this.inputEl.value = '';
    }

    _addBotMessage() {
        const name = this._names[Math.floor(Math.random() * this._names.length)];
        this._addMessage(name, this._getContextMessage(), false);
    }

    _addMessage(name, text, isUser = false) {
        if (!this.messagesEl) return;

        const masked  = isUser ? 'You' : this._maskName(name);
        const color   = isUser ? '#42c766' : this._avatarColor(name);
        const initial = (isUser ? 'Y' : name[0]).toUpperCase();
        const time    = this._timestamp();
        // Random like count (0-4), biased to 0
        const likes   = isUser ? 0 : (Math.random() < 0.35 ? Math.ceil(Math.random() * 4) : 0);

        const div = document.createElement('div');
        div.className = 'chat-msg' + (isUser ? ' chat-msg-user' : '');
        div.innerHTML = `
            <div class="chat-avatar" style="background:${color}">${initial}</div>
            <div class="chat-msg-content">
                <div class="chat-meta-row">
                    <span class="chat-name">${this._escapeHtml(masked)}</span>
                    <span class="chat-time">${time}</span>
                </div>
                <div class="chat-text">${this._escapeHtml(text)}</div>
            </div>
            <div class="chat-msg-likes">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                ${likes > 0 ? `<span>${likes}</span>` : ''}
            </div>
        `;

        // Like button interaction
        const likeBtn = div.querySelector('.chat-msg-likes');
        likeBtn.addEventListener('click', () => {
            const cur = parseInt(likeBtn.dataset.count || likes) || 0;
            const next = cur + 1;
            likeBtn.dataset.count = next;
            likeBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span>${next}</span>
            `;
            likeBtn.style.color = '#e63946';
        });

        this.messagesEl.appendChild(div);

        // Trim oldest messages
        while (this.messagesEl.children.length > this._maxMessages) {
            this.messagesEl.removeChild(this.messagesEl.firstChild);
        }

        // Scroll to bottom
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    _addSystemMessage(text) {
        if (!this.messagesEl) return;
        const div = document.createElement('div');
        div.className = 'chat-msg chat-msg-system';
        div.innerHTML = `<div class="chat-system-text">${text}</div>`;
        this.messagesEl.appendChild(div);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ AUTO CHAT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    _startAutoChat() {
        const post = () => {
            this._addBotMessage();
            // Speed: very fast during flight, moderate otherwise
            let min = 2500, max = 5000;
            if (this._gameState === 'flying')            { min = 700;  max = 2000; }
            else if (this._gameState === 'crashed' ||
                     this._gameState === 'cooldown')     { min = 1200; max = 3000; }
            setTimeout(post, min + Math.random() * max);
        };
        setTimeout(post, 1500);
    }

    _updateOnlineCount() {
        const base = window._adminOnlineCount || 0;
        const count = base > 0 ? base : (100 + Math.floor(Math.random() * 300));
        if (this.onlineEl) this.onlineEl.textContent = count;
    }

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ RAIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    _scheduleRain() {
        const delay = 60000 + Math.random() * 120000; // 1â€“3 min
        setTimeout(() => this._triggerRain(), delay);
    }

    _triggerRain() {
        if (this._rainActive) return;
        this._rainActive = true;

        const currency = this.betManager.currency || 'KES';
        const amount   = (2 + Math.floor(Math.random() * 19)) * 10;
        if (this.rainAmountEl) this.rainAmountEl.textContent = `${amount} ${currency}`;
        if (this.rainBanner)   this.rainBanner.dataset.amount = amount;
        if (this.rainBanner)   this.rainBanner.style.display = 'flex';
        this._addSystemMessage(`ðŸŒ§ï¸ <strong>Aviator Rain!</strong> Free ${amount} ${currency} â€” claim it fast!`);

        let remaining = 10;
        if (this.rainTimerEl) this.rainTimerEl.textContent = remaining + 's';
        this._rainTimerId = setInterval(() => {
            remaining--;
            if (this.rainTimerEl) this.rainTimerEl.textContent = remaining + 's';
            if (remaining <= 0) this._expireRain();
        }, 1000);
    }

    _claimRain() {
        if (!this._rainActive) return;
        const amount = parseInt(this.rainBanner ? this.rainBanner.dataset.amount : 50) || 50;
        const currency = this.betManager.currency || 'KES';
        this.betManager.balance += amount;
        this.betManager._notifyBalanceChange();
        this._addSystemMessage(`ðŸŽ‰ You claimed <strong>${amount} ${currency}</strong> from Aviator Rain!`);
        this._hideRain();
    }

    _expireRain() {
        if (!this._rainActive) return;
        this._addSystemMessage('â° Rain expired! Be faster next time.');
        this._hideRain();
    }

    _hideRain() {
        this._rainActive = false;
        clearInterval(this._rainTimerId);
        if (this.rainBanner) this.rainBanner.style.display = 'none';
        this._scheduleRain();
    }
}