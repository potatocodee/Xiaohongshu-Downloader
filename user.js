class User {

    static xhs_parse(id, user_json, notes_json) {
        var basic_info = user_json.basicInfo;
        var avatar_url = basic_info.imageb ? basic_info.imageb : basic_info.images;
        return new User(id, basic_info.redId, basic_info.nickname, basic_info.gender, basic_info.desc, Avatar.xhs_parse(avatar_url, id), notes_json ? notes_json.map((note) => note.id) : undefined);
    }

    static from_storage(obj) {
        var user = Object.assign(new User(), obj);
        user.avatar = Avatar.from_storage(obj.avatar);
        return user;
    }

    id;
    red_id;
    nickname;
    gender;
    desc;
    avatar;
    note_ids;

    constructor(id, red_id, nickname, gender, desc, avatar, note_ids = []) {
        this.id = id;
        this.red_id = red_id;
        this.nickname = nickname;
        this.gender = gender;
        this.desc = desc;
        this.avatar = avatar;
        this.note_ids = note_ids;
    }

    to_storage() {
        var obj = Object.assign({}, this);
        obj.avatar = this.avatar.to_storage();
        return obj;
    }

    // Does not track the progress of individual notes
    download_notes(slice, retry = true) {
        var user = this;
        var id = { task: ["download_notes", this.id].join('_'), time: Date.now() };
        download().catch((error) => set_progress(id, { error: Object.getOwnPropertyNames(error).reduce((obj, key) => { obj[key] = error[key]; return obj; }, {}) }));
        return id;

        async function download() {
            var note_ids_slice = slice ? slice.map((i) => user.note_ids[i]) : user.note_ids.slice();
            for (var i = 0; i < note_ids_slice.length; i++) {
                await set_progress(id, { value: i, max: note_ids_slice.length });
                var note = await get_note(note_ids_slice[i]);
                if (note.images.length > 0)
                    await note.download_images(undefined, undefined, retry);
                if (note.video && !note)
                    await note.download_video(retry);
                update_note(note);
                if (i % 20 == 19)
                    await wait(60000); // Take a break to clear up the retrying downloads
            }
            await set_progress(id, { value: note_ids_slice.length, max: note_ids_slice.length });
        }

    }

    download_avatar(format = "jpg", retry = true) {
        var user = this;
        var id = { task: ["download_avatar", this.id].join('_'), time: Date.now() };
        download().catch((error) => set_progress(id, { error: Object.getOwnPropertyNames(error).reduce((obj, key) => { obj[key] = error[key]; return obj; }, {}) }));
        return id;

        async function download() {
            if (user.avatar.downloaded)
                return;

            var folder = user.nickname.replaceAll(pattern, '_') + ' ' + user.id;
            var filename = user.nickname.replaceAll(pattern, '_') + '.' + format;

            var url;
            try {
                await set_progress(id, { value: 0, max: 2 });
                url = await user.avatar.fetch(filename, undefined, new QueryBuilder().set_format(format), retry);
                await set_progress(id, { value: 1, max: 2 });
                await chrome.downloads.download({ url: url, filename: folder + '/' + filename });
                await set_progress(id, { value: 2, max: 2 });
                user.avatar.downloaded = true;
                update_user(user);
            } finally {
                if (url)
                    do_offscreen("revoke_object_url", { url: url });
            }
        }
    }

}

export default User;

import { Avatar, QueryBuilder } from "./media.js";
import { pattern, get_note, do_offscreen, set_progress, wait, update_note, update_user } from "./background.js";