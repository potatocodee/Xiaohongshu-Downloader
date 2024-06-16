import User from "./user.js";
import Note from "./note.js";

export var pattern = /^\.|\.$|[\x00-\x1f\\\/:*?"<>|\r\n\u200D]/g;

export async function get_user(user_id, tab_id) {
    var id = "user_" + user_id;
    var obj = (await chrome.storage.local.get(id))[id];
    // Not in session storage, or note ids are required (indicated by tab_id not being null)
    if (obj == null || tab_id) {
        var xhs_json = await fetch_user(user_id, tab_id);
        var user = User.xhs_parse(user_id, xhs_json.user_json, xhs_json.notes_json);
        if (obj != null)
            user.avatar.downloaded = obj.avatar.downloaded;
        chrome.storage.local.set({ [id]: user.to_storage() });
        return user;
    } else
        return User.from_storage(obj);
}

export async function get_note(note_id) {
    var id = "note_" + note_id;
    var obj = (await chrome.storage.local.get(id))[id];
    if (obj == null) {
        var xhs_json = await fetch_note(note_id);
        var note = Note.xhs_parse(xhs_json);
        // Notes are rarely updated, so cache it
        // Also we need to keep record of which note is downloaded, which is not downloaded
        chrome.storage.local.set({ [id]: note.to_storage() });
        return note;
    } else
        return Note.from_storage(obj);
}

export async function update_user(user) {
    chrome.storage.local.set({ ["user_" + user.id]: user.to_storage() });
}

export async function update_note(note) {
    chrome.storage.local.set({ ["note_" + note.id]: note.to_storage() });
}



// If tab_id is null, then the user will be fetched from user profile page (which only shows the first ~31 notes)
// If tab_id is not null, then the user will be fetched from the notes loaded in the tab (which contains all notes)
async function fetch_user(user_id, tab_id) {
    if (tab_id) {
        var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length == 1 && tabs[0].id == tab_id) {
            var res = await chrome.tabs.sendMessage(tab_id, { channel: "active_tab_content", action: "fetch_user" });
            switch (res.status) {
                case "success":
                    return { user_json: JSON.parse(res.object.user_json), notes_json: JSON.parse(res.object.notes_json) };
                case "error":
                    throw res.object;
            }
        }
    }
    var init = await fetch_initial_state(new URL(user_id, "https://www.xiaohongshu.com/user/profile/"));
    // return { user_json: init.user.userPageData, notes_json: init.user.loggedIn ? init.user.notes[0] : undefined };
    return { user_json: init.user.userPageData, notes_json: init.user.notes[0] };
}

async function fetch_note(note_id) {
    var init = await fetch_initial_state(new URL(note_id, "https://www.xiaohongshu.com/explore/"));
    return init.note.noteDetailMap[note_id].note;
}

async function fetch_initial_state(url, retry = true) {
    return await do_offscreen("fetch_initial_state", { url: url, retry: retry });
}

var creating; // A global promise to avoid concurrency issues

async function setup_offscreen_document() {
    // Check all windows controlled by the service worker to see if one
    // of them is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL("offscreen.html");
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // create offscreen document
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ['BLOBS', 'DOM_PARSER'],
            justification: 'reason for needing the document',
        });
        await creating;
        creating = null;
    }
}

export async function do_offscreen(action, params) {
    await setup_offscreen_document();
    return await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(undefined, { channel: "offscreen", action: action, params: params }, undefined, (response) => {
            switch (response.status) {
                case "success":
                    resolve(response.object);
                    break;
                case "error":
                    reject(response.object);
            }
        });
    });
}

export function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const progress = new Map();
const timestamps = new Map();

export function get_progress(id) {
    return progress.get([id.task, id.time].join('_'));
}

export function remove_progress(id) {
    timestamps.get(id.task).delete(id.time);
    if (timestamps.get(id.task).size == 0)
        timestamps.delete(id.task);
    return progress.delete([id.task, id.time].join('_'));
}

export function get_timestamps(task) {
    return timestamps.get(task);
}

export async function set_progress(id, new_progress) {
    if (!timestamps.get(id.task))
        timestamps.set(id.task, new Set());
    timestamps.get(id.task).add(id.time);
    progress.set([id.task, id.time].join('_'), new_progress);
    var res = await chrome.runtime.sendMessage(undefined, { channel: "progress", id: id, progress: new_progress });
    if (res)
        remove_progress(id);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.channel == "popup") {
        var params = message.params;
        function send_response(object) {
            sendResponse({ status: "success", object: object });
        }
        // function error_progress(id, error) {
        //     set_progress(id, { error: error });
        // }
        function send_error(error) {
            console.error(error);
            var obj = Object.getOwnPropertyNames(error).reduce((obj, key) => { obj[key] = error[key]; return obj; }, {});
            sendResponse({ status: "error", object: obj });
        }
        switch (message.action) {
            case "download_all_notes":
                get_user(params.user_id, params.tab_id).then((user) => send_response(user.download_notes())).catch(send_error);
                return true;
            case "download_avatar":
                get_user(params.user_id).then((user) => send_response(user.download_avatar())).catch(send_error);
                return true;
            case "download_note":
                get_note(params.note_id).then((note) => send_response(note.download())).catch(send_error);
                return true;
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.channel == "popup") {
        var params = message.params;
        switch (message.action) {
            case "get_progress":
                sendResponse(get_progress(params.id));
                return true;
            case "remove_progress":
                sendResponse(remove_progress(params.id));
                return true;
            case "get_timestamps":
                var timestamps = get_timestamps(params.task);
                sendResponse(timestamps ? [...timestamps] : undefined);
                return true;
        }
    }
});
