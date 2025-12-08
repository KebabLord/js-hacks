// ==UserScript==
// @name         Fun Killer for Steal Brainrot Online
// @version      5.5
// @namespace    https://github.com/Kebablord/js-hacks/tree/master/steal-brainrot
// @description  Intercept WebSocket send/recv, apply toggles, track players, and select hex items
// @match        https://crazygames.cdn.msnfun.com/*
// @match        https://app-447574.games.*.yandex.net/447574*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Avoid installing multiple times in the same window
    if (window.__WS_TEST1337_INSTALLED__) {
        return;
    }
    window.__WS_TEST1337_INSTALLED__ = true;

    console.log('test7331: this page loaded me:', window.location.href);

    var OriginalWebSocket = window.WebSocket;
    if (!OriginalWebSocket) {
        return;
    }

    // =========================
    // Pointer lock helper
    // =========================
    function releasePointerLock() {
        try {
            if (document.exitPointerLock) {
                document.exitPointerLock();
            } else if (document.mozExitPointerLock) {
                document.mozExitPointerLock();
            } else if (document.webkitExitPointerLock) {
                document.webkitExitPointerLock();
            }
        } catch (e) {
            // ignore
        }
    }

    // =========================
    // Toast helper
    // =========================
    function showToast(message) {
        var DURATION = 2000; // ms
        var containerId = '__toast_container_bl';

        // Ensure container exists (bottom-left)
        var c = document.getElementById(containerId);
        if (!c) {
            c = document.createElement('div');
            c.id = containerId;
            Object.assign(c.style, {
                position: 'fixed',
                left: '32px',
                bottom: '32px',
                display: 'flex',
                flexDirection: 'column-reverse',
                gap: '16px',
                maxWidth: '40vw',
                zIndex: '2147483647',
                pointerEvents: 'none'
            });
            (document.body || document.documentElement).appendChild(c);
        }

        // Create toast
        var t = document.createElement('div');
        t.textContent = String(message);
        Object.assign(t.style, {
            background: '#111111',
            color: '#ffffff',
            fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
            fontSize: '28px',
            lineHeight: '1.2',
            padding: '20px 24px',
            borderRadius: '16px',
            boxShadow: '0 12px 36px rgba(0,0,0,.35)',
            pointerEvents: 'none',
            opacity: '0',
            transform: 'translateY(16px)',
            transition: 'opacity 180ms ease-out, transform 180ms ease-out',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere'
        });

        c.appendChild(t);

        // Animate in
        requestAnimationFrame(function() {
            t.style.opacity = '1';
            t.style.transform = 'translateY(0)';
        });

        // Animate out shortly before removal
        setTimeout(function() {
            t.style.opacity = '0';
            t.style.transform = 'translateY(16px)';
        }, DURATION - 180);

        // Remove
        setTimeout(function() {
            if (t.parentNode) {
                t.parentNode.removeChild(t);
            }
            if (c.children.length === 0) {
                c.remove();
            }
        }, DURATION);
    }

    // =========================
    // HUD (bottom-right status)
    // =========================
    var HUD_CONTAINER_ID = '__hack_status_br';

    function ensureHudContainer() {
        var c = document.getElementById(HUD_CONTAINER_ID);
        if (!c) {
            c = document.createElement('div');
            c.id = HUD_CONTAINER_ID;
            Object.assign(c.style, {
                position: 'fixed',
                right: '16px',
                bottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '4px',
                zIndex: '2147483647',
                pointerEvents: 'none',
                fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
                fontSize: '12px',
                color: '#ffffff',
                textShadow: '0 0 2px #000, 0 0 4px #000'
            });
            (document.body || document.documentElement).appendChild(c);
        }
        return c;
    }

    function updateStatusHud(flags) {
        var fullForceEnabled = !!flags.fullForceEnabled;
        var fullRangeEnabled = !!flags.fullRangeEnabled;
        var sleepyEnabled = !!flags.sleepyEnabled;
        var weirdSpeedEnabled = !!flags.weirdSpeedEnabled;

        var anyOn = fullForceEnabled || fullRangeEnabled || sleepyEnabled || weirdSpeedEnabled;
        var c = document.getElementById(HUD_CONTAINER_ID);

        if (!anyOn) {
            if (c) {
                c.style.display = 'none';
            }
            return;
        }

        c = ensureHudContainer();
        c.style.display = 'flex';
        c.innerHTML = '';

        if (fullForceEnabled) {
            var line1 = document.createElement('div');
            line1.textContent = 'fullforce enabled';
            c.appendChild(line1);
        }
        if (fullRangeEnabled) {
            var line2 = document.createElement('div');
            line2.textContent = 'fullrange enabled';
            c.appendChild(line2);
        }
        if (sleepyEnabled) {
            var line3 = document.createElement('div');
            line3.textContent = 'sleepy enabled';
            c.appendChild(line3);
        }
        if (weirdSpeedEnabled) {
            var line4 = document.createElement('div');
            line4.textContent = 'weird speed enabled';
            c.appendChild(line4);
        }
    }

    // =========================
    // Global state / toggles
    // =========================
    var wsList = [];
    window.wsList = wsList;

    var fullForceEnabled   = false; // key 9
    var fullRangeEnabled   = false; // key 7
    var sleepyEnabled      = false; // key 8
    var weirdSpeedEnabled  = true; // key 6
    var customEnabled      = false; // for development

    window.TEST1337_FULLFORCE   = fullForceEnabled;
    window.TEST1337_FULLRANGE   = fullRangeEnabled;
    window.TEST1337_SLEEPY      = sleepyEnabled;
    window.TEST1337_WEIRDSPEED  = weirdSpeedEnabled;

    console.log('fullforce disabled (default)');
    updateStatusHud({
        fullForceEnabled: fullForceEnabled,
        fullRangeEnabled: fullRangeEnabled,
        sleepyEnabled: sleepyEnabled,
        weirdSpeedEnabled: weirdSpeedEnabled
    });

    // =========================
    // Known players list
    // =========================
    var KNOWN_PLAYERS_MAX = 30;
    var knownPlayers = [];
    window.known_players = knownPlayers;
    window.TEST1337_PLAYERS = knownPlayers;

    var currentTargetPlayer = null; // { username, uuid }
    var currentFloor = 0;           // 0,1,2
    var MAX_FLOOR = 2;

    function addKnownPlayer(username, uuid) {
        if (!username || !uuid) return;

        // dedupe by uuid
        var i;
        for (i = 0; i < knownPlayers.length; i++) {
            if (knownPlayers[i].uuid === uuid) {
                return;
            }
        }

        // newest on top
        knownPlayers.unshift({
            username: username,
            uuid: uuid,
            ts: Date.now()
        });

        if (knownPlayers.length > KNOWN_PLAYERS_MAX) {
            knownPlayers.pop();
        }
    }

    // =========================
    // Packets (hex -> Uint8Array)
    // =========================
    var FREEZE_PACKET_HEX =
        '92d2000000389501c0d9757b0a2020226566666563745f6964223a2022667265657a65222c0a202022636173745f656666656374223a20224963654e6f7661222c0a20202272616e6765223a202239393939222c0a202022667265657a65223a20223939393939222c0a2020226475726174696f6e223a202234303030220a7d93cac1dccd72ca3f05729cca423e176d93ca80000000ca43af31e0ca00000000';

    var C_PACKET_HEX =
        '92d2000000389503c0d9487b0a2020226566666563745f6964223a202273706565647570222c0a20202273706565647570223a20223430303030222c0a2020226475726174696f6e223a202239393939220a7d93cac13f7922ca3cb02090ca42b7fbbb93ca80000000ca431577f4ca80000000';

    // Z (vines)
    var VINES_PACKET_HEX =
        '92d2000000389501c0d96b7b0a2020226566666563745f6964223a202270756d706b696e222c0a2020226475726174696f6e223a202239393939222c0a20202272616e6765223a202239393939222c0a202022636173745f6566666563745f6e223a202250756d706b696e46585f737061776e220a7d93cac166dd1eca3cb02120ca4225be3e93ca80000000ca43a55ae1ca00000000';

    // B (swarm)
    var SWARM_PACKET_HEX =
        '92d2000000389501c0d9667b0a2020226566666563745f6964223a2022737761726d222c0a202022636173745f6566666563745f6e223a2022537761726d46785f43617374222c0a2020226475726174696f6e223a202239393939222c0a20202272616e6765223a202239393939220a7d93ca4182341aca3ca18900ca42a7be3b93ca80000000ca4385f2eaca00000000';

    function hexToUint8Array(hex) {
        if (typeof hex !== 'string') {
            return new Uint8Array(0);
        }
        var clean = hex.trim();
        if (clean.length % 2 !== 0) {
            return new Uint8Array(0);
        }
        var len = clean.length / 2;
        var arr = new Uint8Array(len);
        var i;
        for (i = 0; i < len; i++) {
            var byteStr = clean.substr(i * 2, 2);
            arr[i] = parseInt(byteStr, 16);
        }
        return arr;
    }

    var FREEZE_PACKET = hexToUint8Array(FREEZE_PACKET_HEX);
    var C_PACKET      = hexToUint8Array(C_PACKET_HEX);
    var VINES_PACKET  = hexToUint8Array(VINES_PACKET_HEX);
    var SWARM_PACKET  = hexToUint8Array(SWARM_PACKET_HEX);

    function getLastOpenWebSocket() {
        var i;
        for (i = wsList.length - 1; i >= 0; i--) {
            var ws = wsList[i];
            if (ws && ws.readyState === OriginalWebSocket.OPEN) {
                return ws;
            }
        }
        return null;
    }

    function sendFreezePacket() {
        var ws = getLastOpenWebSocket();
        if (!ws) return;
        try {
            ws.send(FREEZE_PACKET);
        } catch (e) {}
    }

    function sendCPacket() {
        var ws = getLastOpenWebSocket();
        if (!ws) return;
        try {
            ws.send(C_PACKET);
        } catch (e) {}
    }

    function sendVinesPacket() {
        var ws = getLastOpenWebSocket();
        if (!ws) return;
        try {
            ws.send(VINES_PACKET);
        } catch (e) {}
    }

    function sendSwarmPacket() {
        var ws = getLastOpenWebSocket();
        if (!ws) return;
        try {
            ws.send(SWARM_PACKET);
        } catch (e) {}
    }

    // =========================
    // Hex helpers for incoming parsing
    // =========================
    function bufferToHex(uint8) {
        var hex = '';
        var i;
        for (i = 0; i < uint8.length; i++) {
            var h = uint8[i].toString(16);
            if (h.length < 2) h = '0' + h;
            hex += h;
        }
        return hex;
    }

    function hexToAscii(hex) {
        var out = '';
        var i;
        for (i = 0; i < hex.length; i += 2) {
            var code = parseInt(hex.substr(i, 2), 16);
            if (!isNaN(code)) {
                out += String.fromCharCode(code);
            }
        }
        return out;
    }

    function hexToUtf8(hex) {
        if (!hex || typeof hex !== 'string') return '';
        var len = Math.floor(hex.length / 2);
        var bytes = new Uint8Array(len);
        var i;
        for (i = 0; i < len; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
        }
        try {
            if (typeof TextDecoder !== 'undefined') {
                return new TextDecoder('utf-8').decode(bytes);
            }
        } catch (e) {}
        // fallback: naïve
        var s = '';
        for (i = 0; i < bytes.length; i++) {
            s += String.fromCharCode(bytes[i]);
        }
        return s;
    }

    function asciiToHex(str) {
        var hex = '';
        var i;
        for (i = 0; i < str.length; i++) {
            var h = str.charCodeAt(i).toString(16);
            if (h.length < 2) h = '0' + h;
            hex += h;
        }
        return hex;
    }

    // Incoming regex: uuid, slot-byte, username (UTF-8 printable)
    var INCOMING_RE = new RegExp(
        '((?:3[0-9]|6[1-6]){8}2d(?:3[0-9]|6[1-6]){4}2d(?:3[0-9]|6[1-6]){4}2d(?:3[0-9]|6[1-6]){4}2d(?:3[0-9]|6[1-6]){12})' +
        '92d20000000091' +
        '([0-9a-f]{2})' +
        '(?=(?:(?!(?:3[0-9]|6[1-6]){8}2d).)*92d20000000191[0-9a-f]{2}' +
        '((?:2[0-9a-f]|3[0-9a-f]|4[0-9a-f]|5[0-9a-f]|6[0-9a-f]|7[0-9e]|c2[89ab][0-9a-f]|c[3-9a-f][8-9a-b][0-9a-f]|d[0-9a-f][8-9a-b][0-9a-f]|e[0-9a-f](?:8[0-9a-b]|9[0-9a-f]|a[0-9a-f]|b[0-9a-f])[0-9a-f]{2}|f0(?:8[0-9a-b]|9[0-9a-f]|a[0-9a-f]|b[0-9a-f])[0-9a-f]{3}){8,400})' +
        '92d20000000191)',
        'g'
    );

    function processIncomingHex(hex) {
        INCOMING_RE.lastIndex = 0;
        var match;
        while ((match = INCOMING_RE.exec(hex)) !== null) {
            var uuidHex = match[1];
            var slotHex = match[2];
            var usernameHex = match[3];

            var uuid = hexToAscii(uuidHex);
            var slotNum = parseInt(slotHex, 16);
            if (isNaN(slotNum)) {
                continue;
            }
            var slotStr = slotNum < 10 ? '0' + slotNum : String(slotNum);

            var username = hexToUtf8(usernameHex);

            console.log('NEW1337: ' + username + ' in ' + slotStr + ' slot with ' + uuid);

            addKnownPlayer(username, uuid);
        }
    }

    function handleIncomingData(data) {
        var hex;
        if (typeof data === 'string') {
            var bytes = new Uint8Array(data.length);
            var i;
            for (i = 0; i < data.length; i++) {
                bytes[i] = data.charCodeAt(i) & 0xff;
            }
            hex = bufferToHex(bytes);
            processIncomingHex(hex);
        } else if (data instanceof ArrayBuffer) {
            hex = bufferToHex(new Uint8Array(data));
            processIncomingHex(hex);
        } else if (ArrayBuffer.isView(data)) {
            var view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            hex = bufferToHex(view);
            processIncomingHex(hex);
        } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
            try {
                var fr = new FileReader();
                fr.onload = function() {
                    var buf = new Uint8Array(fr.result);
                    var h = bufferToHex(buf);
                    processIncomingHex(h);
                };
                fr.readAsArrayBuffer(data);
            } catch (e) {
                // ignore
            }
        }
    }

    // =========================
    // Player list popup
    // =========================
    var PLAYER_POPUP_ID = '__ws_player_popup_1337';
    var SLOT_POPUP_ID   = '__ws_slot_popup_1337';
    var HEX_POPUP_ID    = '__ws_hex_popup_1337';

    function closeOverlayById(id) {
        var el = document.getElementById(id);
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    function openPlayerListPopup() {
        releasePointerLock();

        closeOverlayById(PLAYER_POPUP_ID);
        closeOverlayById(SLOT_POPUP_ID);
        closeOverlayById(HEX_POPUP_ID);

        if (knownPlayers.length === 0) {
            showToast('No known players yet');
            return;
        }

        var overlay = document.createElement('div');
        overlay.id = PLAYER_POPUP_ID;
        Object.assign(overlay.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            right: '0',
            bottom: '0',
            background: 'rgba(0,0,0,.45)',
            zIndex: '2147483647',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto'
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeOverlayById(PLAYER_POPUP_ID);
            }
        });

        var panel = document.createElement('div');
        Object.assign(panel.style, {
            background: '#111',
            color: '#fff',
            borderRadius: '10px',
            padding: '16px 20px',
            minWidth: '260px',
            maxWidth: '420px',
            maxHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 36px rgba(0,0,0,.5)',
            fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif'
        });

        panel.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        var header = document.createElement('div');
        header.textContent = 'Known players (' + knownPlayers.length + ')';
        Object.assign(header.style, {
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '8px'
        });
        panel.appendChild(header);

        var list = document.createElement('div');
        Object.assign(list.style, {
            overflowY: 'auto',
            paddingRight: '4px',
            marginBottom: '10px',
            maxHeight: '45vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
        });

        var i;
        for (i = 0; i < knownPlayers.length; i++) {
            (function(player) {
                var row = document.createElement('div');
                Object.assign(row.style, {
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: '#1b1b1b',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                });

                row.addEventListener('mouseenter', function() {
                    row.style.background = '#222';
                });
                row.addEventListener('mouseleave', function() {
                    row.style.background = '#1b1b1b';
                });

                row.addEventListener('click', function() {
                    console.log(player.username + ' with ' + player.uuid + ' is clicked');

                    var prev = currentTargetPlayer;
                    if (!prev || prev.uuid !== player.uuid) {
                        // switched to a different user -> reset floor
                        currentFloor = 0;
                    }

                    currentTargetPlayer = {
                        username: player.username,
                        uuid: player.uuid
                    };
                    closeOverlayById(PLAYER_POPUP_ID);
                    openSlotPopupForPlayer(currentTargetPlayer);
                });

                var nameLine = document.createElement('div');
                nameLine.textContent = player.username;
                Object.assign(nameLine.style, {
                    fontWeight: '500'
                });

                var uuidLine = document.createElement('div');
                uuidLine.textContent = player.uuid;
                Object.assign(uuidLine.style, {
                    fontSize: '11px',
                    opacity: '0.7',
                    wordBreak: 'break-all'
                });

                row.appendChild(nameLine);
                row.appendChild(uuidLine);
                list.appendChild(row);
            })(knownPlayers[i]);
        }

        panel.appendChild(list);

        var footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
        });

        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            padding: '4px 10px',
            borderRadius: '6px',
            border: 'none',
            background: '#333',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px'
        });
        closeBtn.addEventListener('click', function() {
            closeOverlayById(PLAYER_POPUP_ID);
        });
        closeBtn.addEventListener('mouseenter', function() {
            closeBtn.style.background = '#444';
        });
        closeBtn.addEventListener('mouseleave', function() {
            closeBtn.style.background = '#333';
        });

        footer.appendChild(closeBtn);
        panel.appendChild(footer);

        overlay.appendChild(panel);
        (document.body || document.documentElement).appendChild(overlay);
    }

    // =========================
    // Slot picker popup (with floors and hex items)
    // =========================
    function openSlotPopupForPlayer(player) {
        if (!player || !player.username || !player.uuid) {
            return;
        }

        // NO reset here -> keeps last floor for same user
        releasePointerLock();

        closeOverlayById(PLAYER_POPUP_ID);
        closeOverlayById(SLOT_POPUP_ID);
        closeOverlayById(HEX_POPUP_ID);

        var overlay = document.createElement('div');
        overlay.id = SLOT_POPUP_ID;
        Object.assign(overlay.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            right: '0',
            bottom: '0',
            background: 'rgba(0,0,0,.45)',
            zIndex: '2147483647',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto'
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeOverlayById(SLOT_POPUP_ID);
            }
        });

        var panel = document.createElement('div');
        Object.assign(panel.style, {
            background: '#111',
            color: '#fff',
            borderRadius: '10px',
            padding: '16px 20px',
            minWidth: '340px',
            maxWidth: '380px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 36px rgba(0,0,0,.5)',
            fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif'
        });

        panel.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        var title = document.createElement('div');
        title.textContent = 'Items for ' + player.username;
        Object.assign(title.style, {
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '10px'
        });
        panel.appendChild(title);

        var mainArea = document.createElement('div');
        Object.assign(mainArea.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr) 60px',
            gridTemplateRows: '1fr 50px 1fr',
            gap: '4px',
            alignItems: 'center',
            justifyItems: 'center',
            marginBottom: '12px',
            background: '#000',
            padding: '8px',
            borderRadius: '6px'
        });

        var slotButtons = [];
        var greenBox; // will be created later

        function updateSlotLabels() {
            var i;
            for (i = 0; i < slotButtons.length; i++) {
                var btn = slotButtons[i];
                var idx = btn.__slotIndex;
                var decId = idx + currentFloor * 10; // +10 (decimal) per floor
                var hexId = decId.toString(16);
                if (hexId.length < 2) hexId = '0' + hexId;
                btn.textContent = hexId;
            }
        }

        function updateFloorLabel() {
            if (greenBox) {
                greenBox.textContent = String(currentFloor + 1); // show 1/2/3
            }
        }

        function updateFloorAndSlots() {
            updateSlotLabels();
            updateFloorLabel();
        }

        function makeSlotButton(index) {
            var btn = document.createElement('div');
            btn.__slotIndex = index;
            Object.assign(btn.style, {
                width: '40px',
                height: '32px',
                borderRadius: '4px',
                border: '1px solid #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                userSelect: 'none'
            });
            btn.addEventListener('mouseenter', function() {
                btn.style.background = '#222';
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.background = 'transparent';
            });
            btn.addEventListener('click', function() {
                var idx = btn.__slotIndex;
                var decId = idx + currentFloor * 10;
                var hexId = decId.toString(16);
                if (hexId.length < 2) hexId = '0' + hexId;

                console.log(player.username + ' with ' + player.uuid + ' item: ' + hexId);

                // Build and send WS packet:
                // 92d20000003192d924 + <uuid in hex> + <item hex>
                var ws = getLastOpenWebSocket();
                if (ws && ws.readyState === OriginalWebSocket.OPEN) {
                    var uuidHex = asciiToHex(player.uuid || '');
                    var packetHex = '92d20000003192d924' + uuidHex + hexId;
                    var bytes = hexToUint8Array(packetHex);
                    try {
                        ws.send(bytes);
                    } catch (e) {}
                }

                closeOverlayById(SLOT_POPUP_ID);
            });
            slotButtons.push(btn);
            return btn;
        }

        var i;

        // top row slots 0-4
        for (i = 0; i <= 4; i++) {
            var btnTop = makeSlotButton(i);
            btnTop.style.gridRow = '1';
            btnTop.style.gridColumn = (i + 1).toString();
            mainArea.appendChild(btnTop);
        }

        // bottom row slots 5-9
        for (i = 5; i <= 9; i++) {
            var btnBottom = makeSlotButton(i);
            btnBottom.style.gridRow = '3';
            btnBottom.style.gridColumn = (i - 4).toString(); // 5->1, 9->5
            mainArea.appendChild(btnBottom);
        }

        // middle black strip
        var midArea = document.createElement('div');
        Object.assign(midArea.style, {
            gridRow: '2',
            gridColumn: '1 / span 5',
            width: '100%',
            height: '40px',
            border: '1px solid #444',
            background: '#000'
        });
        mainArea.appendChild(midArea);

        // plus button (above green box)
        var plusBtn = document.createElement('div');
        plusBtn.textContent = '+';
        Object.assign(plusBtn.style, {
            gridRow: '1',
            gridColumn: '6',
            width: '40px',
            height: '24px',
            borderRadius: '4px',
            border: '1px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '18px'
        });
        plusBtn.addEventListener('mouseenter', function() {
            plusBtn.style.background = '#222';
        });
        plusBtn.addEventListener('mouseleave', function() {
            plusBtn.style.background = 'transparent';
        });
        plusBtn.addEventListener('click', function() {
            if (currentFloor < MAX_FLOOR) {
                currentFloor++;
                updateFloorAndSlots();
            }
        });
        mainArea.appendChild(plusBtn);

        // green direction box (fixed position, also shows floor)
        greenBox = document.createElement('div');
        Object.assign(greenBox.style, {
            gridRow: '2',
            gridColumn: '6',
            width: '40px',
            height: '40px',
            borderRadius: '4px',
            background: '#00ff00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '700',
            fontSize: '16px'
        });
        mainArea.appendChild(greenBox);

        // minus button (below green box)
        var minusBtn = document.createElement('div');
        minusBtn.textContent = '-';
        Object.assign(minusBtn.style, {
            gridRow: '3',
            gridColumn: '6',
            width: '40px',
            height: '24px',
            borderRadius: '4px',
            border: '1px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '18px'
        });
        minusBtn.addEventListener('mouseenter', function() {
            minusBtn.style.background = '#222';
        });
        minusBtn.addEventListener('mouseleave', function() {
            minusBtn.style.background = 'transparent';
        });
        minusBtn.addEventListener('click', function() {
            if (currentFloor > 0) {
                currentFloor--;
                updateFloorAndSlots();
            }
        });
        mainArea.appendChild(minusBtn);

        // initialize labels and floor (using currentFloor as-is)
        updateFloorAndSlots();

        panel.appendChild(mainArea);

        var footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px'
        });

        var leftButtons = document.createElement('div');
        Object.assign(leftButtons.style, {
            display: 'flex',
            gap: '8px'
        });

        var rightButtons = document.createElement('div');
        Object.assign(rightButtons.style, {
            display: 'flex',
            gap: '8px'
        });

        // Return button: clears current target and closes
        var returnBtn = document.createElement('button');
        returnBtn.textContent = 'Return';
        Object.assign(returnBtn.style, {
            padding: '4px 10px',
            borderRadius: '6px',
            border: 'none',
            background: '#333',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px'
        });
        returnBtn.addEventListener('mouseenter', function() {
            returnBtn.style.background = '#444';
        });
        returnBtn.addEventListener('mouseleave', function() {
            returnBtn.style.background = '#333';
        });
        returnBtn.addEventListener('click', function() {
            currentTargetPlayer = null;
            closeOverlayById(SLOT_POPUP_ID);
        });

        leftButtons.appendChild(returnBtn);

        // Close button: keep current target, just close dialog
        var closeBtn2 = document.createElement('button');
        closeBtn2.textContent = 'Close';
        Object.assign(closeBtn2.style, {
            padding: '4px 10px',
            borderRadius: '6px',
            border: 'none',
            background: '#333',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px'
        });
        closeBtn2.addEventListener('mouseenter', function() {
            closeBtn2.style.background = '#444';
        });
        closeBtn2.addEventListener('mouseleave', function() {
            closeBtn2.style.background = '#333';
        });
        closeBtn2.addEventListener('click', function() {
            closeOverlayById(SLOT_POPUP_ID);
        });

        rightButtons.appendChild(closeBtn2);

        footer.appendChild(leftButtons);
        footer.appendChild(rightButtons);

        panel.appendChild(footer);

        overlay.appendChild(panel);
        (document.body || document.documentElement).appendChild(overlay);
    }

    // =========================
    // Hex-send popup (N key)
    // =========================
    function openHexSendPopup() {
        releasePointerLock();

        closeOverlayById(PLAYER_POPUP_ID);
        closeOverlayById(SLOT_POPUP_ID);
        closeOverlayById(HEX_POPUP_ID);

        var overlay = document.createElement('div');
        overlay.id = HEX_POPUP_ID;
        Object.assign(overlay.style, {
            position: 'fixed',
            left: '0',
            top: '0',
            right: '0',
            bottom: '0',
            background: 'rgba(0,0,0,.45)',
            zIndex: '2147483647',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto'
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeOverlayById(HEX_POPUP_ID);
            }
        });

        var panel = document.createElement('div');
        Object.assign(panel.style, {
            background: '#111',
            color: '#fff',
            borderRadius: '10px',
            padding: '16px 20px',
            minWidth: '360px',
            maxWidth: '600px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 36px rgba(0,0,0,.5)',
            fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif'
        });

        panel.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        var title = document.createElement('div');
        title.textContent = 'Send custom hex WebSocket packet';
        Object.assign(title.style, {
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '8px'
        });
        panel.appendChild(title);

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Paste hex bytes here (spaces/linebreaks allowed)';
        input.autocomplete = 'off';
        input.spellcheck = false;
        Object.assign(input.style, {
            width: '100%',
            color: '#fff',
            background: '#222',
            border: '1px solid #444',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: '14px',
            lineHeight: '1.4',
            padding: '8px 10px',
            borderRadius: '6px',
            outline: 'none',
            marginBottom: '10px'
        });
        panel.appendChild(input);

        input.addEventListener('input', function() {
            input.style.borderColor = '#444';
        });

        var footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
            marginTop: '6px'
        });

        var leftButtons = document.createElement('div');
        Object.assign(leftButtons.style, {
            display: 'flex',
            gap: '8px'
        });

        var rightButtons = document.createElement('div');
        Object.assign(rightButtons.style, {
            display: 'flex',
            gap: '8px'
        });

        // Close button
        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        Object.assign(closeBtn.style, {
            padding: '4px 10px',
            borderRadius: '6px',
            border: 'none',
            background: '#333',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px'
        });
        closeBtn.addEventListener('mouseenter', function() {
            closeBtn.style.background = '#444';
        });
        closeBtn.addEventListener('mouseleave', function() {
            closeBtn.style.background = '#333';
        });
        closeBtn.addEventListener('click', function() {
            closeOverlayById(HEX_POPUP_ID);
        });
        leftButtons.appendChild(closeBtn);

        // Send button
        var sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        Object.assign(sendBtn.style, {
            padding: '4px 14px',
            borderRadius: '6px',
            border: 'none',
            background: '#2b7cff',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
        });
        sendBtn.addEventListener('mouseenter', function() {
            sendBtn.style.background = '#3c8dff';
        });
        sendBtn.addEventListener('mouseleave', function() {
            sendBtn.style.background = '#2b7cff';
        });

        sendBtn.addEventListener('click', function() {
            // strip all non-hex chars
            var raw = input.value || '';
            var hex = raw.replace(/[^0-9a-fA-F]/g, '');
            if (hex.length === 0 || (hex.length % 2) !== 0) {
                input.style.borderColor = '#e33';
                return;
            }

            var bytes = hexToUint8Array(hex);
            if (!bytes || !bytes.length) {
                input.style.borderColor = '#e33';
                return;
            }

            var ws = getLastOpenWebSocket();
            if (!ws || ws.readyState !== OriginalWebSocket.OPEN) {
                input.style.borderColor = '#e33';
                console.log('[WS TEST1337] No open WebSocket to send custom hex');
                return;
            }

            try {
                ws.send(bytes);
                console.log('[WS TEST1337] Sent custom hex packet, length:', bytes.length);
                closeOverlayById(HEX_POPUP_ID);
            } catch (e) {
                input.style.borderColor = '#e33';
                console.log('[WS TEST1337] Failed to send custom hex packet', e);
            }
        });

        rightButtons.appendChild(sendBtn);

        footer.appendChild(leftButtons);
        footer.appendChild(rightButtons);

        panel.appendChild(footer);

        overlay.appendChild(panel);
        (document.body || document.documentElement).appendChild(overlay);

        setTimeout(function() {
            input.focus({ preventScroll: true });
        }, 0);
    }

    // =========================
    // Key handler (toggles + packets + UI)
    // =========================
    function handleKeyToggle(e) {
        if (e.repeat) {
            return;
        }

        var key = e.key || '';
        var lower = key.toLowerCase();

        // Ignore shortcuts while typing in inputs/textareas/contentEditable
        var t = e.target;
        var tag = t && t.tagName;
        var isEditable =
            (tag === 'INPUT') ||
            (tag === 'TEXTAREA') ||
            (t && t.isContentEditable);

        if (isEditable) {
            return;
        }

        // V -> player list or slot picker depending on currentTargetPlayer
        if (lower === 'V') {
            if (currentTargetPlayer) {
                openSlotPopupForPlayer(currentTargetPlayer);
            } else {
                openPlayerListPopup();
            }
            return;
        }

        // Key 9 = fullforce
        if (key === '9') {
            fullForceEnabled = !fullForceEnabled;
            window.TEST1337_FULLFORCE = fullForceEnabled;
            var msg9 = fullForceEnabled ? 'fullforce enabled' : 'fullforce disabled';
            console.log(msg9);
            showToast(msg9);
            updateStatusHud({
                fullForceEnabled: fullForceEnabled,
                fullRangeEnabled: fullRangeEnabled,
                sleepyEnabled: sleepyEnabled,
                weirdSpeedEnabled: weirdSpeedEnabled
            });
            return;
        }

        // Key 7 = fullrange
        if (key === '7') {
            fullRangeEnabled = !fullRangeEnabled;
            window.TEST1337_FULLRANGE = fullRangeEnabled;
            var msg7 = fullRangeEnabled ? 'fullrange enabled' : 'fullrange disabled';
            console.log(msg7);
            showToast(msg7);
            updateStatusHud({
                fullForceEnabled: fullForceEnabled,
                fullRangeEnabled: fullRangeEnabled,
                sleepyEnabled: sleepyEnabled,
                weirdSpeedEnabled: weirdSpeedEnabled
            });
            return;
        }

        // Key 8 = sleepy
        if (key === '8') {
            sleepyEnabled = !sleepyEnabled;
            window.TEST1337_SLEEPY = sleepyEnabled;
            var msg8 = sleepyEnabled ? 'sleepy enabled' : 'sleepy disabled';
            console.log(msg8);
            showToast(msg8);
            updateStatusHud({
                fullForceEnabled: fullForceEnabled,
                fullRangeEnabled: fullRangeEnabled,
                sleepyEnabled: sleepyEnabled,
                weirdSpeedEnabled: weirdSpeedEnabled
            });
            return;
        }

        // Key 6 = weird speed
        if (key === '6') {
            weirdSpeedEnabled = !weirdSpeedEnabled;
            window.TEST1337_WEIRDSPEED = weirdSpeedEnabled;
            var msg6 = weirdSpeedEnabled ? 'weird speed enabled' : 'weird speed disabled';
            console.log(msg6);
            showToast(msg6);
            updateStatusHud({
                fullForceEnabled: fullForceEnabled,
                fullRangeEnabled: fullRangeEnabled,
                sleepyEnabled: sleepyEnabled,
                weirdSpeedEnabled: weirdSpeedEnabled
            });
            return;
        }

        // Big X = freeze
        if (key === 'X') {
            sendFreezePacket();
            return;
        }

        // Big C = speedup packet
        if (key === 'C') {
            sendCPacket();
            return;
        }

        // Big Z = vines
        if (key === 'Z') {
            sendVinesPacket();
            return;
        }

        // Big B = swarm
        if (key === 'B') {
            sendSwarmPacket();
            return;
        }

        // Big N = open custom hex send popup
        if (key === 'N') {
            openHexSendPopup();
            return;
        }
    }

    window.addEventListener('keydown', handleKeyToggle, true);

    // =========================
    // Byte replacement helper
    // =========================
    function replaceByteSequence(uint8, pattern, replacement) {
        var changed = false;
        var i, j, k;
        outer: for (i = 0; i <= uint8.length - pattern.length; i++) {
            for (j = 0; j < pattern.length; j++) {
                if (uint8[i + j] !== pattern[j]) {
                    continue outer;
                }
            }
            for (k = 0; k < pattern.length; k++) {
                uint8[i + k] = replacement[k];
            }
            changed = true;
        }
        return changed;
    }

    // Patterns (ASCII) including quotes, colon, space, and value
    var FORCE_PATTERN = [34,102,111,114,99,101,34,58,32,34,49,50,48,48,48,34];
    var FORCE_REPLACEMENT = [34,102,111,114,99,101,34,58,32,34,57,57,57,57,57,34];

    var RANGE_PATTERN = [34,114,97,110,103,101,34,58,32,34,51,56,48,48,34];
    var RANGE_REPLACEMENT = [34,114,97,110,103,101,34,58,32,34,57,57,57,57,34];

    var STUN_PATTERN = [34,115,116,117,110,34,58,32,34,49,51,48,48,34];
    var STUN_REPLACEMENT = [34,115,116,117,110,34,58,32,34,57,57,57,57,34];

    var SPEED_PATTERN = [34,115,112,101,101,100,117,112,34,58,32,34,52,48,48,48,48,34];
    // user-modified replacement (no space after colon)
    var SPEED_REPLACEMENT = [34,115,112,101,101,100,117,112,34,58,34,54,51,51,51,51,51,34];

    var CUSTOM_PATTERN = [];
    var CUSTOM_REPLACE = [];


    // =========================
    // WebSocket wrapper
    // =========================
    function WrappedWebSocket(url, protocols) {
        var ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);

        wsList.push(ws);
        var index = wsList.length;
        window['WebSocket' + index] = ws;

        ws.addEventListener('message', function(ev) {
            try {
                handleIncomingData(ev.data);
            } catch (e) {}
        });

        return ws;
    }

    WrappedWebSocket.prototype = OriginalWebSocket.prototype;
    WrappedWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    WrappedWebSocket.OPEN       = OriginalWebSocket.OPEN;
    WrappedWebSocket.CLOSING    = OriginalWebSocket.CLOSING;
    WrappedWebSocket.CLOSED     = OriginalWebSocket.CLOSED;

    var originalSend = OriginalWebSocket.prototype.send;

    OriginalWebSocket.prototype.send = function(data) {
        if (!fullForceEnabled && !fullRangeEnabled && !sleepyEnabled && !weirdSpeedEnabled) {
            return originalSend.call(this, data);
        }

        var outData = data;

        if (outData instanceof ArrayBuffer) {
            var newBuffer = outData.slice(0);
            var view = new Uint8Array(newBuffer);

            var touchedCustom = false;
            var touchedForceAB = false;
            var touchedRangeAB = false;
            var touchedStunAB  = false;
            var touchedSpeedAB = false;

            if (customEnabled && replaceByteSequence(view, CUSTOM_PATTERN, CUSTOM_REPLACE)) {
              touchedCustom = true;
            }

            if (fullForceEnabled && replaceByteSequence(view, FORCE_PATTERN, FORCE_REPLACEMENT)) {
                touchedForceAB = true;
            }
            if (fullRangeEnabled && replaceByteSequence(view, RANGE_PATTERN, RANGE_REPLACEMENT)) {
                touchedRangeAB = true;
            }
            if (sleepyEnabled && replaceByteSequence(view, STUN_PATTERN, STUN_REPLACEMENT)) {
                touchedStunAB = true;
            }
            if (weirdSpeedEnabled && replaceByteSequence(view, SPEED_PATTERN, SPEED_REPLACEMENT)) {
                touchedSpeedAB = true;
            }

            if (touchedCustom || touchedForceAB || touchedRangeAB || touchedStunAB || touchedSpeedAB) {
                outData = newBuffer;
                if (touchedForceAB)  console.log('TEST1337: Sent injected fullforce (binary ArrayBuffer)');
                if (touchedRangeAB)  console.log('TEST1337: Sent injected fullrange (binary ArrayBuffer)');
                if (touchedStunAB)   console.log('TEST1337: Sent injected sleepy (binary ArrayBuffer)');
                if (touchedSpeedAB)  console.log('TEST1337: Sent injected weird speed (binary ArrayBuffer)');
                if (touchedCustom)   console.log('TEST1337: CUSTOM MESSAGE (binary ArrayBuffer)')
            }

        } else if (ArrayBuffer.isView(outData)) {
            var srcView = new Uint8Array(outData.buffer, outData.byteOffset, outData.byteLength);
            var newBuffer2 = new ArrayBuffer(outData.byteLength);
            var view2 = new Uint8Array(newBuffer2);
            view2.set(srcView);

            var touchedForceTA = false;
            var touchedRangeTA = false;
            var touchedStunTA  = false;
            var touchedSpeedTA = false;

            if (fullForceEnabled && replaceByteSequence(view2, FORCE_PATTERN, FORCE_REPLACEMENT)) {
                touchedForceTA = true;
            }
            if (fullRangeEnabled && replaceByteSequence(view2, RANGE_PATTERN, RANGE_REPLACEMENT)) {
                touchedRangeTA = true;
            }
            if (sleepyEnabled && replaceByteSequence(view2, STUN_PATTERN, STUN_REPLACEMENT)) {
                touchedStunTA = true;
            }
            if (weirdSpeedEnabled && replaceByteSequence(view2, SPEED_PATTERN, SPEED_REPLACEMENT)) {
                touchedSpeedTA = true;
            }

            if ( touchedForceTA || touchedRangeTA || touchedStunTA || touchedSpeedTA) {
                outData = view2;
                if (touchedForceTA)  console.log('TEST1337: Sent injected fullforce (binary TypedArray)');
                if (touchedRangeTA)  console.log('TEST1337: Sent injected fullrange (binary TypedArray)');
                if (touchedStunTA)   console.log('TEST1337: Sent injected sleepy (binary TypedArray)');
                if (touchedSpeedTA)  console.log('TEST1337: Sent injected weird speed (binary TypedArray)');
            }
        } else {
          console.log("TEST1337: ELSE CASE!!");
        }

        return originalSend.call(this, outData);
    };

    window.WebSocket = WrappedWebSocket;
})();

