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

// Finds image lines with missing alt texts
// async function getMissingAltTxt(mdFiles){
//     for(const mdFile in mdFiles){
//         for(const key in mdFiles[mdFile]){
//             let value = mdFiles[mdFile][key];
//             if(key == 'patch'){
//                 let linesArr = value.split('\n');
//                 for (let lineno in linesArr){
//                     let line = linesArr[lineno];
//                     if(regexMissingAlt.test(line)){
//                         core.info(line.match(regexMissingAlt)[0]);
//                     }
//                 }
//             }
//         }
//     }
// };

// Finds image with missing alt texts
async function getMissingAltTxt(mdFiles){
    for(const mdFile in mdFiles){
        let fileContents = mdFiles[mdFile]['patch'].split('\n');
        core.info(fileContents);
    }
};

async function createComment(){

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