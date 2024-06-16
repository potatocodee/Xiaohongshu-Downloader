export class Media {

    id;
    user_id;
    downloaded;

    constructor(id, user_id, downloaded = false) {
        this.id = id;
        this.user_id = user_id;
        this.downloaded = downloaded;
    }

    base_urls(format) {
        throw new Error("Method 'base_urls()' must be implemented.");
    }

    to_storage() {
        return this;
    }

    default_format() {
        throw new Error("Method 'default_format()' must be implemented.");
    }

    async fetch(filename, date, query, retry = true) {
        var media = this;
        var format = query ? query.format : this.default_format();
        return await do_offscreen("fetch_media", {
            urls: media.base_urls(format).map((base) => {
                var url = new URL(media.id, base);
                if (query)
                    url = query.append_to_url(url);
                return url;
            }), type: this.constructor.name, filename: filename, date: date ? date.toJSON() : undefined, format: format, retry: retry
        });
    }

}

export class Image extends Media {

    static BASE_URLS = [
        "https://sns-img-go.xhscdn.com",
        "https://sns-img-qc.xhscdn.com",
        "https://sns-img-al.xhscdn.com",
        "https://sns-img-ws.xhscdn.com"
    ];

    static BASE_URLS_JPG = [ // Only gives MIME type of JPEG (file extension type)
        "https://sns-img-ak.xhscdn.com",
        "https://sns-img-bd.xhscdn.com",
        "https://sns-img-hw.xhscdn.com",
        "https://sns-img-qn.xhscdn.com",
    ]

    static BASE_URLS_WATERMARKED = [
        "https://sns-webpic-qc.xhscdn.com"
    ];

    static xhs_parse(img_json, user_id) {
        var url = img_json.urlDefault;
        return new Image(new URL(url).pathname.split('/').slice(3).join('/').split('!')[0], user_id);
    }

    static from_storage(obj) {
        return Object.assign(new Image(), obj);
    }

    constructor(id, user_id) {
        super(id, user_id);
    }

    base_urls(format) {
        // switch (format) {
        //     case "jpg":
        //     case "jpeg":
        //         return Image.BASE_URLS_JPG.concat(Image.BASE_URLS);
        //     default:
        //         return Image.BASE_URLS;
        // }
        return Image.BASE_URLS_JPG.concat(Image.BASE_URLS);
        // return Image.BASE_URLS;
    }

    default_format() {
        return "webp";
    }

    base_urls_watermarked() {
        return Image.BASE_URLS_WATERMARKED;
    }

    url_watermarked(base_index = 0) {
        return new URL(this.id, this.base_urls_watermarked()[base_index]);
    }

}

export class Avatar extends Media {

    static BASE_URLS = [
        "https://sns-avatar-qc.xhscdn.com"
    ];

    static xhs_parse(url, user_id) {
        return new Avatar(new URL(url).pathname, user_id);
    }
    
    static from_storage(obj) {
        return Object.assign(new Avatar(), obj);
    }

    constructor(id, user_id) {
        super(id, user_id);
    }

    base_urls(format) {
        return Avatar.BASE_URLS;
    }

    default_format() {
        return "jpg";
    }

}

export class Video extends Media {

    static BASE_URLS = [
        "https://sns-video-ak.xhscdn.com",
        "https://sns-video-al.xhscdn.com",
        "https://sns-video-audit.xhscdn.com",
        "https://sns-video-bd.xhscdn.com",
        "https://sns-video-exp1-bd.xhscdn.com",
        "https://sns-video-exp1-hs.xhscdn.com",
        "https://sns-video-exp1-hw.xhscdn.com",
        "https://sns-video-exp1-po.xhscdn.com",
        "https://sns-video-exp1-qc.xhscdn.com",
        "https://sns-video-exp1-qn.xhscdn.com",
        "https://sns-video-exp1-wx.xhscdn.com",
        "https://sns-video-exp2-bd.xhscdn.com",
        "https://sns-video-exp2-hs.xhscdn.com",
        "https://sns-video-exp2-hw.xhscdn.com",
        "https://sns-video-exp2-po.xhscdn.com",
        "https://sns-video-exp2-qc.xhscdn.com",
        "https://sns-video-exp2-qn.xhscdn.com",
        "https://sns-video-exp3-al.xhscdn.com",
        "https://sns-video-exp3-al80.xhscdn.com",
        "https://sns-video-exp3-hs.xhscdn.com",
        "https://sns-video-exp3-hw.xhscdn.com",
        "https://sns-video-exp3-po.xhscdn.com",
        "https://sns-video-exp3-qc.xhscdn.com",
        "https://sns-video-exp3-qn.xhscdn.com",
        "https://sns-video-exp4-qn.xhscdn.com",
        "https://sns-video-hw.xhscdn.com",
        "https://sns-video-qc.xhscdn.com",
        "https://sns-video-qn.xhscdn.com",
    ]

    static xhs_parse(vid_json, user_id) {
        var id = vid_json.consumer.originVideoKey;
        var ids_watermarked = [];
        var h264 = vid_json.media.stream.h264;
        if (h264.length > 0) {
            for (var i = 0; i < h264.length; i++) {
                ids_watermarked = ids_watermarked.concat(h264[i].backupUrls);
                ids_watermarked.push(h264[i].masterUrl);
            }
        }
        ids_watermarked = ids_watermarked.map((id) => new URL(id).pathname);
        return new Video(id, [...new Set(ids_watermarked)], user_id);
    }

    static from_storage(obj) {
        return Object.assign(new Video(), obj);
    }

    ids_watermarked;

    constructor(id, ids_watermarked = [], user_id) {
        super(id, user_id);
        this.ids_watermarked = ids_watermarked;
    }

    base_urls(format) {
        return Video.BASE_URLS;
    }

    default_format() {
        return "mp4";
    }

    url_watermarked(base_index = 0, id_index = 0) {
        return new URL(this.ids_watermarked[id_index], this.base_urls_watermarked()[base_index]);
    }

}

export class QueryBuilder {

    #format;
    #len_mode;
    #length;
    #quality;
    #auto_orient;
    #strip;
    #crop;
    #gravity;

    get format() {
        return this.#format;
    }

    set format(value) {
        if (!(value == null || value == "jpg" || value == "jpeg" || value == "png" || value == "webp"))
            throw new Error("Unsupported image format: " + value);
        this.#format = value;
    }

    get scale_by_width() {
        return this.#len_mode == 'w' ? this.#length : null;
    }

    get scale_by_height() {
        return this.#len_mode == 'h' ? this.#length : null;
    }

    set scale_by_width(new_width) {
        this.#len_mode = 'w';
        this.#length = new_width;
    }

    set scale_by_width(new_height) {
        this.#len_mode = 'h';
        this.#length = new_height;
    }

    get quality() {
        return this.#quality;
    }

    set quality(value) {
        if (!(value >= 0 && value <= 100))
            throw new Error("Image quality must be between 0 and 100, got: " + value);
        this.#quality = value;
    }

    get auto_orient() {
        return this.#auto_orient;
    }

    set auto_orient(value) {
        this.#auto_orient = value;
    }

    get strip() {
        return this.#strip;
    }

    set strip(value) {
        this.#strip = value;
    }

    get crop() {
        return this.#crop;
    }

    set crop(value) {
        if (!(Array.isArray(value) && value.length == 2))
            throw new Error("Crop dimensions must be an array of 2 integers, got: " + value)
        this.#crop = value;
    }

    get gravity() {
        return this.#gravity;
    }

    set gravity(value) {
        this.#gravity = value;
    }

    set_format(value) {
        this.format = value;
        return this;
    }

    set_scale_by_width(new_width) {
        this.scale_by_width = new_width;
        return this;
    }

    set_scale_by_height(new_height) {
        this.scale_by_height = new_height;
        return this;
    }

    set_quality(value) {
        this.quality = value;
        return this;
    }

    set_auto_orient(value) {
        this.auto_orient = value;
        return this;
    }

    set_strip(value) {
        this.strip = value;
        return this;
    }

    set_crop(value) {
        this.crop = value;
        return this;
    }

    set_gravity(value) {
        this.gravity = value;
        return this;
    }

    append_to_url(url) {
        var tokens = ["imageView2", "2"];
        if (this.format) tokens.push("format", this.format);
        if (this.#length) tokens.push(this.#len_mode, this.#length);
        if (this.quality) tokens.push("quality", this.quality);
        if (this.auto_orient) tokens.push("auto-orient");
        if (this.strip) tokens.push("strip");
        if (this.crop) tokens.push("crop", this.crop.join('x'));
        if (this.gravity) tokens.push("gravity", this.gravity);
        var url = new URL(url);
        url.searchParams.append(tokens.join('/'), '');
        return url.href.slice(0, -1);
    }

}

import { do_offscreen } from "./background.js";