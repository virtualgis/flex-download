# Flex Download

Library to download Viewer for Flex application configurations from public URLs.

## Installation

```bash
# npm install @virtualgis/flex-download
```

## Usage

```javascript
const flexDownload = require('@virtualgis/flex-download');
flexDownload.download("https://myflexviewer.com/", 'path/to/folder').then(() => {
    console.log("Done!");
});
```
