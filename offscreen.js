function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function url_fetch(url) {
    var res;
    try {
        res = await fetch(url);
    } catch (error) {
        throw { name: "FetchError", cause: error };
    }
    if (res.status == 424 || res.status >= 500) {
        throw { name: "ServerError", status: res.status };
    }
    if (!(res.status >= 200 && res.status < 300)) {
        throw { name: "BadRequestError", status: res.status };
    }
    return res;
}

async function fetch_blob(url) {
    var res = await url_fetch(url);
    var blob = await res.blob();
    if (res.headers.get("Content-Length") != blob.size) {
        throw { name: "CorruptedError" };
    }
    return blob;
}

async function fetch_html(url) {
    var res = await url_fetch(url);
    var text = await res.text();
    var html = new DOMParser().parseFromString(text, "text/html");
    const errorNode = html.querySelector("parsererror");
    if (errorNode) {
        throw { name: "HTMLParseError" };
    }
    return html;
}

async function fetch_initial_state(url, retry) {
    var i = 0;
    var html;

    function parse_initial_state(html) {
        var script_tags = html.getElementsByTagName("script");
        for (const script_tag of script_tags) {
            var script = script_tag.innerHTML;
            if (script.startsWith("window.__INITIAL_STATE__")) {
                var json_text = script.substring(script.indexOf('{')).replaceAll(":undefined", ":null");
                try {
                    var json = JSON.parse(json_text);
                    if (json.note === undefined || json.user === undefined) {
                        throw { name: "CorruptedError" };
                    }
                    return json;
                } catch (error) {
                    throw { name: "JSONParseError" };
                }
            }
        }
        throw { name: "NoInitialStateError" };
    }

    while (true) {
        try {
            html = await fetch_html(url);
            return parse_initial_state(html);
        } catch (error) {
            console.log(error.name + ": Failed to fetch initial state from " + url);
            switch (error.name) {
                case "BadRequestError":
                    throw error;
                case "NoInitialStateError":
                    console.log("Human Captcha is required, please visit any Xiaohongshu page to solve it.");
                default:
                    if (!retry) return;
                    console.log("Retrying in " + 5 * 2 ** i + " secs...");
                    await wait(5000 * 2 ** i);
                    i += 1;
                    continue;
            }

        }
    }
}

function date_to_exif(date) {
    return date.toISOString().split('.')[0].replaceAll('-', ':').replaceAll('T', ' ');
}

function exif_to_date(exif) {
    var tokens = exif.split(' ');
    tokens[1] = tokens[1].replaceAll(':', '-');
    return new Date(tokens.join('T') + ".000Z");
}

async function jpg_write_date(blob, date) {
    var reader = new Promise(function (resolve) {
        const reader = new FileReader();
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });
    var dataurl = await reader;
    var exif = piexif.load(dataurl);
    var current_date = exif["Exif"][piexif.ExifIFD.DateTimeOriginal];
    if (!current_date || (current_date && exif_to_date(current_date) > date))
        exif["Exif"][piexif.ExifIFD.DateTimeOriginal] = date_to_exif(date);
    var new_exif = piexif.dump(exif);
    var new_dataurl = piexif.insert(new_exif, dataurl);
    return await fetch(new_dataurl).then((response) => response.blob());
}

async function fetch_media(urls, type, filename, date, format, retry) {
    var i = 0;
    var max_i = urls.length;
    var blob;
    while (true) {
        var url = urls[i % max_i];
        try {
            blob = await fetch_blob(url);
            if (type == "Image" && !blob.type.endsWith(format))
                blob = new Blob([blob], { type: "image/" + format });
            // Fixes the MIME type (file extension type) of the image blob (as it may be provided wrongly from Xiaohongshu's servers)
        } catch (error) {
            console.log(error.name + ": Failed to fetch media " + filename + " from " + url);
            switch (error.name) {
                case "BadRequestError":
                    throw error;
                default:
                    if (!retry) return;
                    console.log("Retrying in " + 5 * 2 ** i + " secs...");
                    await wait(5000 * 2 ** i);
                    i += 1;
                    continue;
            }
        }
        if (date && type == "Image" && (format == "jpg" || format == "jpeg"))
            blob = await jpg_write_date(blob, date);
        return URL.createObjectURL(blob);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.channel == "offscreen") {
        var params = message.params;
        function send_response(object) {
            sendResponse({ status: "success", object: object });
        }
        function send_error(error) {
            console.error(error);
            var obj = Object.getOwnPropertyNames(error).reduce((obj, key) => { obj[key] = error[key]; return obj; }, {});
            sendResponse({ status: "error", object: obj });
        }
        switch (message.action) {
            case "fetch_media":
                fetch_media(params.urls, params.type, params.filename, params.date ? new Date(params.date) : undefined, params.format, params.retry).then(send_response).catch(send_error);
                return true;
            case "fetch_initial_state":
                fetch_initial_state(params.url, params.retry).then(send_response).catch(send_error);
                return true;
            case "revoke_object_url":
                URL.revokeObjectURL(params.url);
                send_response();
        }

    }
});
