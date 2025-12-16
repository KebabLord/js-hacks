# FrontWars.io Macro Hack
This project overrides frontwars' index.js with some modifications to achieve macro abilities.

**E**: Enable spam mode, so that you don't have to select same item again  
**Q**: Spam place/upgrade currently selected item at mouse position, 10x a second.  
**W**: Place/Upgrade currently selected item only 1 time, better than mouse clicking.  
**ESC**: Disable spam mode and everything above.  

Do you have any feature requests or complain? You can tell me [here](https://github.com/KebabLord/js-hacks/issues).

https://github.com/user-attachments/assets/060cbf97-b4b6-497a-ad1d-9868b91d733e

# How to install
First, you have to install **Resource Override** browser extension
- If you are using google chrome [click here](https://chromewebstore.google.com/detail/resource-override/ohpilhbphbbkfkmjgnjjmnbeeiipkkko).
- If you are using firefox [click here](https://addons.mozilla.org/en-US/firefox/addon/resourceoverride/).

> If extension is no longer available at above links or using edge browser, you can use [Requestly](https://requestly.com/downloads/).


After you install the extension:
 1. Click extension icon
 2. Click "Add Rule"
 3. Select URL -> URL
 4. Update From: `https://frontwars.io/assets/index-*.js`
 5. Update To: `https://kebablord.github.io/js-hacks/frontwars.io/patched-index.js` 

<img width="829" height="263" alt="2025-12-16_03-54" src="https://github.com/user-attachments/assets/33933893-3460-4e53-adeb-fd6b0109de92" />

Refresh the frontwars page with Ctrl+F5 and you should see the "Macro activated" message. That's all.

