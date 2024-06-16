class Note {

    id;
    title;
    desc;
    location;
    user_id;
    last_update_time;
    creation_time;
    images;
    video;

    static xhs_parse(note_json) {
        var user_id = note_json.user.userId;
        var images = [];
        if (note_json.imageList) {
            var imageList = note_json.imageList;
            for (var i = 0; i < imageList.length; i++) {
                images.push(Image.xhs_parse(imageList[i], user_id));
            }
        }
        var video;
        if (note_json.video) {
            video = Video.xhs_parse(note_json.video, user_id);
        }
        return new Note(note_json.noteId, note_json.title, note_json.desc, note_json.ipLocation, user_id, new Date(note_json.lastUpdateTime), new Date(note_json.time), images, video);
    }

    static from_storage(obj) {
        var note = Object.assign(new Note(), obj);
        note.creation_time = new Date(obj.creation_time);
        note.last_update_time = new Date(obj.last_update_time);
        note.images = obj.images.map((image) => Image.from_storage(image));
        if (obj.video)
            note.video = Video.from_storage(obj.video);
        return note;
    }

    constructor(id, title, desc, location, user_id, last_update_time, creation_time, images = [], video) {
        this.id = id;
        this.title = title;
        this.desc = desc;
        this.location = location;
        this.user_id = user_id;
        this.last_update_time = last_update_time;
        this.creation_time = creation_time;
        this.images = images;
        this.video = video;
    }

    async #download_image(note, user, i, format, retry) {
        if (note.images[i].downloaded)
            return false;

        var folder = user.nickname.replaceAll(pattern, '_') + ' ' + user.id;
        var filename = (note.title.length > 0 ? note.title : note.desc.split('\n')[0]).replaceAll(pattern, '_') + '_' + (i + 1) + '_' + user.nickname.replaceAll(pattern, '_') + '.' + format;

        var url;
        try {
            url = await note.images[i].fetch(filename, note.creation_time, new QueryBuilder().set_format(format), retry);
            await chrome.downloads.download({ url: url, filename: folder + '/' + filename });
            note.images[i].downloaded = true;
            return true;
        } finally {
            if (url)
                do_offscreen("revoke_object_url", { url: url });
        }
    }

    async download_image(i, format = "jpg", retry = true) {
        await this.#download_image(this, await get_user(this.user_id), i, format, retry);
    }

    async download_images(format = "jpg", slice, retry = true) { // If all images then leave slice undefined
        var user = await get_user(this.user_id);
        var imgs = slice ? slice.map((i) => this.images[i]) : this.images.slice();
        var result = true;

        for (var i = 0; i < imgs.length; i++) {
            result = result && await this.#download_image(this, user, i, format, retry);
            await wait(250); // Wait for 0.25 sec before downloading the next image, to avoid being rate limited / blocked
        }

        return result;
    }

    async #download_video(note, user, retry) {
        if (note.video.downloaded)
            return false;

        var folder = user.nickname.replaceAll(pattern, '_') + ' ' + user.id;
        var filename = (note.title.length > 0 ? note.title : note.desc.split('\n')[0]).replaceAll(pattern, '_') + '_' + user.nickname.replaceAll(pattern, '_') + '.' + "mp4";

        var url;
        try {
            url = await note.video.fetch(filename, note.creation_time, undefined, retry);
            await chrome.downloads.download({ url: url, filename: folder + '/' + filename });
            note.video.downloaded = true;
            return true;
        } finally {
            if (url)
                do_offscreen("revoke_object_url", { url: url });
        }
    }

    async download_video(retry = true) {
        await this.#download_video(this, await get_user(this.user_id), retry);
    }

    // Combines download_images and download_video with additional calls to update progress
    // This function knows image no. + video no. (0 or 1), download_images and download_video only know one of them
    // Synchronously returns a download id for progress tracking
    download(format = "jpg", slice, retry = true) {
        var note = this;
        var id = { task: ["download_note", this.id].join('_'), time: Date.now() };
        download().catch((error) => set_progress(id, { error: Object.getOwnPropertyNames(error).reduce((obj, key) => { obj[key] = error[key]; return obj; }, {}) }));
        return id;

        async function download() {
            var user = await get_user(note.user_id);
            var imgs = (slice ? slice.map((i) => note.images[i]) : note.images.slice()).filter((img) => !img.downloaded);
            var max = imgs.length + (note.video && note.video.downloaded ? 1 : 0);

            if (max == 0)
                return;

            for (var i = 0; i < imgs.length; i++) {
                await set_progress(id, { value: i, max: max });
                await note.#download_image(note, user, i, format, retry);
                await wait(250); // Wait for 0.25 sec before downloading the next image, to avoid being rate limited / blocked
            }
            await set_progress(id, { value: imgs.length, max: max });

            if (note.video && note.video.downloaded) {
                await note.#download_video(note, user, retry);
                await set_progress(id, { value: max, max: max });
            }

            update_note(note);
        }
    }

    to_storage() {
        var obj = Object.assign({}, this);
        obj.images = this.images.map((image) => image.to_storage());
        if (this.video)
            obj.video = this.video.to_storage();
        obj.creation_time = this.creation_time.toJSON();
        obj.last_update_time = this.last_update_time.toJSON();
        return obj;
    }

}

export default Note;

import { Image, Video, QueryBuilder } from "./media.js";
import { pattern, get_user, do_offscreen, set_progress, update_note, wait } from "./background.js";