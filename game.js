//  GLOBAL STATE (Static Members)

class Company {
    static capital = 10000;
    static totalEmployees = 0;
    
    static paySalaries() {
        const cost = this.totalEmployees * 50;
        this.capital -= cost;
        return cost;
    }
}


// OOPS CHARACTER HIERARCHY
class Person extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, name) {
        super(scene, x, y, texture);
        this.name = name;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setCollideWorldBounds(true);
        this.setDisplaySize(28, 40);
    }
}

class Manager extends Person {
    constructor(scene, x, y, texture, name, projectDesc) {
        super(scene, x, y, texture, name);
        this._team = [];
        this._projectProgress = 0;
        this.projectDescription = projectDesc;
        // Store last pixel position for bar redraw tracking
        this._lastBarX = -1;
        this._lastBarY = -1;
        this._lastPct   = -1;
    }

    work(hasSynergy = false) {
        if (this._team.length > 0) {
            const mult = hasSynergy ? 0.01 : 0.005;
            this._projectProgress += this._team.length * mult;
            if (this._projectProgress > 100) this._projectProgress = 100;
        }
    }

    hire() {
        if (Company.capital >= 500) {
            this._team.push({ id: Date.now() });
            Company.capital -= 500;
            Company.totalEmployees++;
            return "SUCCESS: Hired! Team: " + this._team.length;
        }
        return "ERROR: Not enough capital!";
    }

    fire() {
        if (this._team.length > 0) {
            this._team.pop();
            Company.totalEmployees--;
            console.log(`[DESTRUCTOR]: Employee destroyed for ${this.name}`);
            return "TERMINATED. Team: " + this._team.length;
        }
        return "ERROR: No employees to fire!";
    }
}

class Boss extends Person {
    constructor(scene, x, y, texture, name) {
        super(scene, x, y, texture, name);
    }
    getGlobalStats(managers) {
        let total = 0;
        managers.forEach(m => total += m._projectProgress);
        return managers.length > 0 ? total / managers.length : 0;
    }
}


//  PHASER ENGINE CONFIG

const config = {
    type: Phaser.AUTO,
    width: 768, height: 480,
    pixelArt: true,
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

let player, bossChar, managers = [], cursors, roomZones = {};
let actionFeedback = "";

let playerArrow;
let progressBars   = [];   
let progressLabels = [];   
let synergyIcon;
let hudGraphics, hudText;

// Stats screen overlay (computer in top-left room)
let statsScreen, statsScreenText, statsScreenVisible = false;

// Floating text cap
let activeFloats = 0;
const MAX_FLOATS = 4;

const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';


// Exact room boundaries (from tile analysis)

// Fire zone:  cols 18-29 → x 288-464,  rows 0-7 → y 0-112
// Hire zone:  cols 34-45 → x 544-720,  rows 0-7 → y 0-112  
// Stats room: cols 0-12  → x 0-192,    rows 0-12 → y 0-192
// Cafeteria:  cols 32-47 → x 512-752,  rows 13-29 → y 208-464
const ZONES = {
    fire:      { x: 289, y: 1,   w: 174, h: 110 },
    hire:      { x: 545, y: 1,   w: 174, h: 110 },
    stats:     { x: 1,   y: 1,   w: 190, h: 190 },
    cafeteria: { x: 513, y: 209, w: 238, h: 254 },
};


// PRELOAD

function preload() {
    this.load.image('tiles', 'assets/spritesheet.png');
    this.load.tilemapTiledJSON('map', 'assets/map.json');
    this.load.image('boss_img',  'assets/Boss.png');
    this.load.image('m1_img',    'assets/Manager1.png');
    this.load.image('m2_img',    'assets/Manager2.png');
    this.load.image('m3_img',    'assets/Manager3.png');
    this.load.image('m4_img',    'assets/Manager4.png');
}


// Floating popup text — capped to avoid lag

function spawnFloat(scene, x, y, msg, color) {
    if (activeFloats >= MAX_FLOATS) return;
    activeFloats++;
    const ft = scene.add.text(x, y, msg, {
        fontFamily: PIXEL_FONT, fontSize: '11px',
        fill: color, stroke: '#000', strokeThickness: 5,
    }).setDepth(200).setOrigin(0.5);
    scene.tweens.add({
        targets: ft, y: y - 52, alpha: 0, duration: 2000,
        ease: 'Cubic.Out',
        onComplete: () => { ft.destroy(); activeFloats--; }
    });
}


// Progress bar — plain fillRect (fast, no rounded)

function drawBar(gfx, x, y, w, h, pct, isActive) {
    gfx.clear();
    
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(x, y, w, h);
    
    const col = pct < 40 ? 0xff3333 : pct < 75 ? 0xffcc00 : 0x33ff88;
    const fw = Math.max(0, Math.floor((w - 2) * pct / 100));
    if (fw > 0) { gfx.fillStyle(col, 1); gfx.fillRect(x + 1, y + 1, fw, h - 2); }

    gfx.lineStyle(isActive ? 2 : 1, isActive ? 0xffffff : 0x555555, 1);
    gfx.strokeRect(x, y, w, h);
}


function create() {
    // --- Tilemap ---
    const map     = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('spritefusion', 'tiles');
    map.createLayer('FLOOR',      tileset, 0, 0);
    const el1   = map.createLayer('ELEMENTS_1', tileset, 0, 0);
    map.createLayer('ELEMENTS_2', tileset, 0, 0);
    const walls = map.createLayer('WALLS',      tileset, 0, 0);
    walls.setCollisionByExclusion([-1]);
    el1.setCollisionByExclusion([-1]);

    // --- Characters ---
    bossChar = new Boss(this, 96, 160, 'boss_img', "CEO Mahi");
    bossChar.setDepth(310); 
    managers = [
        new Manager(this, 380, 175, 'm1_img', "Mgr Ali",   "AI Dev"),
        new Manager(this, 430, 175, 'm2_img', "Mgr Sam",   "Security"),
        new Manager(this, 480, 175, 'm3_img', "Mgr Priya", "Data"),
        new Manager(this, 530, 175, 'm4_img', "Mgr Dev",   "UI"),
    ];
    player = bossChar;
    this.physics.add.collider([bossChar, ...managers], [walls, el1]);

   
    // Zone visuals + physics — coords from ZONES table above
   
    const zoneEntries = [
        { key: 'fire',
          label: 'FIRE ZONE', sub: '[X] to Fire',
          fillColor: 0xff3333, labelColor: '#ff5555' },
        { key: 'hire',
          label: 'HIRE ZONE', sub: '[H] to Hire',
          fillColor: 0x00ff88, labelColor: '#00ff88' },
        { key: 'cafeteria',
          label: 'CAFETERIA', sub: 'Meet for Synergy',
          fillColor: 0x4488ff, labelColor: '#88bbff' },
    ];

    zoneEntries.forEach(({ key, label, sub, fillColor, labelColor }) => {
        const z = ZONES[key];
        // Physics zone — origin(0) means x,y is top-left
        roomZones[key] = this.add.zone(z.x, z.y, z.w, z.h).setOrigin(0);
        this.physics.add.existing(roomZones[key], true);

        // Visual overlay exactly matching the zone rect
        const g = this.add.graphics();
        g.fillStyle(fillColor, 0.13);
        g.fillRect(z.x, z.y, z.w, z.h);
        g.lineStyle(3, fillColor, 1);
        g.strokeRect(z.x, z.y, z.w, z.h);

        // Labels centred inside zone
        this.add.text(z.x + z.w / 2, z.y + 10, label, {
            fontFamily: PIXEL_FONT, fontSize: '11px',
            fill: labelColor, align: 'center',
            stroke: '#000', strokeThickness: 6,
        }).setOrigin(0.5, 0).setDepth(55);

        this.add.text(z.x + z.w / 2, z.y + 40, sub, {
            fontFamily: PIXEL_FONT, fontSize: '9px',
            fill: '#ffffff', align: 'center',
            stroke: '#000', strokeThickness: 5,
        }).setOrigin(0.5, 0).setDepth(55);
    });

    // Stats room physics zone (no visual overlay — it's the CEO's home room)
    const sz = ZONES.stats;
    roomZones.stats = this.add.zone(sz.x, sz.y, sz.w, sz.h).setOrigin(0);
    this.physics.add.existing(roomZones.stats, true);


    const SP = { x: 390, y: 8, w: 372, h: 388 }; 

    statsScreen = this.add.graphics().setDepth(300).setVisible(false);
    // Draw once (static background — never cleared)
    statsScreen.fillStyle(0x001400, 0.97);
    statsScreen.fillRoundedRect(SP.x, SP.y, SP.w, SP.h, 6);
    statsScreen.lineStyle(2, 0x00ff55, 1);
    statsScreen.strokeRoundedRect(SP.x, SP.y, SP.w, SP.h, 6);
    // Top accent bar
    statsScreen.fillStyle(0x00cc44, 1);
    statsScreen.fillRoundedRect(SP.x, SP.y, SP.w, 4, { tl: 6, tr: 6, bl: 0, br: 0 });
    // Scanline texture (every 4px, very subtle)
    statsScreen.fillStyle(0x000000, 0.08);
    for (let sy = SP.y + 4; sy < SP.y + SP.h; sy += 4) {
        statsScreen.fillRect(SP.x + 1, sy, SP.w - 2, 2);
    }

    statsScreenText = this.add.text(SP.x + 14, SP.y + 14, '', {
        fontFamily: PIXEL_FONT,
        fontSize: '8px',
        fill: '#00ff88',
        stroke: '#001400',
        strokeThickness: 2,
        lineSpacing: 6,
        wordWrap: { width: SP.w - 28 },
    }).setDepth(301).setVisible(false);

   
    // Active character arrow
    
    playerArrow = this.add.text(0, 0, 'v', {
        fontFamily: PIXEL_FONT, fontSize: '13px',
        fill: '#ffff00', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(150);
    this.tweens.add({
        targets: playerArrow, y: playerArrow.y + 5, alpha: 0.6,
        duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut'
    });

   
    // Per-manager progress bars + labels
   
    managers.forEach(() => {
        progressBars.push(this.add.graphics().setDepth(120));
        progressLabels.push(
            this.add.text(0, 0, '0%', {
                fontFamily: PIXEL_FONT, fontSize: '7px',
                fill: '#fff', stroke: '#000', strokeThickness: 4,
            }).setDepth(125).setOrigin(0.5, 1)
        );
    });

   
    // Cafeteria synergy badge
   
    const cz = ZONES.cafeteria;
    synergyIcon = this.add.text(cz.x + cz.w / 2, cz.y + 70, '* SYNERGY! *', {
        fontFamily: PIXEL_FONT, fontSize: '10px',
        fill: '#ffff00', stroke: '#000', strokeThickness: 5,
        backgroundColor: '#332200', padding: { x: 8, y: 5 }
    }).setOrigin(0.5).setDepth(160).setVisible(false);
    this.tweens.add({
        targets: synergyIcon, scaleX: 1.07, scaleY: 1.07,
        duration: 400, yoyo: true, repeat: -1, ease: 'Sine.InOut'
    });

   
    hudGraphics = this.add.graphics().setDepth(100);
    hudText = this.add.text(18, 0, '', {
        fontFamily: PIXEL_FONT, fontSize: '11px',
        fill: '#ffffff', stroke: '#000', strokeThickness: 4,
        lineSpacing: 8, wordWrap: { width: 735 }
    }).setDepth(101);

    // Input — Save on E (not S, avoids move-down conflict)
   
    cursors = this.input.keyboard.addKeys({
        W: 'W', S: 'S', A: 'A', D: 'D',
        ONE: 'ONE', TWO: 'TWO', THREE: 'THREE', FOUR: 'FOUR', FIVE: 'FIVE',
        H: 'H', X: 'X', SAVE: 'E',
    });

    // --- Salary timer ---
    this.time.addEvent({
        delay: 10000, loop: true,
        callback: () => {
            const cost = Company.paySalaries();
            actionFeedback = `PAYDAY: -$${cost} deducted`;
            spawnFloat(this, 384, 290, `-$${cost} SALARIES`, '#ff6666');
        }
    });
}



function update() {
    const speed = 160;
    bossChar.setVelocity(0);
    managers.forEach(m => m.setVelocity(0));

    // Cafeteria synergy check
    let managersInCafe = [];
    managers.forEach(m => {
        if (this.physics.overlap(m, roomZones.cafeteria)) managersInCafe.push(m);
    });
    const isSynergy = managersInCafe.length >= 2;
    managers.forEach(m => m.work(isSynergy));
    synergyIcon.setVisible(isSynergy);

    // Character switch
    if (Phaser.Input.Keyboard.JustDown(cursors.ONE))   player = bossChar;
    if (Phaser.Input.Keyboard.JustDown(cursors.TWO))   player = managers[0];
    if (Phaser.Input.Keyboard.JustDown(cursors.THREE)) player = managers[1];
    if (Phaser.Input.Keyboard.JustDown(cursors.FOUR))  player = managers[2];
    if (Phaser.Input.Keyboard.JustDown(cursors.FIVE))  player = managers[3];

    // Movement
    if (cursors.A.isDown)      player.setVelocityX(-speed);
    else if (cursors.D.isDown) player.setVelocityX(speed);
    if (cursors.W.isDown)      player.setVelocityY(-speed);
    else if (cursors.S.isDown) player.setVelocityY(speed);

    // Save (E key)
    if (Phaser.Input.Keyboard.JustDown(cursors.SAVE)) {
        localStorage.setItem('tycoonSave', JSON.stringify({ funds: Company.capital }));
        actionFeedback = "SAVED!";
        spawnFloat(this, player.x, player.y - 24, 'SAVED!', '#88ffcc');
    }

   
    // Arrow — follow active player exactly
    
    playerArrow.setPosition(player.x, player.y - 26);

    
    // Progress bars — redraw only when pos or value changes
    // Bars positioned relative to each manager's current world position
    
    managers.forEach((m, i) => {
        const pct      = Math.floor(m._projectProgress);
        const isActive = (player === m);
        const bx = Math.floor(m.x) - 22;
        const by = Math.floor(m.y) - 40;

        // Redraw if value, active state, or position changed
        if (pct !== m._lastPct || isActive !== m._lastActive ||
            bx !== m._lastBarX || by !== m._lastBarY) {
            drawBar(progressBars[i], bx, by, 44, 7, pct, isActive);
            m._lastPct    = pct;
            m._lastActive = isActive;
            m._lastBarX   = bx;
            m._lastBarY   = by;
        }
        // Label always repositioned (cheap, just a setPosition)
        progressLabels[i].setPosition(m.x, by - 1).setText(pct + '%');
    });

   
    // STATS SCREEN — show when boss is in stats room
    
    const bossInStats = this.physics.overlap(bossChar, roomZones.stats);

    if (bossInStats) {
        const globalPct = bossChar.getGlobalStats(managers);
        const divider = '─────────────────────';
        const lines = [
            '=== COMPANY STATS ===',
            divider,
            `Capital : $${Company.capital}`,
            `Staff   : ${Company.totalEmployees}`,
            `Avg Prog: ${Math.floor(globalPct)}%`,
            divider,
            'DEPARTMENTS:',
            ...managers.map(m =>
                `${m.name} [${m.projectDescription}]\n  ${m._team.length} staff  ${Math.floor(m._projectProgress)}%`
            ),
        ];
        statsScreenText.setText(lines.join('\n'));
        statsScreen.setVisible(true);
        statsScreenText.setVisible(true);
    } else {
        statsScreen.setVisible(false);
        statsScreenText.setVisible(false);
    }

   
    let hud = `> ${player.name}  $${Company.capital}  Staff:${Company.totalEmployees}`;

    // Boss proximity audit
    managers.forEach(m => {
        const dist = Phaser.Math.Distance.Between(bossChar.x, bossChar.y, m.x, m.y);
        if (dist < 55) {
            hud = `[AUDIT] ${m.name} — ${m.projectDescription}\n` +
                  `Staff: ${m._team.length}    Progress: ${Math.floor(m._projectProgress)}%`;
        }
    });

    // Zone interactions
    if (this.physics.overlap(player, roomZones.hire)) {
        hud = `HIRE ZONE  |  [H] to Hire  |  Cost: $500`;
        if (Phaser.Input.Keyboard.JustDown(cursors.H) && player instanceof Manager) {
            const r = player.hire();
            actionFeedback = r;
            const ok = r.startsWith('SUCCESS');
            spawnFloat(this, player.x, player.y - 24, ok ? '+1 HIRED!' : 'NO FUNDS!', ok ? '#00ff88' : '#ff4444');
        }
    } else if (this.physics.overlap(player, roomZones.fire)) {
        hud = `FIRE ZONE  |  [X] to Fire`;
        if (Phaser.Input.Keyboard.JustDown(cursors.X) && player instanceof Manager) {
            const r = player.fire();
            actionFeedback = r;
            const ok = r.startsWith('TERMINATED');
            spawnFloat(this, player.x, player.y - 24, ok ? '-1 FIRED' : 'NO STAFF!', ok ? '#ffaa44' : '#ff4444');
        }
    } else if (bossInStats) {
        hud = `STATS ROOM  |  CEO reviewing company data...`;
    }

    if (actionFeedback) {
        hud += `\n> ${actionFeedback}`;
        this.time.delayedCall(3000, () => { actionFeedback = ""; });
    }

    if (isSynergy && managersInCafe.length >= 2) {
        const m1 = managersInCafe[0], m2 = managersInCafe[1];
        hud += `\nCOLLAB: ${m1.name}(${Math.floor(m1._projectProgress)}%) + ${m2.name}(${Math.floor(m2._projectProgress)}%) = 2x!`;
    }

    hudText.setText(hud);

    // Resize HUD panel
    const lines = hud.split('\n').length;
    const hudH  = Math.max(52, lines * 22 + 16);
    const hudY  = 480 - hudH - 4;
    hudText.setY(hudY + 10);

    hudGraphics.clear();
    hudGraphics.fillStyle(0x050f05, 0.92);
    hudGraphics.fillRoundedRect(6, hudY, 756, hudH, 5);
    hudGraphics.fillStyle(0x00cc55, 1);
    hudGraphics.fillRoundedRect(6, hudY, 756, 4, { tl: 5, tr: 5, bl: 0, br: 0 });
    hudGraphics.lineStyle(2, 0x00aa44, 1);
    hudGraphics.strokeRoundedRect(6, hudY, 756, hudH, 5);
}
