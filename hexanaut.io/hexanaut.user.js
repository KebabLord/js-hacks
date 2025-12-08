// ==UserScript==
// @name        Hexanaut Camera Hax & Gamepad support
// @namespace   Violentmonkey Scripts
// @match       *://hexanaut.io/*
// @grant       none
// @version     1.0
// @author      Kebablord & A guy i forgot the name of
// @run-at      document-start
// @updateURL   https://github.com/KebabLord/js-hacks/raw/refs/heads/main/hexanaut.io/hexanaut.user.js
// ==/UserScript==


/* CAMERA RELATED CODE */
window.cameras = [];

const proxy = () => {
  console.log(THREE.PerspectiveCamera)
  THREE.PerspectiveCamera = new Proxy(THREE.PerspectiveCamera, {
    construct(target, args) {
        const camera = new target(...args);
        window.cameras.push(camera);
        console.log('A new PerspectiveCamera was created (via Proxy):', camera);
        return camera;
    }
  });
  console.log("proxied cam");
}

if(window.THREE) proxy()
else {
  Object.defineProperty(window, "THREE", {
      get() {},
      set(prop) {
        delete window.THREE;
        window.THREE = prop;

        Object.defineProperty(window.THREE, "PerspectiveCamera", {
          get() {},
          set(prop) {
            delete window.THREE.PerspectiveCamera;
            window.THREE.PerspectiveCamera = prop;
            console.log("hijacked cam");
            proxy();
          },
          configurable: true,
        });
        console.log("hijacked threejs");
      },
      configurable: true,
  });
}

class Coder {
    constructor(buffer) {
        if (buffer instanceof ArrayBuffer) {
            this.buffer = new Uint8Array(buffer);
        } else if (buffer instanceof Uint8Array) {
            this.buffer = buffer;
        } else if (typeof buffer === 'string') {
            // Convert string to UTF-8 bytes
            const encoder = new TextEncoder();
            this.buffer = encoder.encode(buffer);
        } else if (Array.isArray(buffer)) {
            this.buffer = new Uint8Array(buffer);
        } else {
            this.buffer = new Uint8Array(buffer);
        }

        this.dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
        this.currentOffset = 0;
    }

    get byteLength() {
        return this.buffer.length;
    }

    // Read methods
    readFloat32() {
        const value = this.dataView.getFloat32(this.currentOffset, false); // false = big endian
        this.currentOffset += 4;
        return value;
    }

    readFloat64() {
        const value = this.dataView.getFloat64(this.currentOffset, false); // false = big endian
        this.currentOffset += 8;
        return value;
    }

    readInt16() {
        const value = this.dataView.getInt16(this.currentOffset, false); // false = big endian
        this.currentOffset += 2;
        return value;
    }

    readInt32() {
        const value = this.dataView.getInt32(this.currentOffset, false); // false = big endian
        this.currentOffset += 4;
        return value;
    }

    readInt8() {
        const value = this.dataView.getInt8(this.currentOffset);
        this.currentOffset += 1;
        return value;
    }

    readUint16() {
        const value = this.dataView.getUint16(this.currentOffset, false); // false = big endian
        this.currentOffset += 2;
        return value;
    }

    readUint32() {
        const value = this.dataView.getUint32(this.currentOffset, false); // false = big endian
        this.currentOffset += 4;
        return value;
    }

    readUint8() {
        const value = this.dataView.getUint8(this.currentOffset);
        this.currentOffset += 1;
        return value;
    }

    // Write methods
    writeFloat32(value) {
        this.dataView.setFloat32(this.currentOffset, value, false); // false = big endian
        this.currentOffset += 4;
    }

    writeFloat64(value) {
        this.dataView.setFloat64(this.currentOffset, value, false); // false = big endian
        this.currentOffset += 8;
    }

    writeInt16(value) {
        this.dataView.setInt16(this.currentOffset, value, false); // false = big endian
        this.currentOffset += 2;
    }

    writeInt32(value) {
        this.dataView.setInt32(this.currentOffset, value, false); // false = big endian
        this.currentOffset += 4;
    }

    writeInt8(value) {
        this.dataView.setInt8(this.currentOffset, value);
        this.currentOffset += 1;
    }

    writeUint16(value) {
        this.dataView.setUint16(this.currentOffset, value, false); // false = big endian
        this.currentOffset += 2;
    }

    writeUint32(value) {
        this.dataView.setUint32(this.currentOffset, value, false); // false = big endian
        this.currentOffset += 4;
    }

    writeUint8(value) {
        this.dataView.setUint8(this.currentOffset, value);
        this.currentOffset += 1;
    }

    // Vector/Quaternion read methods
    readBtVector3(vector) {
        return vector.setValue(this.readFloat32(), this.readFloat32(), this.readFloat32());
    }

    readBtQuaternion(quaternion) {
        return quaternion.setValue(this.readFloat32(), this.readFloat32(), this.readFloat32(), this.readFloat32());
    }

    readVector3(vector) {
        return vector.set(this.readFloat32(), this.readFloat32(), this.readFloat32());
    }

    readQuaternion(quaternion) {
        return quaternion.set(this.readFloat32(), this.readFloat32(), this.readFloat32(), this.readFloat32());
    }

    // Vector/Quaternion write methods
    writeBtVector3(vector) {
        this.writeFloat32(vector.x());
        this.writeFloat32(vector.y());
        this.writeFloat32(vector.z());
    }

    writeBtQuaternion(quaternion) {
        this.writeFloat32(quaternion.x());
        this.writeFloat32(quaternion.y());
        this.writeFloat32(quaternion.z());
        this.writeFloat32(quaternion.w());
    }

    writeVector3(vector) {
        this.writeFloat32(vector.x);
        this.writeFloat32(vector.y);
        this.writeFloat32(vector.z);
    }

    writeQuaternion(quaternion) {
        this.writeFloat32(quaternion.x);
        this.writeFloat32(quaternion.y);
        this.writeFloat32(quaternion.z);
        this.writeFloat32(quaternion.w);
    }

    // String methods
    readShortString() {
        const length = this.readUint8();
        let result = '';
        for (let i = 0; i < length; i++) {
            const charCode = (this.readUint8() << 8) | this.readUint8();
            result += String.fromCharCode(charCode);
        }
        return result;
    }

    writeShortString(str) {
        const length = Math.min(255, str.length);
        this.writeUint8(length);
        for (let i = 0; i < length; i++) {
            const charCode = str.charCodeAt(i);
            this.writeUint8(charCode >>> 8);
            this.writeUint8(charCode & 255);
        }
    }

    readLongString() {
        const length = this.readInt32();
        let result = '';
        for (let i = 0; i < length; i++) {
            const charCode = (this.readUint8() << 8) | this.readUint8();
            result += String.fromCharCode(charCode);
        }
        return result;
    }

    writeLongString(str) {
        this.writeInt32(str.length);
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i);
            this.writeUint8(charCode >>> 8);
            this.writeUint8(charCode & 255);
        }
    }

    // Utility methods
    hasRemaining(bytes = 0) {
        return this.currentOffset + bytes <= this.byteLength;
    }

    remainingBytes() {
        return this.byteLength - this.currentOffset;
    }

    // Additional utility methods
    resetOffset() {
        this.currentOffset = 0;
    }

    setOffset(offset) {
        this.currentOffset = offset;
    }

    getOffset() {
        return this.currentOffset;
    }

    flush() {
        const flushedBuffer = this.buffer.subarray(0, this.currentOffset);
        this.resetOffset();
        return flushedBuffer;
    }

    // Additional web-specific utility methods
    toArrayBuffer() {
        return this.buffer.buffer.slice(this.buffer.byteOffset, this.buffer.byteOffset + this.buffer.byteLength);
    }

    toUint8Array() {
        return new Uint8Array(this.buffer);
    }

    // Static factory methods for convenience
    static fromArrayBuffer(arrayBuffer) {
        return new Coder(arrayBuffer);
    }

    static fromUint8Array(uint8Array) {
        return new Coder(uint8Array);
    }

    static allocate(size) {
        return new Coder(new Uint8Array(size));
    }
}

WebSocket.prototype._send = WebSocket.prototype.send;

WebSocket.prototype.send = function(buffer) {
  if(!this.url.includes("hexanaut.io") || this.pings) return this._send(buffer);
  const packet = Array.from(new Uint8Array(buffer));
  const r = new Coder(buffer);

  switch(packet[0]) {
    case 1: {
      r.readUint8();
      r.readShortString();
      r.readShortString();
      r.readInt32();
      r.readInt32();
      r.readUint8();
      r.readInt32();
      window.partyId = r.readInt32();
      break;
    }
    case 100:
      console.log(packet);
      break;
    default: break;
  }

  window.socket = this;

  if(!this.__l) {
    this.__l = true;
    this.addEventListener("message", e => {
      const r = new Coder(e.data);
      const h = r.readUint8();
      switch(h) {
        case 1:
        case 37:
        case 48:
          console.log("gamestate init", h, {
            gamemode: r.readUint8(),
            playerId: r.readInt32(),
            isTeamMode: r.readInt32(),
          });
          break;
        case 15:
          console.log("player skin", "id", r.readInt16(), r.readInt16(), r.remainingBytes());
          break;
        case 16:
          r.readInt32(); // tick
          console.log("path", r.readInt32(), r.readInt16(), r.readInt16(), r.remainingBytes() / 8);
          break;
        case 17:
          /*console.log("minimap", "w", r.readInt16(), "h", r.readInt16());
          const isTeamGM = r.readUint8() === 1;
          const len = r.remainingBytes() / (isTeamGM ? 10 : 6);
          for(let i = 0; i < len; ++i) {
            const ukn1 = isTeamGM ? r.readInt32() : 0;
            console.log(ukn1, r.readInt16(), r.readInt16(), r.readInt16());
          }*/
          break;
        case 32:
          console.log("map data?", r.readLongString());
          break;
        case 43:
          console.log("item spawned / used", "itemid", r.readInt32(), "itemtype", r.readUint8());
          break;
        case 9:
          const tick = r.readInt32();
          const t = [];
          const a = r.readInt16(), b = r.readInt16(), c = r.readInt16(), d = r.readInt16();

          window.playerX = c;
          window.playerY = d;
          /*
          const len = r.readInt16();

          for(let i = 0; i < len; ++i) {
            t.push({
              x: r.readInt16(),
              y: r.readInt16(),
              ownerId: r.readInt32(),
              areaId: r.readInt32(),
            })
          }
          console.log("t updates", tick, a, b, c, d, t, r.remainingBytes());*/
        default: break;
      }
    });
  }
  return this._send(buffer);
}

let interval;
let freecam = false;

let camX = 0, camY = 0;

setInterval(() => console.log(camX, camY, window.playerX ?? 0, window.playerY ?? 0), 500);

try {
  document.addEventListener("wheel", e => {
    window.cameras[0].hexZoom -= 0.0003 * e.deltaY;
  });

} catch(e) {
  console.log("ERROR:",e)
}


/* GAMEPAD RELATED CODE */

(function () {
    let centerX = window.innerWidth / 2;
    let centerY = window.innerHeight / 2;

    // How far from center the "edge" is drawn (mouse radius)
    const SENS = 150;           // you can tweak this
    const EDGE_THRESHOLD = 0.8; // only use stick when magnitude >= 0.8

    let gamepadIndex = null;

    // last mouse position so direction is "sticky"
    let lastMouseX = centerX;
    let lastMouseY = centerY;

    // previous button state (for edge detection + logging)
    let lastButtons = [];

    // Wait loop until a gamepad exists
    function waitForGamepad() {
        const pads = navigator.getGamepads();
        for (let i = 0; i < pads.length; i++) {
            if (pads[i]) {
                gamepadIndex = i;
                alert("GAMEPAD CONNECTED!");
                startLoop();
                return;
            }
        }
        requestAnimationFrame(waitForGamepad);
    }

    function startLoop() {
        requestAnimationFrame(loop);
    }

    function loop() {
        const gp = navigator.getGamepads()[gamepadIndex];
        if (gp) pollGamepad(gp);
        requestAnimationFrame(loop);
    }

    function pollGamepad(gp) {
        // ---- AXES: LEFT STICK, only using the circle edge ----
        const lx = gp.axes[0];
        const ly = gp.axes[1];

        const mag = Math.hypot(lx, ly); // distance from center

        if (mag >= EDGE_THRESHOLD) {
            // Normalize to unit vector (direction only)
            const nx = lx / mag;
            const ny = ly / mag;

            lastMouseX = centerX + nx * SENS;
            lastMouseY = centerY + ny * SENS;

            simulateMouseMove(lastMouseX, lastMouseY);
        }
        // If below threshold: ignore noise, keep lastMouseX/Y

        // ---- BUTTONS: log & handle actions ----
        const prevButtons = lastButtons.slice();
        lastButtons.length = gp.buttons.length; // ensure length matches

        for (let i = 0; i < gp.buttons.length; i++) {
            const pressed = gp.buttons[i].pressed;

            // Debug log: only on press edge
            if (pressed && !prevButtons[i]) {
                console.log(`Button ${i} pressed`);
            }

            lastButtons[i] = pressed;
        }

        // A (button 0) -> Space tap (split)
        if (gp.buttons[0] && gp.buttons[0].pressed && !prevButtons[0]) {
            tapKey(" ", "Space", 32);
        }

        // B (button 1) -> 'W' tap (example action)
        if (gp.buttons[1] && gp.buttons[1].pressed && !prevButtons[1]) {
            tapKey("w", "KeyW", 87);
        }

        // LT (button 6) -> Space tap (your mechanic)
        if (gp.buttons[6] && gp.buttons[6].pressed && !prevButtons[6]) {
            tapKey(" ", "Space", 32);
        }
    }

    function simulateMouseMove(x, y) {
        const ev = new MouseEvent("mousemove", {
            clientX: x,
            clientY: y,
            bubbles: true
        });
        document.dispatchEvent(ev);
    }

    // Fire a "real-ish" key event with proper keyCode/which
    function fireKeyEvent(type, key, code, keyCode) {
        const ev = new KeyboardEvent(type, {
            key: key,
            code: code,
            keyCode: keyCode,
            which: keyCode,
            charCode: keyCode,
            bubbles: true
        });

        // Some engines only trust these properties when defined manually
        Object.defineProperty(ev, "keyCode", { get: () => keyCode });
        Object.defineProperty(ev, "which",   { get: () => keyCode });
        Object.defineProperty(ev, "charCode",{ get: () => keyCode });

        document.dispatchEvent(ev);
    }

    // Convenience: quick tap (keydown + keyup)
    function tapKey(key, code, keyCode) {
        fireKeyEvent("keydown", key, code, keyCode);
        fireKeyEvent("keyup",   key, code, keyCode);
    }

    window.addEventListener("resize", () => {
        centerX = window.innerWidth / 2;
        centerY = window.innerHeight / 2;
    });

    // Begin by waiting until navigator.getGamepads()[0] is valid
    waitForGamepad();
})();
