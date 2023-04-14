const core = require('@actions/core');
const github = require('@actions/github');

const fs = require('fs');
const readline = require('readline');
var path = require('path');

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
            var imageLink = l.match( /\(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=/]*\.(gif|jpg|jpeg|tiff|png|svg|ico)/gi);
            core.info(`line: ${imageLink}`);
        }
    });
    rl.on('close', () => {
        core.info('Finished reading the file.');
    });
};


(
    async () => {
        try {
            getMD('.', '.md')
        } catch (error) {
            core.setFailed(error.message);
        }
    }

)();