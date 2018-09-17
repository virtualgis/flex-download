const fs = require('fs');
const download = require('download');
const shelljs = require('shelljs');
const path = require('path');
const url = require('url');
const parseXml = require('@rgrove/parse-xml');

module.exports = {
    download: async function(flexAppUrl, destination, verbose = false){
        // TODO: handle redirects

        if (flexAppUrl[flexAppUrl.length - 1] === "/") flexAppUrl = flexAppUrl.slice(0, flexAppUrl.length - 1);
        
        const flexAppRootUrl = path.dirname(flexAppUrl);
        const flexAppRootPath = url.parse(flexAppRootUrl).pathname;

        const urlsToDownload = [`${flexAppRootUrl}/config.xml`];
        const downloadedUrls = {};
        downloadedUrls[urlsToDownload[0]] = true;

        while(urlsToDownload.length > 0){
            const urlToDownload = url.parse(urlsToDownload.pop());

            // URL to directory
            const dest = path.dirname(path.join(destination, urlToDownload.pathname.replace(new RegExp(`^${flexAppRootPath}`, "i"), "")));
            const filePath = path.join(dest, path.basename(urlToDownload.pathname));

            if (verbose) console.log(`Downloading ${url.format(urlToDownload)}`);

            shelljs.mkdir('-p', dest);
            await download(url.format(urlToDownload), dest);

            // Parse
            if (path.extname(urlToDownload.pathname).toLowerCase() === '.xml'){
                
                if (verbose) console.log(`Parsing ${filePath}`);

                const fileContent = fs.readFileSync(filePath, {encoding: 'utf8'}).trim();
                let xmlDoc;
                try{
                    xmlDoc = parseXml(fileContent);
                }catch(e){
                    console.error(`Invalid XML: ${filePath} ${e}`);
                    continue;
                }

                const scanForFile = (str) => {
                    if (!str) return;

                    str = str.trim();

                    // No external URLs
                    if (str.indexOf("http") !== -1) return;
                    
                    // All strings that match what looks like a file
                    // (something.ext, file/path.jpeg, ...)
                    if (str.match(/^.*\.[\w\d]{3,4}$/g)){
                        const url = flexAppRootUrl + "/" + str;
                        if (!downloadedUrls[url]){
                            urlsToDownload.push(url);
                            downloadedUrls[url] = true;
                        }
                    }
                };

                const parseElement = (el) => {
                    if (el.children && el.children.length > 0){
                        el.children.forEach(parseElement);
                    }

                    scanForFile(el.text);
                    for(let a in el.attributes){
                        scanForFile(el.attributes[a]);
                    }
                };

                parseElement(xmlDoc);
            }
        }

        if (verbose) console.log(`No more files.`);
    }
};
