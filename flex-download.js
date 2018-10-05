const fs = require('fs');
const download = require('download');
const shelljs = require('shelljs');
const path = require('path');
const url = require('url');
const parseXml = require('@rgrove/parse-xml');
const http = require('http');

async function urlExists(host, port, path){
    return new Promise(resolve => {
        options = {method: 'HEAD', host: host, port: port, path: path},
        req = http.request(options, function(r) {
            resolve(r.statusCode === 200);
        });
        req.end();
    });
}

module.exports = {
    attemptToFixCommonXmlErrors: function(xml){
        // Yeah :/, Viewer for Flex does not care about non-compliant XML
        // and users don't either.

        // Replace & characters in fields that we know are URLs
        // into &amp (valid XML).
        xml = xml.replace(/<linkurl>([^<]*?)<\/linkurl>/gi, 
        function(match, p1){
            return "<linkurl>" + 
                p1.replace(/&amp;/g, "&").replace(/&/g, "&amp;") +
                "</linkurl>";
        });

        // Replace & characters in fields that we know are URLs
        // into &amp (valid XML).
        xml = xml.replace(/([\w]*?)\s?=\s?"([^"]*?)"/gi, 
            function(match, p1, p2){
                return ` ${p1}="${p2.replace(/&amp;/g, "&").replace(/&/g, "&amp;")}" `; 
            });

        return xml;
    },

    findConfigXml: async function(flexAppUrl){
        let urlobj = new url.URL(flexAppUrl);
        let baseUrl = urlobj.pathname.replace(/config\.xml$/, "");

        let candidates = [
            path.join(baseUrl, "config.xml")
        ];

        while(candidates[candidates.length - 1] !== '/config.xml'){
            let lastEntry = candidates[candidates.length -1];
            candidates.push(path.join(path.dirname(lastEntry), '..', 'config.xml'));
        }
        
        for (let i = 0; i < candidates.length; i++){
            let candidatePath = candidates[i];
            let port = 80;
            if (urlobj.port) port = urlobj.port;
            else if (urlobj.protocol.indexOf('https') === 0) port = 443;
            
            try{
                if (await urlExists(urlobj.hostname, port, candidatePath)){
                    urlobj.pathname = candidatePath;
                    return urlobj.href;
                }
            }catch(e){
                // Do nothing
                continue;
            }
        }

        return false;
    },

    download: async function(flexAppUrl, destination, options = {}){
        options.verbose = options.verbose !== undefined ? options.verbose : false;
        options.strictXml = options.strictXml !== undefined ? options.strictXml : false;
        
        // TODO: handle redirects

        let configXmlUrl = await this.findConfigXml(flexAppUrl);
        if (!configXmlUrl) throw new Error("Could not find a config.xml file at the URL: " + flexAppUrl);

        const flexAppRootUrl = path.dirname(configXmlUrl);
        const flexAppRootPath = new url.URL(flexAppRootUrl).pathname;

        const urlsToDownload = [`${flexAppRootUrl}/config.xml`];
        const downloadedUrls = {};
        
        while(urlsToDownload.length > 0){
            const urlToDownload = new url.URL(urlsToDownload.pop());

            // URL to directory
            const dest = path.dirname(path.join(destination, urlToDownload.pathname.replace(new RegExp(`^${flexAppRootPath}`, "i"), "")));
            const filePath = path.join(dest, path.basename(urlToDownload.pathname));

            if (options.verbose) console.log(`Downloading ${url.format(urlToDownload)}`);

            shelljs.mkdir('-p', dest);
            try{
                await download(url.format(urlToDownload), dest);
            }catch(e){
                if (options.verbose) console.error("Cannot download " + urlToDownload + ", skipping");
                continue;
            }

            downloadedUrls[urlToDownload] = true;

            // Parse
            if (path.extname(urlToDownload.pathname).toLowerCase() === '.xml'){
                
                if (options.verbose) console.log(`Parsing ${filePath}`);

                let fileContent = fs.readFileSync(filePath, {encoding: 'utf8'}).trim();
                let xmlDoc;
                try{
                    xmlDoc = parseXml(fileContent);
                }catch(e){
                    if (!options.strictXml){
                        fileContent = this.attemptToFixCommonXmlErrors(fileContent);
                        try{
                            xmlDoc = parseXml(fileContent);
                        }catch(e){
                            console.error(`Invalid XML (even after fixing for common errors): ${filePath} ${e}`);
                            continue;
                        }
                    }else{
                        console.error(`Invalid XML: ${filePath} ${e}`);
                        continue;
                    }
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

        if (options.verbose) console.log(`No more files.`);

        if (Object.keys(downloadedUrls).length === 0) throw new Error("Could not find a config.xml file in " + flexAppUrl);
    }
};
