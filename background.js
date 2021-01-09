"use strict";
var sounds = new Set(); // List of tab ids that have had audio
var options = {};
var backgroundAudio = false;

chrome.storage.sync.get("options", function(result) {
    if (typeof result["options"] === 'object' && result["options"] !== null) options = result["options"];
});

chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason == "install") {
        chrome.runtime.openOptionsPage();
    }
});

chrome.windows.onFocusChanged.addListener(id => {
    if (id === -1) return
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, tab => {
        if (tab.length !== 1) return
        checkOrigin(tab[0]);
    });
});

chrome.commands.onCommand.addListener(async command => {
    switch (command) {
        case "gotoaudible":
            chrome.tabs.query({
                audible: true,
                active: false,
                currentWindow: true
            }, tab => {
                if (tab.length < 1) return
                chrome.tabs.update(tab[0].id, {
                    active: true
                });
            });
            return
        case "disableresume":
            toggleOption("disableresume");
            return
        case "toggleFastPlayback":
            Broadcast("toggleFastPlayback");
            return
        case "pauseoninactive":
            toggleOption("pauseoninactive");
            return
        case "resumeoveride":
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, tab => {
                if (tab.length < 1) return  
                backgroundAudio = (tab[0].id === backgroundAudio) ? false : tab[0].id;
            });
            return
    }
});

function checkOrigin(tab) {
    if (tab.active === false || tab.id === undefined) return
    let message = tab.audible;
    let id = (backgroundAudio === false) ? tab.id : backgroundAudio);
    if (options.hasOwnProperty("disableresume")) {
        chrome.tabs.sendMessage(id, null, sendHandler); // Only allow playback
        if (message === false) return
    } else {
        chrome.tabs.sendMessage(id, false, sendHandler); // Resume when active
    }
    Broadcast(message, id);
}

function sendHandler() {
    let lastError = chrome.runtime.lastError;
}

chrome.tabs.onActivated.addListener(info => {
    chrome.tabs.get(info.tabId, tab => {
        checkOrigin(tab);
    });
});

chrome.tabs.onRemoved.addListener(tabId => {
    sounds.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.hasOwnProperty("audible")) return // Bool that contains if audio is playing on tab
    if (changeInfo.audible && !sounds.has(tabId)) {
        sounds.add(tabId);
    }
    if (options.hasOwnProperty("disableresume") && changeInfo.audible === false) return
    if (tab.active) {
        let id = (backgroundAudio === false) ? tab.id : backgroundAudio);
        Broadcast(changeInfo.audible, id); // Tell the other tabs the state of the active tab
    }
});

async function Broadcast(message, exclude = false) {
    sounds.forEach(id => { // Only for tabs that have had sound
        if (id === exclude) return
        if (!message && options.hasOwnProperty("pauseoninactive")) {
            message = true;
        }
        chrome.tabs.sendMessage(id, message, sendHandler);
    });
};

function toggleOption(o) {
    if (options.hasOwnProperty(o)) {
        delete options[o];
    } else {
        options[o] = true;
    }
    return new Promise(resolve => {
        chrome.storage.sync.set({
            options
        }, function(result) {
            resolve(result);
        });
    });
}
