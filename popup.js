var obj_id;
var tab_id;

function add_button(id, icn, text, onclick) {
    var li = document.createElement("li");
    li.id = id;
    li.className = "list";
    li.addEventListener("click", onclick);
    var a = document.createElement("a");
    a.className = "nav-link";
    var i = document.createElement("i");
    i.className = "bx " + icn + " icon";
    var span = document.createElement("span");
    span.className = "link";
    span.textContent = text;
    var progress = document.createElement("progress");
    progress.className = "progress-bar";
    progress.max = 100;
    progress.value = 0;
    a.appendChild(i);
    a.appendChild(span);
    a.appendChild(progress);
    li.appendChild(a);
    document.getElementById("menu").prepend(li);
    return li;
}

async function init_button(task_prefix, btn_id, icn, text, onclick) {
    var li = add_button(btn_id, icn, text, onclick);
    var updater = function (message, sender, sendResponse) {
        if (message.channel == "progress" && message.id.task == [task_prefix, obj_id].join('_')) {
            var progress = message.progress;
            li.removeEventListener("click", onclick);
            update_progress(li, text, progress);
            if (!progress.error && progress.value == progress.max)
                li.addEventListener("click", onclick);
            if (progress.error || progress.value == progress.max) {
                sendResponse(true);
            } else
                sendResponse();
            return true;
        }
    };
    chrome.runtime.onMessage.addListener(updater);
    var task = [task_prefix, obj_id].join('_');
    var timestamps = await get_timestamps(task);
    if (timestamps && timestamps.length > 0) {
        var id = { task: task, time: timestamps[0] /* There is supposed to be one timestamp only */ };
        var progress = await get_progress(id);
        update_progress(li, text, progress);
        li.removeEventListener("click", onclick);
        if (progress.error || progress.value == progress.max) {
            li.addEventListener("click", onclick);
            await chrome.runtime.sendMessage(undefined, { channel: "popup", action: "remove_progress", params: { id: id } });
        }

    }
}

function download(action, params) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(undefined, { channel: "popup", action: action, params: params }, undefined, (response) => {
            switch (response.status) {
                case "success":
                    resolve();
                    break;
                case "error":
                    reject(response.object);
            }
        });
    });
}

async function get_progress(id) {
    return await chrome.runtime.sendMessage(undefined, { channel: "popup", action: "get_progress", params: { id: id } });
}

async function get_timestamps(task) {
    return await chrome.runtime.sendMessage(undefined, { channel: "popup", action: "get_timestamps", params: { task: task } });
}

function update_progress(li, default_str, progress) {
    var a = li.getElementsByTagName("a")[0];
    var icn = a.getElementsByTagName("i")[0];
    var span = a.getElementsByTagName("span")[0];
    var bar = a.getElementsByTagName("progress")[0];
    var classes = icn.classList;
    // li.style.pointerEvents = "none";
    a.style.cursor = "default";
    if (progress.error) {
        icn.className = [classes[0], classes[1], classes[2]].join(" ");
        span.textContent = "Error";
        console.error(progress.error);
        return;
    }
    icn.className = [classes[0], classes[1], classes[2], "bx-flashing"].join(" ");
    if (default_str) span.textContent = progress.value + " / " + progress.max;
    bar.value = progress.value;
    bar.max = progress.max;
    if (progress.value == progress.max) {
        setTimeout(() => {
            // li.style.pointerEvents = '';
            a.style.cursor = "pointer";
            icn.className = [classes[0], classes[1], classes[2]].join(" ");
            if (default_str) span.textContent = default_str;
            bar.value = 0;
        }, 200);
    }
}

function download_all_notes() {
    download("download_all_notes", { tab_id: tab_id, user_id: obj_id });
    /*
    If user is not present in the storage, fetch the user and their notes.
    Accessing Xiaohongshu's internal API requires advanced authentication, and its requirments always change.
    Therefore, we have to rely on the browser to perform the authentication to keep things from being complicated.
    Fetching a user profile page only gives the first ~31 notes, the rest requires the internal API.
    This is the explanation for the extra "tab_id" parameter, which is to access notes loaded in the current tab.
    */
}

function download_avatar() {
    download("download_avatar", { user_id: obj_id });
}

function download_note() {
    download("download_note", { note_id: obj_id });
}

function download_image() {
    download("download_image", { tab_id: tab_id, note_id: obj_id });
}

window.onload = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length == 0)
            throw new Error("No active tabs found, that's impossible!");
        tab_id = tabs[0].id;
        var url = tabs[0].url;
        var path = new URL(url).pathname;
        add_button("settings", "bx-cog", "Settings", () => chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") }));
        if (path.startsWith("/user/profile/")) {
            obj_id = path.substring(path.indexOf("/user/profile/") + "/user/profile/".length);
            init_button("download_notes", "download-all-notes", "bxs-download", "Download All Notes", download_all_notes);
            init_button("download_avatar", "download-avatar", "bx-user-circle", "Download Avatar", download_avatar);
        } else if (path.startsWith("/explore/")) {
            obj_id = path.substring(path.indexOf("/explore/") + "/explore/".length);
            init_button("download_note", "download-note", "bxs-download", "Download Note", download_note);
            init_button("download_image", "download-image", "bx-image-alt", "Download This Image", download_image);
        }
    });
};

