# Change Log
- This file records the changes of each commit.

## 1.0.1
- Now users can download a single image in a note (the current viewing image)
- Reordered Image base URLs for performance (some URLs work better than others)
- Fixed slice parsing
- Fixed the if condition in Note.prototype.download
- Fixed that when user opens the popup and something is downloading, user can no longer press the button with progress bar
- Deleted comments of old code
- Improved counting of Download All Notes: it reduces the total no. of notes when it detects some are downloaded already
- Fixed the if condition in User.prototype.download_notes