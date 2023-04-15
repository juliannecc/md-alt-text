const core = require('@actions/core');
const github = require('@actions/github');

const fs = require('fs');
const readline = require('readline');
var path = require('path');

const axios = require('axios');

// Finds MD files within a repository
// https://stackoverflow.com/questions/25460574/find-files-by-extension-html-under-a-folder-in-nodejs
async function getMD(startPath, filter) {
    if (!fs.existsSync(startPath)) {
        core.info(`no dir ${startPath}`)
        return;
    }

    var files = fs.readdirSync(startPath);
    for (var i = 0; i < files.length; i++) {
        var filename = path.join(startPath, files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()) {
            getMD(filename, filter); 
        } else if (filename.endsWith(filter)) {
            core.info(filename);
            getMissingAlt(filename);            
        };
    };
};

// Finds missing inline image alt text
async function getMissingAlt(filePath){
    const regex1 = /!\[\]\((https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=/]*\.(gif|jpg|jpeg|tiff|png|svg|ico)/gi;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    rl.on('line', (line) => {
        if (regex1.test(line)){
            let l = line;
            var imageLink = l.match( /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=/]*\.(gif|jpg|jpeg|tiff|png|svg|ico)/gi );
            // core.info(`line: ${imageLink}`);

            const owner = core.getInput('owner');
            const token = core.getInput('token');
            const repo = core.getInput('repo');
            const branch = core.getInput('branch').toString().match(/\/(?:.(?!\/))+$/gim);
            core.info(`branch: ${branch}`);
                
            if(imageLink.toString().startsWith('http')){
                getImageText(imageLink);
            } else if(imageLink.toString().startsWith('../')){
                var count = (imageLink.toString().match(/..\//g) || []).length;
                var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '');
                for (let i = 0; i < count; i++) {
                    var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '')
                }
                var newImageLink = imageLink.toString().replace(imageLink, imageLink.toString().match(/\/(?:.(?!\/))+$/gim));
                // var newLink = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + newPath + newImageLink;
                var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${newPath}${newImageLink}?token=${token}`
                getImageText(newLink);
            } else if(imageLink.toString().startsWith('./')){
                var cleanLink = imageLink.toString().replace('./','');
                // var newLink = 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + cleanLink;
                var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${cleanLink}?token=${token}`
                getImageText(newLink);
            } else {
                // var newLink = 'https://github.com/' + owner + '/' + repo + '/' + imageLink;
                var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${imageLink}?token=${token}`
                getImageText(newLink);
            }

        }
    });
    rl.on('close', () => {
        core.info('Finished reading the file.');
    });
};

// // Reformats the link given
// function getLink(imgLink ,fPath){
//     const owner = core.getInput('owner');
//     const repo = core.getInput('repo');

//     let imageLink = toString(imgLink);
//     let filePath = toString(fPath);

//     if(imageLink.startsWith('http')){return imageLink;}
//     if(imageLink.startsWith('../')){
//         var count = (imageLink.match(/..\//g) || []).length;
//         var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '');
//         for (let i = 0; i < count; i++) {
//             var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '')
//         }
//         var newImageLink = imageLink.replace(imageLink,/\/(?:.(?!\/))+$/gim);
//         var newLink = 'https://github.com/' + owner + '/' + repo + '/' + newPath + newImageLink;
//         return newLink
//     }
//    
//     if(imageLink.startsWith('./')){
//         var cleanLink = imageLink.replace('./','');
//         var newLink = 'https://github.com/' + owner + '/' + repo + '/' + cleanLink;
//         return newLink;
//     }
//     var newLink = 'https://github.com/' + owner + '/' + repo + '/' + imageLink;
//     return newLink;
// };

async function getImageText(imageLink) {
    core.info(`${imageLink}`)
    try {
        const ENDPOINT_URL = core.getInput('ENDPOINT_URL');
        const AZURE_KEY = core.getInput('AZURE_KEY');

        const response = await axios.post(
            `${ENDPOINT_URL}computervision/imageanalysis:analyze?api-version=2023-02-01-preview&features=caption&language=en`, 
            { url: `${imageLink}`}, 
            { headers:
                {"Content-Type": "application/json",
                "Ocp-Apim-Subscription-Key": `${AZURE_KEY}`}
            });
        const result = JSON.stringify(response.data['captionResult']['text']);
        core.info(result);
        return;
    } catch (error) {
        core.warning(`Failed to get caption for image with link ${imageLink}`);
        core.warning(error);
    }
}

// async function getImageText(imageLink) {  
//     const sendPostRequest = async () => {
//         try {
//             const ENDPOINT_URL = core.getInput('ENDPOINT_URL');
//             const AZURE_KEY = core.getInput('AZURE_KEY');
//             const resp = await axios.post(`${ENDPOINT_URL}computervision/imageanalysis:analyze?api-version=2023-02-01-preview&features=caption&language=en`, 
//             {url: `https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png`}, {headers:{"Content-Type": "application/json" ,"Ocp-Apim-Subscription-Key": `${AZURE_KEY}`}}
//              );
//             core.info(JSON.stringify(resp.data));
//         } catch (err) {
//             core.info(err);
//         }
//     };
//     sendPostRequest();
// };

(
    async () => {
        try {
            getMD('.', '.md')
        } catch (error) {
            core.setFailed(error.message);
        }
    }
)();