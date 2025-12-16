import re
from datetime import date
from urllib.request import urlopen


OUTPUT = "patched-index.js"
TARGET_URL= "https://frontwars.io"
#INPUT = "input.js"
#with open(INPUT) as fp:
#  MASTER = fp.read()


# Find and download the most recent index-XXXXX.js
print(" - Connecting target..")
resp = urlopen(TARGET_URL)
status_code = resp.status
assert status_code == 200, "Couldn't reach frontwars."
res = resp.read().decode("utf-8")
index_js = re.findall(r"\/assets/index-[A-Za-z0-9]+\.js", res)
assert index_js, "Couldn't find index-XXXX.js at homepage."
print(" - Fetching", index_js[0])
MASTER = urlopen(TARGET_URL+index_js[0]).read().decode("utf-8")

def insert_text(s: str, pos: int, text: str) -> str:
    return s[:pos] + text + s[pos:]

print(" - Patching..")
# Replace links
link_replacements = {
    '"./browser-ponyfill': f'"{TARGET_URL}/assets/browser-ponyfil',
    '"./browserAll':       f'"{TARGET_URL}/assets/browserAll',
    '"./webworkerAll':     f'"{TARGET_URL}/assets/webworkerAll',
    '"/assets':            f'"{TARGET_URL}/assets',
    '"assets':             f'"{TARGET_URL}/assets',
}

for old, new in link_replacements.items():
    MASTER = MASTER.replace(old, new)

# 1) Modify `upgradeStructureIntent` and `buildUnitIntent` to not hide ghostUnit after placement
bu_PATTERN = "}),this.game.placementUnit=null"
bu_REPLACE = "}),(window.keepghost === false) && (this.game.placementUnit = null)"
MASTER = MASTER.replace(bu_PATTERN, bu_REPLACE)

# 2) Modify the object that has placement functions to expose itself.
obj_PATTERN = r"\{this\._view=.,this\._bus=.,this\._camera=.,this\._factory=."
obj_INSERT = """
	window.executePlacement = this.executePlacement.bind(this);
	window.obj_placement = this;
	console.log("LOG1337: Obj expose injection successfull.");
"""
obj = re.search(obj_PATTERN, MASTER)
assert obj, "Target obj couldn't be matched."
MASTER = insert_text(MASTER,obj.start() + 1,obj_INSERT)

# 3) Replace "Escape" key function with a custom one to handle our operations and overrade standard keybdinds.
keydown_PATTERN = r"handleKeyDown\(e\)\{[^\}]+?\}"
keydown_REPLACE = """
handleKeyDown(e) {
    // Toggle view
    if (e.code === this.keybinds.toggleView) {
        e.preventDefault();

        if (!this.alternateView) {
            this.alternateView = true;
            this.eventBus.emit(new %s(true));
        }
    }

    // Escape key
    if (e.code === "Escape") {
        e.preventDefault();
        if (window.keepghost) showToast("Spam Mode Deactivated.");
        window.keepghost = false;
        window.spam = false;
        this.eventBus.emit(new %s());
        this.game.placementUnit = null;
    }

    if (e.code === "KeyQ"){ // spam
    	e.preventDefault();
    	window.spam = true;
    } else if (e.code === "KeyW"){ // single
    	e.preventDefault();
    } else if (e.code === "KeyE"){ // activate
    	e.preventDefault();
    	window.keepghost = true;
    	//console.log("1337: Spamming mode activated.");
    } else if (this.isMovementOrModifierKey(e.code)) {
        this.activeKeys.add(e.code);
    }
}
"""
handleKeyDown = re.search(keydown_PATTERN, MASTER)
assert handleKeyDown, "handleKeyDown couldn't be found."
obj_names = re.findall(r"new ([A-Za-z0-9]{1,3})[\(\)]", handleKeyDown.group())
assert len(obj_names) == 2, "handleKeyDown has more object references than expected"
keydown_REPLACE = keydown_REPLACE % tuple(obj_names)
MASTER = MASTER[:handleKeyDown.start()] + keydown_REPLACE + MASTER[handleKeyDown.end():]


# 4) Modify `handleActionKeyUp` with our custom keys
keyup_PATTERN = r"case this\.keybinds\.centerCamera:[a-zA-Z]{1,2}\.preventDefault\(\),this\.eventBus\.emit\(new [a-zA-Z0-9]{1,3}\);break\}"
keyup_INSERT = r""";
case "KeyQ":
	console.log("1337: spamming over!");
	window.spam = false;
	break
case "KeyW":
	window.executePlacement(window.obj_placement?._cursorLoc);
	console.log("1337: single shot sent!");
	break
"""
keyup = re.search(keyup_PATTERN, MASTER)
assert keyup, "handleActionKeyUp couldn't be found."
MASTER = insert_text(MASTER,keyup.end()-1, keyup_INSERT)

# 5) Insert helper js functions at top of the file
HELPER_JS_CODE = r"""
/*
 * FrontWars Macro Hack by KebabLord
 * Automatically generated at CREATION_DATE
 */
function showToast(message) {
  const DURATION = 2000; // ms
  const containerId = '__toast_container_bl';

  // Ensure container exists (bottom-left)
  let c = document.getElementById(containerId);
  if (!c) {
    c = document.createElement('div');
    c.id = containerId;
    Object.assign(c.style, {
      position: 'fixed',
      left: '32px',
      bottom: '32px',
      display: 'flex',
      flexDirection: 'column-reverse', // newest closest to bottom
      gap: '16px',
      maxWidth: '40vw',
      zIndex: '2147483647',
      pointerEvents: 'none'
    });
    (document.body || document.documentElement).appendChild(c);
  }

  // Create toast (4x bigger, opaque background)
  const t = document.createElement('div');
  t.textContent = String(message);
  Object.assign(t.style, {
    background: '#111111',                   // opaque (no transparency)
    color: '#ffffff',
    fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
    fontSize: '28px',                        // 14px * 4
    lineHeight: '1.2',
    padding: '20px 24px',                    // 4x padding
    borderRadius: '16px',                    // 4x radius
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
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
  });

  // Animate out shortly before removal
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(16px)';
  }, DURATION - 180);

  // Remove from DOM
  setTimeout(() => {
    if (t.parentNode) t.parentNode.removeChild(t);
    if (c.children.length === 0) c.remove();
  }, DURATION);
}


(function initSpamLoopWithUI() {
    // ---------- floating info box ----------
    const box = document.createElement("div");
    box.textContent = "SPAMMING ACTIVE";
    box.style.position = "fixed";
    box.style.top = "12px";
    box.style.left = "50%";
    box.style.transform = "translateX(-50%)";
    box.style.padding = "8px 16px";
    box.style.fontFamily = "Arial, sans-serif";
    box.style.fontSize = "14px";
    box.style.fontWeight = "bold";
    box.style.color = "#111";
    box.style.background = "orange";
    box.style.border = "3px solid #cc8400"; // darker orange
    box.style.borderRadius = "0";
    box.style.zIndex = "999999";
    box.style.display = "none";
    box.style.pointerEvents = "none";

    document.body.appendChild(box);

    // ---------- spam loop ----------
    let last = 0;
    const interval = 100; // ms

    let lastKeepghost;
    let lastSpam;
    showToast("Macro hack is loaded.")

    const loop = (t) => {
        // --- spam execution ---
        if (t - last >= interval) {
            last = t;

            if (window.keepghost && window.spam) {
                try {
                    window.executePlacement(window.obj_placement?._cursorLoc);
                } catch (err) {
                    console.log("7331 ERR:", err);
                }
            }
        }

        // --- UI update (only on state change) ---
        if (window.keepghost !== lastKeepghost || window.spam !== lastSpam) {
            lastKeepghost = window.keepghost;
            lastSpam = window.spam;

            if (window.keepghost === true) {
                box.style.display = "block";

                if (window.spam === true) {
                    box.style.background = "red";
                    box.style.borderColor = "#b30000"; // darker red
                } else {
                    box.style.background = "orange";
                    box.style.borderColor = "#cc8400"; // darker orange
                }
            } else {
                box.style.display = "none";
            }
        }

        requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
})();
""".replace("CREATION_DATE",f"{date.today().day}/{date.today().month}/{date.today().year}")
MASTER = HELPER_JS_CODE + MASTER


with open(OUTPUT,"w") as fp:
  fp.write(MASTER)
print("Script generated successfully, at:", OUTPUT)
