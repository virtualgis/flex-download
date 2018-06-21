const flexDownload = require('./flex-download');
module.exports = flexDownload;

flexDownload.download("https://maps.co.madison.il.us/", 'downloads', true).then(function(){
    console.log("Done!");
});
