const core = require('@actions/core');
const github = require('@actions/github');

const fs = require('fs');
const readline = require('readline');
var path = require('path');

const token = core.getInput('token');
const owner = core.getInput('owner');
const repo = core.getInput('repo');
const pull_number = core.getInput('pull_number');
const commit_id = core.getInput('commit_id');

const axios = require('axios');
const octokit = github.getOctokit(token);

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
            // core.info(filename);
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
    const line_counter = ((i = 0) => () => ++i)();
    rl.on('line', (line, lineno = line_counter()) => {
        if (regex1.test(line)){
            let l = line;
            var imageLink = l.match( /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=/]*\.(gif|jpg|jpeg|tiff|png|svg|ico)/gi );
            var newLink = reformatLink(imageLink, filePath);
            const desc = getImageText(newLink);
            desc.then((response) => {
                let result = response;
                core.info(result);
                modifyFiles(result, lineno, filePath, imageLink);
              });
        }
    });
    rl.on('close', () => {
        core.info('Finished reading the file.');
    });
};

// Reformats image links
function reformatLink(imageLink, filePath){
    const owner = core.getInput('owner');
    const repo = core.getInput('repo');
    const branch = core.getInput('branch').toString().match(/\/(?:.(?!\/))+$/gim);
    // core.info(`branch: ${branch}`);
        
    if(imageLink.toString().startsWith('http')){
        return imageLink;
    } else if(imageLink.toString().startsWith('../')){
        var count = (imageLink.toString().match(/..\//g) || []).length;
        var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '');
        for (let i = 0; i < count; i++) {
            var newPath = newPath.replace(/\/(?:.(?!\/))+$/gim, '')
        }
        var newImageLink = imageLink.toString().replace(imageLink, imageLink.toString().match(/\/(?:.(?!\/))+$/gim));
        var temp = /\//g;
        var newLink = '';
        if (temp.test(newPath)){
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${newPath}${newImageLink}`;
        } else {
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}${newImageLink}`;
        }
        return newLink;
    } else if(imageLink.toString().startsWith('./')){
        var cleanLink = imageLink.toString().replace('./','');
        var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '');
        var newLink = '';
        if (newPath.endsWith('.md')){
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${cleanLink}`;
        } else{
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${newPath}/${cleanLink}`;
        }
        return newLink;
    } else {
        var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${imageLink}`;
        var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '');
        var newLink = '';
        if (newPath.endsWith('.md')){
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${imageLink}`;
        } else{
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}${branch}/${newPath}/${imageLink}`;
        }
        return newLink;
    }
};

// Calls the Image Analysis Analyze API
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
        return result; 
    } catch (error) {
        core.warning(`Failed to get caption for image with link ${imageLink}`);
        core.warning(error);
    }
};

function updateLine(content, imageLink, result) {
	return content.replace(
	`![](${imageLink}`,
	`![${result}](${imageLink}`
	);
}

function modifyFiles(result, lineno, filePath, imageLink){
    try {
        octokit.rest.repos.createOrUpdateFileContents({
            'owner': `${owner}`,
            'repo': `${owner}`,
            'path': `${filePath}`,
            'message': `feat: edit image alt text on ${filePath}`,
            'content': ({content}) => {
                return updateLine(content, imageLink, result);
            },
            'committer.name': 'md-alt-text-suggestor',
            'committer.email': 'abc@def.com',
            'author.name': 'md-alt-text-suggestor',
            'author.email': 'abc@def.com'
                });
    } catch (error) {
        core.setFailed(error);
    }

    // await octokit.rest.issues.createComment({
    //     owner: `${owner}`, 
    //     repo: `${repo}`,
    //     issue_number: `${pull_number}`,
    //     body: 'abc'
    //   });

    // await octokit.rest.pulls.createReviewComment({
    //     owner: `${owner}`,
    //     repo: `${repo}`,
    //     pull_number: `${pull_number}`,
    //     body: `${result}`,
    //     commit_id: `${commit_id}`,
    //     path: `${filePath}`, 
    //     line: `${lineno}`
    //   });
};

async function createPullRequest(){
    try {
        await octokit.rest.pulls.create({
            owner: `${owner}`,
            repo: `${repo}`,
            head: `feature/md-suggest-${pull_number}`,
            base: 'main',
          }); 
    } catch (error) {
        core.setFailed(error);
    }

};

(
    async () => {
        try {
            getMD('.', '.md').then(() => {
                createPullRequest();
            })
        } catch (error) {
            core.setFailed(error.message);
        }
    }
)();