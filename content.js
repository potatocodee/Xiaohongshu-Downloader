function injectFileScript(file_path, tag) {
    var node = document.getElementsByTagName(tag)[0];
    var script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', file_path);
    node.appendChild(script);
}

var initial_state;

function get_current_image_index() {
    var element = document.getElementsByClassName("fraction");
    if (element.length >= 1)
        return parseInt(element[0].innerText.substring(0, 1)) - 1;
    else
        return 0;
}

if (document.location.pathname.startsWith("/user/profile/") || document.location.pathname.startsWith("/explore/")) {
    var listener = function (event) {
        initial_state = JSON.parse(event.detail);
        document.removeEventListener("initial_state_ready", listener);
    };
    document.addEventListener("initial_state_ready", listener);
    injectFileScript(chrome.runtime.getURL('window.js'), 'head');
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        if (message.channel == "active_tab") {
            function send_response(object) {
                sendResponse({ status: "success", object: object });
            }
            function send_error(error) {
                console.error(error);
                var obj = Object.getOwnPropertyNames(error).reduce((obj, key) => { obj[key] = error[key]; return obj; }, {});
                sendResponse({ status: "error", object: obj });
            }
            switch (message.action) {
                case "fetch_user":
                    try {
                        var obj = { user_json: JSON.stringify(initial_state.user.userPageData._rawValue), notes_json: JSON.stringify(initial_state.user.notes._rawValue[0]) };
                        send_response(obj);
                    } catch (error) {
                        send_error(error);
                    }
                    return true;
                case "current_image_index":
                    try {
                        send_response(get_current_image_index());
                    } catch (error) {
                        send_error(error);
                    }
                    return true;
            }
        }
    });
}