const core = require('@actions/core');
const github = require('@actions/github');

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
            getMissingAlt(filename);
        };
    };
};

(
    async () => {
        try {
            getMD('.', '.md')
            core.notice('hi')
        } catch (error) {
            core.setFailed(error.message);
        }
    }

)();