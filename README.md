# Flex Download

Library to download Viewer for Flex application configurations from public URLs.

## Installation

```bash
# npm install https://github.com/virtualgis/flex-download
```

## Usage

As a library:

```javascript
const fd = require('flex-download');
fd.download("https://myflexviewer.com/", 'destination/directory').then(() => {
    console.log("Done!");
});
```

As a command line utility:

```bash
node fd.js <URL> <destination directory>
```
