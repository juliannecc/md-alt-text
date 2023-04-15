const core = require('@actions/core');
const github = require('@actions/github');

const fs = require('fs');
const readline = require('readline');
var path = require('path');

const axios = require('axios');

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
            // core.info(filename);
            getMissingAlt(filename);            
        };
    };
};

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
            getImageText(imageLink);
        }
    });
    rl.on('close', () => {
        core.info('Finished reading the file.');
    });
};

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
        // core.info(JSON.stringify(response.data)[0]);
        core.info(response.data.data)
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