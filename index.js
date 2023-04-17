const core = require('@actions/core');
const github = require('@actions/github');

const fs = require('fs');
const readline = require('readline');
var path = require('path');

const AZURE_KEY = core.getInput('AZURE_KEY');
const ENDPOINT_URL = core.getInput('ENDPOINT_URL');

const token = core.getInput('token');
const owner = core.getInput('owner');
const repo = core.getInput('repo');
const pull_number = core.getInput('pull_number');
const commit_id = core.getInput('commit_id');
const branch = core.getInput('branch');

const axios = require('axios');
const octokit = github.getOctokit(token);

const regexMissingAlt = /!\[\]\((https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=/]*\.(gif|jpg|jpeg|tiff|png|svg|ico)/gi;
const regexImageLink = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=/]*\.(gif|jpg|jpeg|tiff|png|svg|ico)/gi;

// List pull requests files 
async function getPrFiles(owner, repo, pull_number){
    try {
        const prFiles = await octokit.rest.pulls.listFiles({
            owner: `${owner}`,
            repo: `${repo}`,
            pull_number: `${pull_number}`,
          });
          return prFiles;
    } catch (error) {
        core.setFailed(error)
    }
};

// Gets md files from pull request files
async function getMdFiles(prFiles){
    const mdFiles = [];

    prFiles.forEach(function(prFile){
        for (let key in prFile){
            let value = prFile[key];
            if( key == 'filename' && /.*\.md$/i.test(value)){
                mdFiles.push(prFile);
            }
        }
    });

    return mdFiles;
};

// Reformats the image link
async function reformatImageLink(imageLink, filePath){
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
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${newPath}${newImageLink}`;
        } else {
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${newImageLink}`;
        }
        return newLink;
    } else if(imageLink.toString().startsWith('./')){
        var cleanLink = imageLink.toString().replace('./','');
        var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '');
        var newLink = '';
        if (newPath.endsWith('.md')){
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanLink}`;
        } else{
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${newPath}/${cleanLink}`;
        }
        return newLink;
    } else {
        var newLink = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${imageLink}`;
        var newPath = filePath.replace(/\/(?:.(?!\/))+$/gim, '');
        var newLink = '';
        if (newPath.endsWith('.md')){
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${imageLink}`;
        } else{
            var newLink = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${newPath}/${imageLink}`;
        }
        return newLink;
    }
}

// Finds image with missing alt texts
async function getMissingAltTxt(mdFiles){
    for(const mdFile in mdFiles){
        let fileContents = mdFiles[mdFile]['patch'].split('\n');
        let filePath = mdFiles[mdFile]['filename'];
        for(const lineno in fileContents){
            if(regexMissingAlt.test(fileContents[lineno])){
                let imageLink = fileContents[lineno].match(regexImageLink)[0];
                let newLink = reformatImageLink(imageLink, filePath);
                newLink.then((response) => {
                    core.info(`image link: ${response}`);

                    const desc = getImageText(response);
                    desc.then((result) => {
                        core.info(result);
                    })

                })                
                // createComment(owner, repo, pull_number, commit_id, filePath, lineno);
            }
        }
    }
};

async function getImageText(imageLink, AZURE_KEY, ENDPOINT_URL) {
    try {
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


// Creates a review comment
async function createComment(owner, repo, pull_number, commit_id, path, lineno){
    try {
    await octokit.rest.pulls.createReviewComment({
        owner: `${owner}`,
        repo: `${repo}`,
        pull_number: `${pull_number}`,
        body: 'Nice',
        commit_id: `${commit_id}`,
        path: `${path}`,
        line: parseInt(lineno),
        });
    } catch (error) {
        core.setFailed(error);
    }

};

(
    async () => {
        try {
            var prFiles = getPrFiles(owner, repo, pull_number);
            prFiles.then((response) => {
                const mdFiles = getMdFiles(response.data);
                core.warning(JSON.stringify(response.data));

                mdFiles.then((response => {
                    getMissingAltTxt(response);
                    core.info(typeof(response));
                }))
                
            })
        } catch (error) {
            core.setFailed(error.message);
        }
    }
)();