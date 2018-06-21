const fd = require('./index');
const argv = process.argv.slice(2, 4);
if (argv.length != 2){
    console.log("Usage: node fd.js <URL> <destination directory>")
    process.exit(1);
}
fd.download(argv[0], argv[1], true).then(() => console.log("Done!"));