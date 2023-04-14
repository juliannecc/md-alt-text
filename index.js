const core = require('@actions/core')
const github = require('@actions/github')

(
    async () => {
        try {
            core.notice('Action');
        } catch(error){
            core.setFailed(error.message);
        }
    }

)();